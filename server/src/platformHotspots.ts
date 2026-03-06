import { randomUUID } from 'node:crypto'
import OpenAI from 'openai'
import type { PlatformBatch, PlatformHotspotItem, PlatformId, PlatformOption, PlatformSchedule, PlatformSnapshot } from './types.js'

type RawItem = {
  title: string
  url: string
  snippet: string
}

type SourceDefinition = {
  id: PlatformId
  label: string
  needApiKey: boolean
  run: (keyword: string) => Promise<RawItem[]>
}

const DEFAULT_INTERVAL_MINUTES = 15
const MIN_INTERVAL_MINUTES = 1
const MAX_INTERVAL_MINUTES = 720
const LLM_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'
const LLM_API_KEY = process.env.OPENROUTER_API_KEY

const llmClient = LLM_API_KEY
  ? new OpenAI({
      apiKey: LLM_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1'
    })
  : null

const schedule: PlatformSchedule = {
  enabled: true,
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  keywords: ['科技热点'],
  selectedPlatforms: ['twitter', 'bing', 'google', 'duckduckgo', 'hackernews', 'sogou', 'bilibili', 'weibo'],
  lastFetchedAt: null,
  nextRunAt: null,
  isRunning: false
}

let latestItems: PlatformHotspotItem[] = []
let latestBatches: PlatformBatch[] = []
let timer: NodeJS.Timeout | null = null

function cleanText(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKeyword(keyword: string) {
  return keyword.trim() || '科技热点'
}

function normalizeKeywords(keywords?: string[]) {
  const base = Array.isArray(keywords) ? keywords : schedule.keywords
  const normalized = Array.from(
    new Set(
      base
        .map((item) => normalizeKeyword(typeof item === 'string' ? item : ''))
        .filter(Boolean)
    )
  )
  return normalized.length > 0 ? normalized : ['科技热点']
}

function safeJsonParse(content: string): { items?: RawItem[] } | null {
  try {
    const parsed = JSON.parse(content) as { items?: RawItem[] }
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function toAbsoluteUrl(url: string, base: string) {
  try {
    return new URL(url, base).toString()
  } catch {
    return ''
  }
}

async function fetchText(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xml,application/json;q=0.9,*/*;q=0.8'
      }
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function pickXmlItems(xml: string, limit: number): RawItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  const result: RawItem[] = []
  for (const block of blocks) {
    if (result.length >= limit) {
      break
    }
    const title = cleanText((block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim())
    const url = cleanText((block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? '').trim())
    const snippet = cleanText((block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? '').trim())
    if (!title || !url) {
      continue
    }
    result.push({ title, url, snippet })
  }
  return result
}

function pickHtmlAnchors(html: string, baseUrl: string, limit: number): RawItem[] {
  const result: RawItem[] = []
  const anchorRegex = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null = anchorRegex.exec(html)
  while (match && result.length < limit) {
    const url = toAbsoluteUrl(match[1], baseUrl)
    const title = cleanText(match[2] ?? '')
    if (!url || !title || title.length < 6) {
      match = anchorRegex.exec(html)
      continue
    }
    if (title.includes('登录') || title.includes('注册') || title.includes('更多')) {
      match = anchorRegex.exec(html)
      continue
    }
    result.push({
      title,
      url,
      snippet: ''
    })
    match = anchorRegex.exec(html)
  }
  return result
}

function mapItems(platform: SourceDefinition, rows: RawItem[]): PlatformHotspotItem[] {
  const fetchedAt = new Date().toISOString()
  return rows.map((item) => ({
    id: randomUUID(),
    platform: platform.id,
    platformLabel: platform.label,
    title: item.title,
    url: item.url,
    snippet: item.snippet,
    heatLevel: 'low',
    heatScore: 0,
    fetchedAt
  }))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  return value as Record<string, unknown>
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toHeatLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 75) {
    return 'high'
  }
  if (score >= 45) {
    return 'medium'
  }
  return 'low'
}

function toScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreByRule(keyword: string, item: PlatformHotspotItem) {
  const text = `${item.title} ${item.snippet}`.toLowerCase()
  const tokens = keyword
    .toLowerCase()
    .split(/[,\s，、]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
  let score = 35
  if (tokens.some((token) => text.includes(token))) {
    score += 22
  }
  if (/(突发|爆|崩|事故|裁员|封禁|危机|战争|地震|洪水|暴跌|预警)/i.test(text)) {
    score += 30
  }
  if (/[0-9]+(%|亿|万|千|k|m|b)/i.test(text)) {
    score += 10
  }
  if (item.title.length >= 24) {
    score += 6
  }
  const heatScore = toScore(score)
  return {
    heatScore,
    heatLevel: toHeatLevel(heatScore)
  }
}

async function scoreWithLlm(keyword: string, items: PlatformHotspotItem[]) {
  if (!llmClient || items.length === 0) {
    return null
  }
  const prompt = [
    '请为热点条目评估热度分数与等级。',
    '热度分数范围0-100，越高表示越热。',
    '热度等级只能是 low、medium、high。',
    `关键词：${keyword}`,
    '输出JSON结构：{"items":[{"id":"", "heatScore":0, "heatLevel":"low"}]}',
    '仅返回JSON，不要其他文本。'
  ].join('\n')
  const rows = items.slice(0, 16).map((item) => ({
    id: item.id,
    title: item.title,
    snippet: item.snippet,
    url: item.url
  }))
  try {
    const completion = await llmClient.chat.completions.create({
      model: LLM_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(rows) }
      ]
    })
    const text = completion.choices[0]?.message?.content
    if (!text) {
      return null
    }
    const payload = JSON.parse(text) as unknown
    const record = asRecord(payload)
    const list = Array.isArray(record?.items) ? record.items : []
    const map = new Map<string, { heatScore: number; heatLevel: 'low' | 'medium' | 'high' }>()
    for (const row of list) {
      const item = asRecord(row)
      if (!item) {
        continue
      }
      const id = asString(item.id)
      const rawLevel = asString(item.heatLevel).toLowerCase()
      const score = toScore(asNumber(item.heatScore))
      if (!id) {
        continue
      }
      const level = rawLevel === 'high' || rawLevel === 'medium' || rawLevel === 'low' ? rawLevel : toHeatLevel(score)
      map.set(id, { heatScore: score, heatLevel: level })
    }
    return map
  } catch {
    return null
  }
}

async function applyHeatScores(keyword: string, items: PlatformHotspotItem[]) {
  if (items.length === 0) {
    return items
  }
  const llmScores = await scoreWithLlm(keyword, items)
  return items.map((item) => {
    const scored = llmScores?.get(item.id)
    if (scored) {
      return {
        ...item,
        heatScore: scored.heatScore,
        heatLevel: scored.heatLevel
      }
    }
    return {
      ...item,
      ...scoreByRule(keyword, item)
    }
  })
}

function sanitizeRawItems(rows: RawItem[], baseUrl: string) {
  return rows
    .map((row) => ({
      title: cleanText(row.title ?? ''),
      url: toAbsoluteUrl(cleanText(row.url ?? ''), baseUrl),
      snippet: cleanText(row.snippet ?? '')
    }))
    .filter((row) => row.title.length > 3 && row.url)
    .slice(0, 8)
}

function filterBingNoise(rows: RawItem[]) {
  const denyWords = ['outlook', 'onenote', 'onedrive', 'powerpoint', 'microsoft365', 'bing壁纸']
  return rows
    .filter((row) => {
      const title = row.title.toLowerCase()
      const snippet = row.snippet.toLowerCase()
      const url = row.url.toLowerCase()
      if (denyWords.some((word) => title.includes(word) || url.includes(word) || snippet.includes(word))) {
        return false
      }
      if (url.includes('go.microsoft.com/fwlink') || url.includes('form=hpcapt')) {
        return false
      }
      return title.length >= 6
    })
    .slice(0, 8)
}

async function extractWithLlm(platformLabel: string, keyword: string, rawContent: string, baseUrl: string) {
  if (!llmClient) {
    return []
  }
  const content = rawContent.slice(0, 12000)
  const prompt = [
    '你是热点抓取助手，需要从网页或JSON原始数据中抽取热点。',
    `平台：${platformLabel}`,
    `关键词：${keyword}`,
    `baseUrl：${baseUrl}`,
    '输出JSON结构：{"items":[{"title":"", "url":"", "snippet":""}]}。',
    '仅返回JSON，不要其他文字。URL尽量给绝对地址。'
  ].join('\n')
  try {
    const completion = await llmClient.chat.completions.create({
      model: LLM_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content }
      ]
    })
    const text = completion.choices[0]?.message?.content
    if (!text) {
      return []
    }
    const parsed = safeJsonParse(text)
    if (!parsed || !Array.isArray(parsed.items)) {
      return []
    }
    return sanitizeRawItems(parsed.items, baseUrl)
  } catch {
    return []
  }
}

async function fetchWithLlmPreferred(
  platformLabel: string,
  keyword: string,
  url: string,
  baseUrl: string,
  fallbackTransform: (raw: string) => RawItem[]
) {
  if (llmClient) {
    try {
      const rawForLlm = await fetchText(url)
      const llmRows = await extractWithLlm(platformLabel, keyword, rawForLlm, baseUrl)
      if (llmRows.length > 0) {
        return llmRows
      }
    } catch {
    }
  }
  const rawForFallback = await fetchText(url)
  return fallbackTransform(rawForFallback)
}

async function fetchTwitter(keyword: string): Promise<RawItem[]> {
  const url = `https://nitter.net/search?f=tweets&q=${encodeURIComponent(keyword)}`
  return fetchWithLlmPreferred('Twitter', keyword, url, 'https://nitter.net', (raw) => pickHtmlAnchors(raw, 'https://nitter.net', 8))
}

async function fetchBing(keyword: string): Promise<RawItem[]> {
  const rssUrl = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}&format=rss`
  const htmlUrl = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}`
  if (llmClient) {
    try {
      const rawForLlm = await fetchText(htmlUrl)
      const llmRows = await extractWithLlm('Bing', keyword, rawForLlm, 'https://www.bing.com')
      const cleanedLlmRows = filterBingNoise(llmRows)
      if (cleanedLlmRows.length > 0) {
        return cleanedLlmRows
      }
    } catch {
    }
  }
  try {
    const rawForFallback = await fetchText(rssUrl)
    const xmlRows = pickXmlItems(rawForFallback, 12)
    if (xmlRows.length > 0) {
      return xmlRows.slice(0, 8)
    }
  } catch {
  }
  try {
    const rawHtml = await fetchText(htmlUrl)
    const htmlRows = pickHtmlAnchors(rawHtml, 'https://www.bing.com', 24)
    const cleanedHtmlRows = filterBingNoise(htmlRows)
    if (cleanedHtmlRows.length > 0) {
      return cleanedHtmlRows
    }
    return htmlRows.slice(0, 8)
  } catch {
    return []
  }
}

async function fetchGoogle(keyword: string): Promise<RawItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
  return fetchWithLlmPreferred('Google News', keyword, url, 'https://news.google.com', (raw) => pickXmlItems(raw, 8))
}

async function fetchDuckDuckGo(keyword: string): Promise<RawItem[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`
  return fetchWithLlmPreferred('DuckDuckGo', keyword, url, 'https://duckduckgo.com', (raw) => pickHtmlAnchors(raw, 'https://duckduckgo.com', 8))
}

async function fetchHackerNews(keyword: string): Promise<RawItem[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story`
  return fetchWithLlmPreferred('HackerNews', keyword, url, 'https://news.ycombinator.com', (raw) => {
    const payload = JSON.parse(raw) as unknown
    const root = asRecord(payload)
    const hits = Array.isArray(root?.hits) ? root.hits : []
    const rows: RawItem[] = []
    for (const hit of hits) {
      const item = asRecord(hit)
      if (!item) {
        continue
      }
      const title = asString(item.title)
      const itemUrl = asString(item.url)
      if (!title || !itemUrl) {
        continue
      }
      rows.push({ title, url: itemUrl, snippet: asString(item.story_text) })
      if (rows.length >= 8) {
        break
      }
    }
    return rows
  })
}

async function fetchSogou(keyword: string): Promise<RawItem[]> {
  const url = `https://www.sogou.com/web?query=${encodeURIComponent(keyword)}`
  return fetchWithLlmPreferred('搜狗', keyword, url, 'https://www.sogou.com', (raw) => pickHtmlAnchors(raw, 'https://www.sogou.com', 8))
}

async function fetchBilibili(keyword: string): Promise<RawItem[]> {
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&page_size=10&keyword=${encodeURIComponent(keyword)}`
  return fetchWithLlmPreferred('B站', keyword, url, 'https://www.bilibili.com', (raw) => {
    const payload = JSON.parse(raw) as unknown
    const record = asRecord(payload)
    const data = asRecord(record?.data)
    const list = Array.isArray(data?.result) ? data?.result : []
    const rows: RawItem[] = []
    for (const row of list) {
      const item = asRecord(row)
      if (!item) {
        continue
      }
      const title = asString(item.title)
      const bvid = asString(item.bvid)
      const itemUrl = bvid ? `https://www.bilibili.com/video/${bvid}` : ''
      const snippet = asString(item.description)
      if (!title || !itemUrl) {
        continue
      }
      rows.push({ title, url: itemUrl, snippet })
      if (rows.length >= 8) {
        break
      }
    }
    return rows
  })
}

async function fetchWeibo(keyword: string): Promise<RawItem[]> {
  const url = 'https://weibo.com/ajax/side/hotSearch'
  return fetchWithLlmPreferred('微博', keyword, url, 'https://s.weibo.com', (raw) => {
    const payload = JSON.parse(raw) as unknown
    const root = asRecord(payload)
    const data = asRecord(root?.data)
    const realTime = asRecord(data?.realtime)
    const list = Array.isArray(realTime?.list) ? realTime.list : []
    const rows: RawItem[] = []
    for (const row of list) {
      const item = asRecord(row)
      if (!item) {
        continue
      }
      const title = asString(item.word)
      const itemUrl = title ? `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}` : ''
      if (!title || !itemUrl) {
        continue
      }
      if (keyword && !title.toLowerCase().includes(keyword.toLowerCase())) {
        continue
      }
      rows.push({
        title,
        url: itemUrl,
        snippet: asString(item.note)
      })
      if (rows.length >= 8) {
        break
      }
    }
    return rows
  })
}

const sources: SourceDefinition[] = [
  { id: 'twitter', label: 'Twitter', needApiKey: true, run: fetchTwitter },
  { id: 'bing', label: 'Bing', needApiKey: false, run: fetchBing },
  { id: 'google', label: 'Google', needApiKey: false, run: fetchGoogle },
  { id: 'duckduckgo', label: 'DuckDuckGo', needApiKey: false, run: fetchDuckDuckGo },
  { id: 'hackernews', label: 'HackerNews', needApiKey: false, run: fetchHackerNews },
  { id: 'sogou', label: '搜狗', needApiKey: false, run: fetchSogou },
  { id: 'bilibili', label: 'B站', needApiKey: false, run: fetchBilibili },
  { id: 'weibo', label: '微博', needApiKey: false, run: fetchWeibo }
]

const sourceMap = new Map<PlatformId, SourceDefinition>(sources.map((source) => [source.id, source]))
const options: PlatformOption[] = sources.map((source) => ({ id: source.id, label: source.label, needApiKey: source.needApiKey }))

function normalizePlatforms(input?: PlatformId[]) {
  const base = Array.isArray(input) ? input : schedule.selectedPlatforms
  const unique = Array.from(new Set(base.filter((item) => sourceMap.has(item))))
  return unique.length > 0 ? unique : [...schedule.selectedPlatforms]
}

function applyScheduleConfig(input: { keywords?: string[]; selectedPlatforms?: PlatformId[] }) {
  if (Array.isArray(input.keywords)) {
    schedule.keywords = normalizeKeywords(input.keywords)
  }
  if (Array.isArray(input.selectedPlatforms)) {
    const nextPlatforms = normalizePlatforms(input.selectedPlatforms)
    schedule.selectedPlatforms = nextPlatforms
  }
}

function dedupeItems(items: PlatformHotspotItem[]) {
  const map = new Map<string, PlatformHotspotItem>()
  for (const item of items) {
    const key = `${item.url}::${item.title}`
    const exists = map.get(key)
    if (!exists || item.heatScore > exists.heatScore) {
      map.set(key, item)
    }
  }
  return Array.from(map.values())
}

async function fetchAll(input?: { keyword?: string; selectedPlatforms?: PlatformId[] }) {
  const keywords = typeof input?.keyword === 'string'
    ? [normalizeKeyword(input.keyword)]
    : normalizeKeywords(schedule.keywords)
  const selected = normalizePlatforms(input?.selectedPlatforms)
  const batches = await Promise.all(
    selected.map(async (platform): Promise<PlatformBatch> => {
      const source = sourceMap.get(platform)
      if (!source) {
        return {
          platform,
          platformLabel: platform,
          needApiKey: false,
          success: false,
          error: '平台未配置',
          items: []
        }
      }
      const collected: PlatformHotspotItem[] = []
      const errors: string[] = []
      for (const keyword of keywords) {
        try {
          const rows = await source.run(keyword)
          const items = await applyHeatScores(keyword, mapItems(source, rows))
          collected.push(...items)
        } catch (error) {
          errors.push(error instanceof Error ? error.message : '抓取失败')
        }
      }
      try {
        const items = dedupeItems(collected).slice(0, 24)
        return {
          platform: source.id,
          platformLabel: source.label,
          needApiKey: source.needApiKey,
          success: items.length > 0,
          error: items.length > 0 ? '' : errors[0] ?? '未抓取到有效数据',
          items
        }
      } catch (error) {
        return {
          platform: source.id,
          platformLabel: source.label,
          needApiKey: source.needApiKey,
          success: false,
          error: error instanceof Error ? error.message : '抓取失败',
          items: []
        }
      }
    })
  )
  latestBatches = batches
  latestItems = batches.flatMap((batch) => batch.items)
  schedule.lastFetchedAt = new Date().toISOString()
  schedule.nextRunAt = schedule.enabled ? new Date(Date.now() + schedule.intervalMinutes * 60_000).toISOString() : null
}

function rebuildTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (!schedule.enabled) {
    schedule.nextRunAt = null
    return
  }
  schedule.nextRunAt = new Date(Date.now() + schedule.intervalMinutes * 60_000).toISOString()
  timer = setInterval(() => {
    void triggerFetch()
  }, schedule.intervalMinutes * 60_000)
  timer.unref()
}

export async function triggerFetch() {
  if (schedule.isRunning) {
    return snapshotPlatformHotspots()
  }
  schedule.isRunning = true
  try {
    await fetchAll()
  } finally {
    schedule.isRunning = false
  }
  return snapshotPlatformHotspots()
}

export async function triggerFetchWithConfig(input: { keyword?: string; selectedPlatforms?: PlatformId[] }) {
  if (schedule.isRunning) {
    return snapshotPlatformHotspots()
  }
  schedule.isRunning = true
  try {
    await fetchAll(input)
  } finally {
    schedule.isRunning = false
  }
  return snapshotPlatformHotspots()
}

export function updateSchedule(input: { enabled?: boolean; intervalMinutes?: number; keywords?: string[]; selectedPlatforms?: PlatformId[] }) {
  if (typeof input.enabled === 'boolean') {
    schedule.enabled = input.enabled
  }
  if (typeof input.intervalMinutes === 'number') {
    if (!Number.isInteger(input.intervalMinutes) || input.intervalMinutes < MIN_INTERVAL_MINUTES || input.intervalMinutes > MAX_INTERVAL_MINUTES) {
      throw new Error(`intervalMinutes 必须为 ${MIN_INTERVAL_MINUTES}-${MAX_INTERVAL_MINUTES} 的整数`)
    }
    schedule.intervalMinutes = input.intervalMinutes
  }
  applyScheduleConfig(input)
  rebuildTimer()
  return snapshotPlatformHotspots()
}

export function snapshotPlatformHotspots(): PlatformSnapshot {
  return {
    options,
    items: latestItems,
    batches: latestBatches,
    schedule: { ...schedule }
  }
}

export function startPlatformScheduler() {
  rebuildTimer()
  void triggerFetch()
}
