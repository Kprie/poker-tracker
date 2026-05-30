import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  ImportResult,
  PokerSource,
  PokerStarsScanResult,
  Tournament
} from '../shared/types'

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', patch),
  getTournaments: (): Promise<Tournament[]> => ipcRenderer.invoke('tournaments:get'),
  clearData: (source?: PokerSource): Promise<Tournament[]> =>
    ipcRenderer.invoke('data:clear', source),
  choosePokerStarsFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('pokerstars:choose-folder'),
  scanPokerStars: (): Promise<PokerStarsScanResult> => ipcRenderer.invoke('pokerstars:scan'),
  importGGPoker: (): Promise<ImportResult> => ipcRenderer.invoke('ggpoker:import')
}

export type PokerApi = typeof api

contextBridge.exposeInMainWorld('api', api)
