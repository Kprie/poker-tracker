import { dialog, ipcMain } from 'electron'
import AdmZip from 'adm-zip'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { extname, join } from 'path'
import type { AppSettings, ImportResult, PokerStarsScanResult, Tournament } from '../shared/types'
import { parseGGPokerSummaries } from './parsers/ggpoker'
import { parsePokerStarsSummaries } from './parsers/pokerstars'
import {
  aggregateHands,
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

  // Let the user pick the PokerStars TournSummary folder.
  ipcMain.handle('pokerstars:choose-folder', async () => {
    const res = await dialog.showOpenDialog({
      title: 'PokerStars TournSummary-Ordner wählen',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    updateSettings({ pokerStarsPath: path })
    return path
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
          const parsed = parsePokerStarsSummaries(content)
          if (parsed.length === 0) base.skipped++
          collected.push(...parsed)
        }
      } catch (err) {
        base.errors.push(`${file}: ${(err as Error).message}`)
      }
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
