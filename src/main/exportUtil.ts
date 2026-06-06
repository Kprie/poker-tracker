import type { AppData, Tournament } from '../shared/types'

export interface AnonymizedExport {
  exportedAt: string
  tournaments: Tournament[]
}

/**
 * Bereitet die eigenen Turnierdaten für den Export auf und entfernt jegliche
 * Spieler-Identität: der gespeicherte Hero-Screenname in `handStats` wird durch
 * „Hero" ersetzt. Gegnernamen werden ohnehin nie gespeichert. Rein lokale
 * Datenportabilität ohne personenbezogene Bezeichner.
 */
export function anonymizeForExport(data: AppData): AnonymizedExport {
  const tournaments = data.tournaments.map((t) =>
    t.handStats ? { ...t, handStats: { ...t.handStats, hero: 'Hero' } } : t,
  )
  return { exportedAt: new Date().toISOString(), tournaments }
}
