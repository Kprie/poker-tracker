import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { AppData, AppSettings, Tournament, TournamentSpeed } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  pokerStarsPath: null
}

const DATA_FILE = 'poker-data.json'

// --- Data directory pointer ----------------------------------------------
// The location of the data file is itself configurable. We keep that pointer
// in a tiny config.json inside userData so it survives even when the data file
// moves to a user-chosen folder.

interface AppConfig {
  dataDir: string | null
}

function configPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'config.json')
}

function loadConfig(): AppConfig {
  try {
    const cfg = JSON.parse(readFileSync(configPath(), 'utf-8')) as AppConfig
    return { dataDir: cfg.dataDir ?? null }
  } catch {
    return { dataDir: null }
  }
}

function saveConfig(cfg: AppConfig): void {
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf-8')
}

/** Resolved folder where the data file lives (custom dir or userData). */
export function resolveDataDir(): string {
  const custom = loadConfig().dataDir
  if (custom && existsSync(custom)) return custom
  return app.getPath('userData')
}

function dataFilePath(): string {
  const dir = resolveDataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, DATA_FILE)
}

/**
 * Point the tracker at a new data folder. The current in-memory data is written
 * to the new location so nothing is lost; the pointer persists across restarts.
 */
export function setDataDir(newDir: string): string {
  const data = loadData() // current data from the old location
  if (!existsSync(newDir)) mkdirSync(newDir, { recursive: true })
  saveConfig({ dataDir: newDir })
  cache = null // force path re-resolution
  saveData(data) // writes to the new location and repopulates cache
  return resolveDataDir()
}

/** Candidate default locations for PokerStars tournament summaries on Windows. */
export function detectPokerStarsPath(): string | null {
  const home = homedir()
  const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
  const docs = join(home, 'Documents')
  const clients = [
    'PokerStars',
    'PokerStars.DE',
    'PokerStars.EU',
    'PokerStarsEU',
    'PokerStars.UK',
    'PokerStars.FR',
    'PokerStars.ES',
    'PokerStars.PT',
    'PokerStars.IT',
    'PokerStarsNET',
    'PokerStars.NET'
  ]
  const candidates: string[] = []
  // Prefer the client root (contains both HandHistory and TournSummary) so a
  // recursive scan picks up results and play stats in one go.
  for (const c of clients) {
    candidates.push(join(docs, c))
    candidates.push(join(localAppData, c))
  }
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

// Re-derive speed from the tournament name on every load so historical imports
// with wrong defaults are corrected without requiring a re-import.
function migrateSpeed(t: Tournament): TournamentSpeed {
  const n = (t.name ?? '').toLowerCase()
  if (n.includes('hyper')) return 'hyper'
  if (n.includes('turbo')) return 'turbo'
  if (n.includes('regular')) return 'regular'
  return 'unknown'
}

/**
 * Serialisiert AppData, verschlüsselt ruhend via OS-Schlüsselbund (safeStorage,
 * Windows DPAPI), wenn verfügbar. Fällt auf Klartext zurück, wenn nicht. Format
 * bei Verschlüsselung: `{"__enc":1,"v":"<base64>"}`.
 */
function serializeData(data: AppData): string {
  const json = JSON.stringify(data, null, 2)
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return JSON.stringify({ __enc: 1, v: safeStorage.encryptString(json).toString('base64') })
    }
  } catch {
    /* Verschlüsselung nicht verfügbar — Klartext-Fallback. */
  }
  return json
}

/** Liest AppData; entschlüsselt verschlüsselte Dateien, akzeptiert Alt-Klartext. */
function deserializeData(raw: string): AppData {
  const obj = JSON.parse(raw)
  if (obj && obj.__enc === 1 && typeof obj.v === 'string') {
    return JSON.parse(safeStorage.decryptString(Buffer.from(obj.v, 'base64'))) as AppData
  }
  return obj as AppData
}

export function loadData(): AppData {
  if (cache) return cache
  const file = dataFilePath()
  if (existsSync(file)) {
    try {
      const parsed = deserializeData(readFileSync(file, 'utf-8'))
      // Migration: records saved before `resultKnown` existed were all summary
      // imports (payout/finish known), so default missing values to true.
      // Migration: pre-0.4.3 parser defaulted to 'regular' when speed was
      // unknown; re-evaluate based on the name so stored data stays accurate.
      const tournaments = (parsed.tournaments ?? []).map((t) => ({
        ...t,
        resultKnown: t.resultKnown ?? true,
        speed: migrateSpeed(t)
      }))
      cache = {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        tournaments
      }
      saveData(cache)
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
  writeFileSync(dataFilePath(), serializeData(data), 'utf-8')
}

export function getSettings(): AppSettings {
  return { ...loadData().settings, dataDir: resolveDataDir() }
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
 * Combine two records for the same tournament. A summary contributes the money
 * result (payout/finish/field/cost incl. re-entries); a hand-history record
 * contributes play stats and the buy-in. We keep the best of each.
 */
function mergeTournament(a: Tournament, b: Tournament): Tournament {
  // Pick the record that carries the money result as the money base.
  const moneyBase = b.resultKnown ? b : a.resultKnown ? a : b
  const other = moneyBase === b ? a : b
  return {
    ...moneyBase,
    // Prefer a non-"Unknown" game type / richer name.
    gameType: moneyBase.gameType !== 'Unknown' ? moneyBase.gameType : other.gameType,
    name: moneyBase.gameType !== 'Unknown' ? moneyBase.name : other.name,
    speed: moneyBase.speed !== 'unknown' ? moneyBase.speed : other.speed,
    fieldSize: moneyBase.fieldSize ?? other.fieldSize,
    // Keep an earlier known start date if the money base lacks one.
    startDate: earliestValidDate(moneyBase.startDate, other.startDate),
    // Hand stats come from whichever record has them (the HH import).
    handStats: b.handStats ?? a.handStats,
    resultKnown: a.resultKnown || b.resultKnown
  }
}

function earliestValidDate(a: string, b: string): string {
  const epoch = new Date(0).toISOString().slice(0, 10)
  const aValid = a.slice(0, 10) !== epoch
  const bValid = b.slice(0, 10) !== epoch
  if (aValid && bValid) return a < b ? a : b
  return aValid ? a : bValid ? b : a
}

/**
 * Merge new tournaments into storage, de-duplicating and merging by id.
 * Returns counts of added vs updated records.
 */
export function upsertTournaments(incoming: Tournament[]): { added: number; updated: number } {
  const data = loadData()
  const byId = new Map(data.tournaments.map((t) => [t.id, t]))
  let added = 0
  let updated = 0
  for (const t of incoming) {
    const existing = byId.get(t.id)
    if (existing) {
      byId.set(t.id, mergeTournament(existing, t))
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
