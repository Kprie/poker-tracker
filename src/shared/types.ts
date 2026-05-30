// Shared types used by both main and renderer processes.

export type PokerSource = 'pokerstars' | 'ggpoker'

/** A single normalized tournament result from either site. */
export interface Tournament {
  /** Stable unique id (source + native tournament id). */
  id: string
  source: PokerSource
  /** Native tournament id from the site, if available. */
  tournamentId: string
  name: string
  /** e.g. "Hold'em No Limit", "PLO". */
  gameType: string
  /** Derived speed bucket: regular | turbo | hyper | unknown. */
  speed: TournamentSpeed
  currency: string
  /** Buy-in portion that goes into the prize pool. */
  buyIn: number
  /** Rake / fee portion. */
  fee: number
  /** buyIn + fee, multiplied by entries (incl. re-entries/rebuys/addons). */
  totalCost: number
  /** ISO 8601 start timestamp. */
  startDate: string
  /** Number of entrants in the tournament (field size), if known. */
  fieldSize: number | null
  /** Finishing place of the hero, if known. */
  finishPlace: number | null
  /** Total amount won (prize + bounties). */
  payout: number
  /** Bounty/knockout winnings included in payout, if applicable. */
  bounty: number
  reEntries: number
  rebuys: number
  addons: number
  /** payout - totalCost. */
  profit: number
}

export type TournamentSpeed = 'regular' | 'turbo' | 'hyper' | 'unknown'

export interface ImportResult {
  source: PokerSource
  added: number
  updated: number
  skipped: number
  errors: string[]
}

export interface AppSettings {
  /** User-selected PokerStars tournament summary folder. */
  pokerStarsPath: string | null
}

export interface AppData {
  settings: AppSettings
  tournaments: Tournament[]
}

export interface PokerStarsScanResult extends ImportResult {
  path: string
  filesScanned: number
}
