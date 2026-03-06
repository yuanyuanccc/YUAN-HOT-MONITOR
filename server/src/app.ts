import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { analyzeHotspot } from './ai.js'
import { snapshotPlatformHotspots, startPlatformScheduler, triggerFetchWithConfig, updateSchedule } from './platformHotspots.js'
import { readHistory, writeHistory } from './store.js'
import type { AnalyzeRequest, ConfirmRequest, HotspotRecord, PlatformId } from './types.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/hotspots/history', (_req, res) => {
  const history = readHistory().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  res.json(history)
})

app.get('/api/platform-hotspots', (_req, res) => {
  res.json(snapshotPlatformHotspots())
})

app.post('/api/platform-hotspots/fetch', async (req, res) => {
  const body = (req.body ?? {}) as { keyword?: string; selectedPlatforms?: PlatformId[] }
  const snapshot = await triggerFetchWithConfig(body)
  res.json(snapshot)
})

app.post('/api/platform-hotspots/schedule', (req, res) => {
  const body = (req.body ?? {}) as { enabled?: boolean; intervalMinutes?: number; keywords?: string[]; selectedPlatforms?: PlatformId[] }
  try {
    const snapshot = updateSchedule(body)
    res.json(snapshot)
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : '调度配置更新失败' })
  }
})

app.post('/api/hotspots/analyze', async (req, res) => {
  const body = req.body as Partial<AnalyzeRequest>
  if (!body.keyword || !body.timeRange || !Array.isArray(body.samples)) {
    return res.status(400).json({ message: '参数不完整' })
  }

  const payload: AnalyzeRequest = {
    keyword: body.keyword.trim(),
    timeRange: body.timeRange.trim(),
    samples: body.samples.map((item) => item.trim()).filter(Boolean)
  }

  if (!payload.keyword || !payload.timeRange || payload.samples.length === 0) {
    return res.status(400).json({ message: '请输入有效内容' })
  }

  const analyzed = await analyzeHotspot(payload)
  const result: HotspotRecord = {
    id: randomUUID(),
    ...analyzed,
    createdAt: new Date().toISOString(),
    status: 'pending',
    note: '',
    confirmedAt: null
  }

  const history = readHistory()
  writeHistory([result, ...history])

  return res.status(201).json(result)
})

app.post('/api/hotspots/confirm', (req, res) => {
  const body = req.body as Partial<ConfirmRequest>
  if (!body.analysisId || !body.status || !body.note) {
    return res.status(400).json({ message: '参数不完整' })
  }

  if (!['approved', 'rejected'].includes(body.status)) {
    return res.status(400).json({ message: '状态不合法' })
  }

  const history = readHistory()
  const index = history.findIndex((item) => item.id === body.analysisId)
  if (index === -1) {
    return res.status(404).json({ message: '记录不存在' })
  }

  const updated: HotspotRecord = {
    ...history[index],
    status: body.status,
    note: body.note.trim(),
    confirmedAt: new Date().toISOString()
  }
  history[index] = updated
  writeHistory(history)
  return res.json(updated)
})

startPlatformScheduler()

export { app }
