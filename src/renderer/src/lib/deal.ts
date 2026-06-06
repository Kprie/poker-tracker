import { computeIcmEquities } from './icm'

// ─── Deal-/Chop-Rechner ───────────────────────────────────────────────────────
// Vergleicht zwei gängige Verteilungsmodelle für einen Turnier-Deal:
//   • Chip-Chop: jeder sichert den kleinsten der verteilten Plätze, der Rest des
//     Prizepools wird proportional zu den Chips verteilt.
//   • ICM-Chop: Verteilung nach Prizepool-Equity (Malmuth-Harville).
// payouts sind absteigend (Platz 1 zuerst). Nur die obersten n Plätze (n = Spieler)
// sind relevant; mehr Plätze als Spieler können nicht ausgezahlt werden.

function sum(a: number[]): number { return a.reduce((x, y) => x + y, 0) }

export interface DealResult {
  chipChop: number[]
  icmChop: number[]
  /** Differenz icmChop − chipChop je Spieler (positiv = ICM zahlt mehr). */
  diff: number[]
}

/** Chip-Chop: garantierter Mindestplatz + proportionaler Rest nach Chips. */
export function chipChop(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length
  const relevant = payouts.slice(0, Math.min(n, payouts.length))
  const sumRel = sum(relevant)
  const total = sum(stacks)
  // Jeder sichert den kleinsten verteilten Platz — nur wenn es mindestens n Plätze gibt.
  const lockable = payouts.length >= n ? (payouts[n - 1] ?? 0) : 0
  const remainder = sumRel - lockable * n
  return stacks.map(s => lockable + (total > 0 ? (remainder * s) / total : sumRel / n))
}

/** ICM-Chop nach Prizepool-Equity. */
export function icmChop(stacks: number[], payouts: number[]): number[] {
  return computeIcmEquities(stacks, payouts)
}

export function computeDeal(stacks: number[], payouts: number[]): DealResult {
  const cc = chipChop(stacks, payouts)
  const ic = icmChop(stacks, payouts)
  return { chipChop: cc, icmChop: ic, diff: ic.map((v, i) => v - cc[i]) }
}

// ─── Satellite / Ticket-EV ────────────────────────────────────────────────────
// Im Satellite mit `tickets` gleichwertigen Plätzen zählt nur das Überleben in die
// Top-`tickets`. Ticket-Equity = ICM mit gleichen Auszahlungen (= P(Top-tickets) ×
// Ticketwert). Über einem „sicheren Stack" hat zusätzliche Chipakkumulation kaum
// Wert — dann können selbst sehr starke Hände korrekt gefoldet werden.

export interface SatelliteResult {
  /** Ticket-Equity je Spieler (0–ticketValue). */
  ticketEquity: number[]
  /** Anteil des maximalen Ticketwerts je Spieler (0–1). */
  lockPct: number[]
}

export function satelliteEquities(
  stacks: number[],
  tickets: number,
  ticketValue = 1,
): SatelliteResult {
  const payouts = Array.from({ length: tickets }, () => ticketValue)
  const eq = computeIcmEquities(stacks, payouts)
  return { ticketEquity: eq, lockPct: eq.map(e => (ticketValue > 0 ? e / ticketValue : 0)) }
}

/**
 * Gilt ein Spieler als „praktisch gesichert" (Any-two-Fold-Kandidat)? Wenn seine
 * Ticket-Equity sehr nah am vollen Ticketwert liegt, bringt zusätzliche Equity fast
 * nichts — riskante Spots sind dann vermeidbar.
 */
export function isEffectivelyLocked(lockPct: number, threshold = 0.95): boolean {
  return lockPct >= threshold
}
