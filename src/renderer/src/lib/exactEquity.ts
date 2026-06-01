import type { Card } from './cards'
import { FULL_DECK } from './cards'
import { eval5, eval7 } from './handEval'

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface ExactEquityResult {
  win: number           // Gewinn-Anteil 0–1
  tie: number           // Unentschieden-Anteil 0–1
  lose: number          // Verlust-Anteil 0–1
  outs: Card[]          // Karten, die Hero gewinnen lassen (Turn/River)
  sampleCount: number   // Anzahl ausgewerteter Boards
  isExact: boolean      // true = vollständige Enumeration; false = MC-Näherung
}

// ─── Exakte Equity-Berechnung ─────────────────────────────────────────────────

/**
 * Berechnet Equity für zwei konkrete Hände mit optionalem (Teil-)Board.
 *
 * Board-Länge → Methode:
 *   0 (Preflop):     Monte Carlo 20.000 Iters  (SE < 0.4 %)
 *   3 (Flop):        Exakte Enumeration C(45,2) = 990 Boards
 *   4 (Turn):        Exakte Enumeration C(44,1) = 44 Boards
 *   5 (River):       Direkte Auswertung, 1 Board
 */
export function computeExactEquity(
  hero: [Card, Card],
  villain: [Card, Card],
  board: Card[],
): ExactEquityResult {
  const known = new Set<Card>([hero[0], hero[1], villain[0], villain[1], ...board])
  const remaining = FULL_DECK.filter(c => !known.has(c))
  const need = 5 - board.length

  // ── River: direkte Auswertung ─────────────────────────────────────────────
  if (need === 0) {
    const s1 = eval7([hero[0], hero[1], board[0], board[1], board[2], board[3], board[4]])
    const s2 = eval7([villain[0], villain[1], board[0], board[1], board[2], board[3], board[4]])
    return { win: s1 > s2 ? 1 : 0, tie: s1 === s2 ? 1 : 0, lose: s1 < s2 ? 1 : 0, outs: [], sampleCount: 1, isExact: true }
  }

  // ── Turn → River: exakte Enumeration ─────────────────────────────────────
  if (need === 1) {
    let wins = 0, ties = 0
    const outs: Card[] = []
    const n = remaining.length
    for (const c of remaining) {
      const s1 = eval7([hero[0], hero[1], board[0], board[1], board[2], board[3], c])
      const s2 = eval7([villain[0], villain[1], board[0], board[1], board[2], board[3], c])
      if (s1 > s2) { wins++; outs.push(c) }
      else if (s1 === s2) ties++
    }
    return { win: wins / n, tie: ties / n, lose: (n - wins - ties) / n, outs, sampleCount: n, isExact: true }
  }

  // ── Flop → Turn+River: exakte Enumeration C(r,2) ─────────────────────────
  if (need === 2) {
    let wins = 0, ties = 0, total = 0
    const r = remaining
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const s1 = eval7([hero[0], hero[1], board[0], board[1], board[2], r[i], r[j]])
        const s2 = eval7([villain[0], villain[1], board[0], board[1], board[2], r[i], r[j]])
        if (s1 > s2) wins++
        else if (s1 === s2) ties++
        total++
      }
    }
    return { win: wins / total, tie: ties / total, lose: (total - wins - ties) / total, outs: [], sampleCount: total, isExact: true }
  }

  // ── Preflop: MC 20.000 Iterationen (SE < 0.4 %) ──────────────────────────
  const iters = 20_000
  const deck = remaining.slice()   // Kopie für in-place Shuffle
  let wins = 0, ties = 0
  for (let i = 0; i < iters; i++) {
    // Partial Fisher-Yates: erste 5 Positionen zufällig
    for (let k = 0; k < 5; k++) {
      const j = k + Math.floor(Math.random() * (deck.length - k))
      const t = deck[k]; deck[k] = deck[j]; deck[j] = t
    }
    // board.length kann 0–2 sein (theoretisch); fullBoard = board + gezogene Karten
    const drawn = deck.slice(0, need)
    const fb = [...board, ...drawn] as unknown as [Card, Card, Card, Card, Card]
    const s1 = eval7([hero[0], hero[1], fb[0], fb[1], fb[2], fb[3], fb[4]])
    const s2 = eval7([villain[0], villain[1], fb[0], fb[1], fb[2], fb[3], fb[4]])
    if (s1 > s2) wins++
    else if (s1 === s2) ties++
  }
  return { win: wins / iters, tie: ties / iters, lose: (iters - wins - ties) / iters, outs: [], sampleCount: iters, isExact: false }
}

// ─── Hand-Bewertung ───────────────────────────────────────────────────────────

/**
 * Bester Hand-Score aus 5–7 Karten.
 * Unter 5 Karten: -1 (nicht auswertbar).
 */
export function bestHandScore(cards: Card[]): number {
  const n = cards.length
  if (n < 5) return -1
  if (n === 5) return eval5(cards[0], cards[1], cards[2], cards[3], cards[4])
  if (n === 6) {
    let best = 0
    for (let skip = 0; skip < 6; skip++) {
      const f = cards.filter((_, i) => i !== skip)
      const s = eval5(f[0], f[1], f[2], f[3], f[4])
      if (s > best) best = s
    }
    return best
  }
  return eval7(cards.slice(0, 7))
}

const RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/**
 * Gibt den deutschen Namen der Handkategorie zurück (inkl. Rang).
 * Dekodiert den score aus eval5 / eval7 (Encoding: cat × 371293 + kicker).
 */
export function handRankName(score: number): string {
  if (score < 0) return '—'
  const T = 371293
  const B = 13
  const cat = Math.floor(score / T)
  const rem = score % T
  switch (cat) {
    case 8: return rem === 12 ? 'Royal Flush' : `Straight Flush bis ${RANK_NAMES[rem]}`
    case 7: return `Vierling ${RANK_NAMES[Math.floor(rem / B)]}s`
    case 6: return `Full House: ${RANK_NAMES[Math.floor(rem / B)]} voll ${RANK_NAMES[rem % B]}`
    case 5: return `Flush, ${RANK_NAMES[Math.floor(rem / 28561)]} hoch`
    case 4: return rem === 3 ? 'Straight: A-2-3-4-5' : `Straight bis ${RANK_NAMES[rem]}`
    case 3: return `Drilling ${RANK_NAMES[Math.floor(rem / 169)]}s`
    case 2: {
      const hi = Math.floor(rem / 169)
      const lo = Math.floor((rem % 169) / B)
      return `Zwei Paare: ${RANK_NAMES[hi]} und ${RANK_NAMES[lo]}`
    }
    case 1: return `Paar ${RANK_NAMES[Math.floor(rem / 2197)]}s`
    default: return `High Card ${RANK_NAMES[Math.floor(rem / 28561)]}`
  }
}
