import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { HotspotRecord } from './types.js'

const dataDir = path.join(process.cwd(), 'data')
const historyFile = path.join(dataDir, 'history.json')

function ensureStore() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  if (!existsSync(historyFile)) {
    writeFileSync(historyFile, '[]', 'utf-8')
  }
}

export function readHistory(): HotspotRecord[] {
  ensureStore()
  const raw = readFileSync(historyFile, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as HotspotRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeHistory(records: HotspotRecord[]) {
  ensureStore()
  writeFileSync(historyFile, JSON.stringify(records, null, 2), 'utf-8')
}
