import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { AppData, AppSettings, Tournament } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  pokerStarsPath: null
}

function dataFilePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'poker-data.json')
}

/** Candidate default locations for PokerStars tournament summaries on Windows. */
export function detectPokerStarsPath(): string | null {
  const home = homedir()
  const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
  const docs = join(home, 'Documents')
  const clients = ['PokerStars', 'PokerStarsEU', 'PokerStars.EU', 'PokerStarsNET', 'PokerStars.NET']
  const candidates: string[] = []
  for (const c of clients) {
    candidates.push(join(localAppData, c, 'TournSummary'))
    candidates.push(join(docs, c, 'TournSummary'))
  }
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

let cache: AppData | null = null

export function loadData(): AppData {
  if (cache) return cache
  const file = dataFilePath()
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf-8')) as AppData
      cache = {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        tournaments: parsed.tournaments ?? []
      }
      return cache
    } catch {
      // fall through to fresh data on corrupt file
    }
  }
  cache = {
    settings: { ...DEFAULT_SETTINGS, pokerStarsPath: detectPokerStarsPath() },
    tournaments: []
  }
  saveData(cache)
  return cache
}

export function saveData(data: AppData): void {
  cache = data
  writeFileSync(dataFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export function getSettings(): AppSettings {
  return loadData().settings
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const data = loadData()
  data.settings = { ...data.settings, ...patch }
  saveData(data)
  return data.settings
}

export function getTournaments(): Tournament[] {
  return loadData().tournaments
}

/**
 * Merge new tournaments into storage, de-duplicating by id.
 * Returns counts of added vs updated records.
 */
export function upsertTournaments(incoming: Tournament[]): { added: number; updated: number } {
  const data = loadData()
  const byId = new Map(data.tournaments.map((t) => [t.id, t]))
  let added = 0
  let updated = 0
  for (const t of incoming) {
    if (byId.has(t.id)) {
      byId.set(t.id, t)
      updated++
    } else {
      byId.set(t.id, t)
      added++
    }
  }
  data.tournaments = [...byId.values()].sort((a, b) => a.startDate.localeCompare(b.startDate))
  saveData(data)
  return { added, updated }
}

export function clearTournaments(source?: Tournament['source']): void {
  const data = loadData()
  data.tournaments = source ? data.tournaments.filter((t) => t.source !== source) : []
  saveData(data)
}
