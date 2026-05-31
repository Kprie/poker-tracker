import type { AppSettings, ImportResult, PokerSource, PokerStarsScanResult, Tournament } from '../shared/types'

export interface PokerApi {
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  getTournaments: () => Promise<Tournament[]>
  clearData: (source?: PokerSource) => Promise<Tournament[]>
  choosePokerStarsFolder: () => Promise<string | null>
  chooseDataFolder: () => Promise<AppSettings>
  scanPokerStars: () => Promise<PokerStarsScanResult>
  importGGPoker: () => Promise<ImportResult>
}

declare global {
  interface Window {
    api: PokerApi
  }
}
