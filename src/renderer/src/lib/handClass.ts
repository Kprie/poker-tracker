import type { Card } from './cards'
import { FULL_DECK, drawRandom } from './cards'
import { eval7 } from './handEval'

// ─── Handklassen-Verteilung ───────────────────────────────────────────────────
// Kategorie-Index = Math.floor(eval-Score / 13^5), passend zu handEval:
//   0 High Card · 1 Paar · 2 Zwei Paare · 3 Drilling · 4 Straße · 5 Flush ·
//   6 Full House · 7 Vierling · 8 Straight Flush
const T = 371293  // 13^5

export const CATEGORY_NAMES = [
  'High Card', 'Paar', 'Zwei Paare', 'Drilling', 'Straße',
  'Flush', 'Full House', 'Vierling', 'Straight Flush',
] as const

export interface HandClassResult {
  /** Anteil je Kategorie (Index 0–8), Summe = 1. */
  dist: number[]
  /** true = vollständige Enumeration, false = Monte Carlo. */
  isExact: boolean
  sampleCount: number
}

function category(score: number): number {
  return Math.min(8, Math.floor(score / T))
}

/**
 * Verteilung der finalen Handkategorie des Heros über alle Runouts.
 * Board-Länge → Methode (analog computeExactEquity): River direkt, Turn/Flop exakt,
 * Preflop Monte Carlo.
 */
export function handClassDistribution(
  hole: readonly [Card, Card],
  board: readonly Card[],
  iterations = 10_000,
): HandClassResult {
  const dist = new Array<number>(9).fill(0)
  const known = new Set<Card>([hole[0], hole[1], ...board])
  const avail = FULL_DECK.filter(c => !known.has(c))
  const need = 5 - board.length

  const add = (full: readonly Card[]): void => {
    dist[category(eval7([hole[0], hole[1], ...full]))]++
  }

  let count = 0
  let isExact = true

  if (need <= 0) {
    add(board.slice(0, 5)); count = 1
  } else if (need === 1) {
    for (const c of avail) { add([...board, c]); count++ }
  } else if (need === 2) {
    for (let i = 0; i < avail.length; i++)
      for (let j = i + 1; j < avail.length; j++) { add([...board, avail[i], avail[j]]); count++ }
  } else {
    isExact = false
    for (let it = 0; it < iterations; it++) { add([...board, ...drawRandom(avail, need)]); count++ }
  }

  for (let k = 0; k < 9; k++) dist[k] /= count
  return { dist, isExact, sampleCount: count }
}
