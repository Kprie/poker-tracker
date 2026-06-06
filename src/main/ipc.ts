import { dialog, ipcMain } from 'electron'
import AdmZip from 'adm-zip'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { anonymizeForExport } from './exportUtil'
import { loadData } from './store'
import { extname, join } from 'path'
import type { AppSettings, ImportResult, PokerStarsScanResult, Tournament } from '../shared/types'
import { parseGGPokerSummaries } from './parsers/ggpoker'
import { parsePokerStarsSummaries } from './parsers/pokerstars'
import {
  aggregateHands,
  dominantHero,
  isPokerStarsHandHistory,
  parsePokerStarsHands,
  type HandResult
} from './parsers/pokerstars-hh'

/** Recursively collect .txt file paths under a directory (depth-limited). */
function walkTxtFiles(dir: string, depth = 0, acc: string[] = []): string[] {
  if (depth > 6) return acc
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of names) {
    const full = join(dir, name)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (isDir) walkTxtFiles(full, depth + 1, acc)
    else if (extname(name).toLowerCase() === '.txt') acc.push(full)
  }
  return acc
}
import {
  clearTournaments,
  getSettings,
  getTournaments,
  setDataDir,
  updateSettings,
  upsertTournaments
} from './store'

function readTextFilesFromZip(zipPath: string): string[] {
  const zip = new AdmZip(zipPath)
  return zip
    .getEntries()
    .filter((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith('.txt'))
    .map((e) => e.getData().toString('utf-8'))
}

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:update', (_e, patch: Partial<AppSettings>) => updateSettings(patch))

  ipcMain.handle('tournaments:get', () => getTournaments())

  ipcMain.handle('data:clear', (_e, source?: Tournament['source']) => {
    clearTournaments(source)
    return getTournaments()
  })

  // Exportiert die eigenen Daten anonymisiert (ohne Spielernamen) als JSON-Datei.
  ipcMain.handle('data:export', async () => {
    const res = await dialog.showSaveDialog({
      title: 'Anonymisierten Export speichern',
      defaultPath: `poker-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false as const }
    try {
      writeFileSync(res.filePath, JSON.stringify(anonymizeForExport(loadData()), null, 2), 'utf-8')
      return { ok: true as const, path: res.filePath }
    } catch (e) {
      return { ok: false as const, error: (e as Error).message }
    }
  })

  // Let the user pick the PokerStars TournSummary folder.
  ipcMain.handle('pokerstars:choose-folder', async () => {
    const res = await dialog.showOpenDialog({
      title: 'PokerStars-Ordner wählen (z. B. PokerStars.DE\\)',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    updateSettings({ pokerStarsPath: path })
    return path
  })

  // Let the user choose the folder where tracked data is stored.
  ipcMain.handle('data:choose-dir', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Ordner für getrackte Daten wählen',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return getSettings()
    setDataDir(res.filePaths[0])
    return getSettings()
  })

  // Scan the configured PokerStars folder for *.txt summaries and import them.
  ipcMain.handle('pokerstars:scan', (): PokerStarsScanResult => {
    const settings = getSettings()
    const path = settings.pokerStarsPath
    const base: PokerStarsScanResult = {
      source: 'pokerstars',
      path: path ?? '',
      filesScanned: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: []
    }
    if (!path || !existsSync(path)) {
      base.errors.push('Pfad existiert nicht oder ist nicht gesetzt.')
      return base
    }

    const collected: Tournament[] = []
    const handResults: HandResult[] = []
    const summaryContents: string[] = []
    const files = walkTxtFiles(path)

    for (const file of files) {
      try {
        base.filesScanned++
        const content = readFileSync(file, 'utf-8')
        // Auto-detect: hand history (per-hand actions) vs tournament summary.
        if (isPokerStarsHandHistory(content)) {
          const hands = parsePokerStarsHands(content)
          if (hands.length === 0) base.skipped++
          handResults.push(...hands)
        } else {
          summaryContents.push(content)
        }
      } catch (err) {
        base.errors.push(`${file}: ${(err as Error).message}`)
      }
    }

    // Learn the hero name from hand histories first, then use it to locate the
    // hero in tournament summaries (needed for German PokerStars.DE files).
    const heroName = dominantHero(handResults) ?? undefined
    for (const content of summaryContents) {
      const parsed = parsePokerStarsSummaries(content, heroName)
      if (parsed.length === 0) base.skipped++
      collected.push(...parsed)
    }

    // Aggregate hands across ALL files once (de-duped by hand id) so a
    // tournament spread over multiple table files is counted correctly.
    collected.push(...aggregateHands(handResults))

    const { added, updated } = upsertTournaments(collected)
    base.added = added
    base.updated = updated
    return base
  })

  // Import GGPoker PokerCraft export(s): a .zip of summaries or individual .txt files.
  ipcMain.handle('ggpoker:import', async (): Promise<ImportResult> => {
    const res = await dialog.showOpenDialog({
      title: 'GGPoker PokerCraft-Export wählen (.zip oder .txt)',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'PokerCraft Export', extensions: ['zip', 'txt'] },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    })
    const result: ImportResult = {
      source: 'ggpoker',
      added: 0,
      updated: 0,
      skipped: 0,
      errors: []
    }
    if (res.canceled || res.filePaths.length === 0) return result

    const contents: string[] = []
    for (const file of res.filePaths) {
      try {
        if (extname(file).toLowerCase() === '.zip') {
          contents.push(...readTextFilesFromZip(file))
        } else {
          contents.push(readFileSync(file, 'utf-8'))
        }
      } catch (err) {
        result.errors.push(`${file}: ${(err as Error).message}`)
      }
    }

    const collected: Tournament[] = []
    for (const content of contents) {
      const parsed = parseGGPokerSummaries(content)
      if (parsed.length === 0) result.skipped++
      collected.push(...parsed)
    }

    const { added, updated } = upsertTournaments(collected)
    result.added = added
    result.updated = updated
    return result
  })
}
