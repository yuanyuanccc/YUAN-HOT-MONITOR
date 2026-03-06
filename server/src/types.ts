export type AnalyzeRequest = {
  keyword: string
  timeRange: string
  samples: string[]
}

export type AnalyzeResult = {
  id: string
  title: string
  summary: string
  score: number
  riskLevel: 'low' | 'medium' | 'high'
  actions: string[]
  createdAt: string
}

export type ConfirmRequest = {
  analysisId: string
  status: 'approved' | 'rejected'
  note: string
}

export type HotspotRecord = AnalyzeResult & {
  status: 'pending' | 'approved' | 'rejected'
  note: string
  confirmedAt: string | null
}

export type PlatformId = 'twitter' | 'bing' | 'google' | 'duckduckgo' | 'hackernews' | 'sogou' | 'bilibili' | 'weibo'

export type PlatformHotspotItem = {
  id: string
  platform: PlatformId
  platformLabel: string
  title: string
  url: string
  snippet: string
  heatLevel: 'low' | 'medium' | 'high'
  heatScore: number
  fetchedAt: string
}

export type PlatformOption = {
  id: PlatformId
  label: string
  needApiKey: boolean
}

export type PlatformBatch = {
  platform: PlatformId
  platformLabel: string
  needApiKey: boolean
  success: boolean
  error: string
  items: PlatformHotspotItem[]
}

export type PlatformSchedule = {
  enabled: boolean
  intervalMinutes: number
  keywords: string[]
  selectedPlatforms: PlatformId[]
  lastFetchedAt: string | null
  nextRunAt: string | null
  isRunning: boolean
}

export type PlatformDailyTop = {
  items: PlatformHotspotItem[]
  lastFetchedAt: string | null
  nextRunAt: string | null
  isRunning: boolean
}

export type PlatformSnapshot = {
  options: PlatformOption[]
  items: PlatformHotspotItem[]
  batches: PlatformBatch[]
  schedule: PlatformSchedule
  dailyTop: PlatformDailyTop
}
