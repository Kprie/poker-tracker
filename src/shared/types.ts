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
  /**
   * True when the money result (payout/finish place) is known — i.e. it came
   * from a tournament summary. Records built only from hand histories know the
   * buy-in but not the payout, so they are excluded from profit/ROI/ITM stats.
   */
  resultKnown: boolean
  /** Aggregated hero play stats, present when hand histories were imported. */
  handStats?: HandStatsAgg
}

export type TournamentSpeed = 'regular' | 'turbo' | 'hyper' | 'unknown'

/**
 * Aggregated hero hand-history stats for one tournament. All fields are raw
 * counts so they can be summed across tournaments; rates are derived in the UI.
 */
export interface HandStatsAgg {
  /** Hero screen name detected from the "Dealt to" line. */
  hero: string
  /** Total hands the hero was dealt into. */
  hands: number
  /** Hands where hero voluntarily put money in pot preflop (call/bet/raise). */
  vpip: number
  /** Hands where hero raised preflop. */
  pfr: number
  /** Hands where hero faced a preflop raise and could re-raise. */
  threeBetOpp: number
  /** Hands where hero 3-bet (re-raised) preflop. */
  threeBet: number
  /** Hands where hero saw the flop. */
  sawFlop: number
  /** Hands where hero went to showdown. */
  wtsd: number
  /** Hands where hero won money at showdown. */
  wonSd: number
  /** Hands where hero won any pot. */
  wonHand: number
  /** Postflop aggressive actions (bets + raises). */
  aggActions: number
  /** Postflop passive calls. */
  callActions: number

  // ── Erweiterte Aktionsstatistiken (deterministisch aus Aktionssequenzen) ──
  /** Hände, in denen Hero preflop ein 3-Bet vor sich hatte (konnte 4-betten). */
  fourBetOpp: number
  /** Hände, in denen Hero preflop 4-bet (Re-Raise auf ein 3-Bet). */
  fourBet: number
  /** Hände, in denen Hero preflop raiste und danach ein Re-Raise (3-Bet) vor sich hatte. */
  foldTo3BetOpp: number
  /** Hände, in denen Hero auf das 3-Bet foldete. */
  foldTo3Bet: number
  /** Hände, in denen Hero Preflop-Aggressor war und den Flop sah (C-Bet-Gelegenheit). */
  cbetFlopOpp: number
  /** Hände, in denen Hero den Flop ge-c-bettet hat. */
  cbetFlop: number
  /** Hände, in denen Hero (nicht PFA) am Flop eine C-Bet vor sich hatte. */
  foldToCbetOpp: number
  /** Hände, in denen Hero die C-Bet am Flop foldete. */
  foldToCbet: number
  /** Hände, in denen Hero am Flop checkte und danach eine Bet vor sich hatte (Check-Raise-Gelegenheit). */
  checkRaiseFlopOpp: number
  /** Hände, in denen Hero am Flop check-raiste. */
  checkRaiseFlop: number
}

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
  /**
   * Folder where the tracker stores its data file (poker-data.json). Resolved
   * absolute path; defaults to the app's userData folder. The pointer itself is
   * kept separately so it survives even when the data file moves.
   */
  dataDir?: string
}

export interface AppData {
  settings: AppSettings
  tournaments: Tournament[]
}

export interface PokerStarsScanResult extends ImportResult {
  path: string
  filesScanned: number
}
