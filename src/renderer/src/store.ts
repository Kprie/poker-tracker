import { create } from 'zustand'
import type { AppSettings, ImportResult, PokerStarsScanResult, Tournament } from '../../shared/types'
import type { Filters } from './lib/analytics'

type PokerApi = Window['api']

// Fallback used when running outside Electron (e.g. browser preview) so the UI
// still renders instead of crashing on a missing api.
const mockApi: PokerApi = {
  getSettings: async () => ({ pokerStarsPath: null }),
  updateSettings: async (p) => ({ pokerStarsPath: null, ...p }),
  getTournaments: async () => [],
  clearData: async () => [],
  choosePokerStarsFolder: async () => null,
  chooseDataFolder: async () => ({ pokerStarsPath: null }),
  scanPokerStars: async (): Promise<PokerStarsScanResult> => ({
    source: 'pokerstars',
    path: '',
    filesScanned: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: ['Nur in der Desktop-App verfügbar.']
  }),
  importGGPoker: async (): Promise<ImportResult> => ({
    source: 'ggpoker',
    added: 0,
    updated: 0,
    skipped: 0,
    errors: ['Nur in der Desktop-App verfügbar.']
  }),
  exportData: async () => ({ ok: false, error: 'Nur in der Desktop-App verfügbar.' })
}

const api: PokerApi = typeof window !== 'undefined' && window.api ? window.api : mockApi

interface State {
  loading: boolean
  busy: string | null
  settings: AppSettings
  tournaments: Tournament[]
  filters: Filters
  toast: { kind: 'ok' | 'err'; msg: string } | null
  lastScan: string | null

  init: () => Promise<void>
  setFilters: (patch: Partial<Filters>) => void
  scanPokerStars: () => Promise<void>
  importGGPoker: () => Promise<void>
  chooseFolder: () => Promise<void>
  chooseDataFolder: () => Promise<void>
  clear: (source?: Tournament['source']) => Promise<void>
  exportData: () => Promise<void>
  setToast: (t: State['toast']) => void
}

export const useStore = create<State>((set, get) => ({
  loading: true,
  busy: null,
  settings: { pokerStarsPath: null },
  tournaments: [],
  filters: { source: 'all', from: null, to: null },
  toast: null,
  lastScan: null,

  init: async () => {
    const [settings, tournaments] = await Promise.all([
      api.getSettings(),
      api.getTournaments()
    ])
    set({ settings, tournaments, loading: false })
  },

  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),

  setToast: (toast) => {
    set({ toast })
    if (toast) setTimeout(() => set((s) => (s.toast === toast ? { toast: null } : {})), 4000)
  },

  scanPokerStars: async () => {
    set({ busy: 'PokerStars wird eingelesen…' })
    try {
      const res = await api.scanPokerStars()
      const tournaments = await api.getTournaments()
      const summary = `${res.filesScanned} Datei(en) gescannt · ${res.added} neu · ${res.updated} aktualisiert${res.skipped ? ` · ${res.skipped} übersprungen` : ''}${res.errors.length ? ` · ${res.errors.length} Fehler` : ''}`
      set({ tournaments, lastScan: `${summary} — ${res.path || 'kein Pfad'}` })
      if (res.errors.length) {
        get().setToast({ kind: 'err', msg: res.errors[0] })
      } else if (res.filesScanned === 0) {
        get().setToast({ kind: 'err', msg: `Keine .txt-Dateien im Ordner gefunden: ${res.path || '(kein Pfad)'}` })
      } else {
        get().setToast({
          kind: 'ok',
          msg: `PokerStars: ${res.added} neu, ${res.updated} aktualisiert (${res.filesScanned} Dateien)`
        })
      }
    } catch (e) {
      set({ lastScan: `Fehler: ${(e as Error).message}` })
      get().setToast({ kind: 'err', msg: (e as Error).message })
    } finally {
      set({ busy: null })
    }
  },

  importGGPoker: async () => {
    set({ busy: 'GGPoker-Export wird importiert…' })
    try {
      const res = await api.importGGPoker()
      const tournaments = await api.getTournaments()
      set({ tournaments })
      if (res.added || res.updated) {
        get().setToast({
          kind: 'ok',
          msg: `GGPoker: ${res.added} neu, ${res.updated} aktualisiert`
        })
      } else if (res.errors.length) {
        get().setToast({ kind: 'err', msg: res.errors[0] })
      }
    } catch (e) {
      get().setToast({ kind: 'err', msg: (e as Error).message })
    } finally {
      set({ busy: null })
    }
  },

  chooseFolder: async () => {
    const path = await api.choosePokerStarsFolder()
    if (path) set({ settings: { ...get().settings, pokerStarsPath: path } })
  },

  chooseDataFolder: async () => {
    const settings = await api.chooseDataFolder()
    set({ settings })
    get().setToast({ kind: 'ok', msg: `Datenordner: ${settings.dataDir ?? 'Standard'}` })
  },

  clear: async (source) => {
    const tournaments = await api.clearData(source)
    set({ tournaments })
    get().setToast({ kind: 'ok', msg: 'Daten gelöscht' })
  },

  exportData: async () => {
    try {
      const res = await api.exportData()
      if (res.ok) get().setToast({ kind: 'ok', msg: `Anonymisiert exportiert: ${res.path ?? ''}` })
      else if (res.error) get().setToast({ kind: 'err', msg: res.error })
    } catch (e) {
      get().setToast({ kind: 'err', msg: (e as Error).message })
    }
  }
}))
