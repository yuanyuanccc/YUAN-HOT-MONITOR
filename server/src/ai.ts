import OpenAI from 'openai'
import type { AnalyzeRequest, AnalyzeResult } from './types.js'

const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'
const apiKey = process.env.OPENROUTER_API_KEY

const client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1'
    })
  : null

function safeJsonParse(content: string): Omit<AnalyzeResult, 'id' | 'createdAt'> | null {
  try {
    const parsed = JSON.parse(content) as Omit<AnalyzeResult, 'id' | 'createdAt'>
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function fallbackAnalysis(payload: AnalyzeRequest): Omit<AnalyzeResult, 'id' | 'createdAt'> {
  const hit = payload.samples.join(' ').toLowerCase()
  const score = Math.min(98, 40 + payload.samples.length * 8 + (hit.includes('爆') ? 15 : 0))
  const riskLevel = score > 80 ? 'high' : score > 60 ? 'medium' : 'low'
  return {
    title: `${payload.keyword} 热点趋势分析`,
    summary: `基于 ${payload.timeRange} 时间范围内的样本文本，${payload.keyword} 的传播热度为 ${score}，建议结合人工核验后发布处置结论。`,
    score,
    riskLevel,
    actions: ['核验来源真实性', '准备统一口径回应', '持续监控扩散速度']
  }
}

export async function analyzeHotspot(payload: AnalyzeRequest): Promise<Omit<AnalyzeResult, 'id' | 'createdAt'>> {
  if (!client) {
    return fallbackAnalysis(payload)
  }

  const prompt = [
    '你是热点研判分析师，请根据输入生成结构化JSON。',
    '字段要求：title(string), summary(string), score(number 0-100), riskLevel(low|medium|high), actions(string[])。',
    '只返回JSON，不要额外文本。'
  ].join('\n')

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: JSON.stringify(payload)
      }
    ]
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    return fallbackAnalysis(payload)
  }
  const parsed = safeJsonParse(content)
  if (!parsed) {
    return fallbackAnalysis(payload)
  }
  return parsed
}
