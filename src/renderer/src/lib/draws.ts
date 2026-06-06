import type { Card } from './cards'
import { cardRank, cardSuit } from './cards'

// ─── Draw-Detektion (Flop/Turn) ───────────────────────────────────────────────
// Erkennt Flush- und Straßen-Draws aus Hole-Cards + Board (3 oder 4 Karten).
// „Outs" beziehen sich auf die kombinierte Hand (Hole + Board), wie im Equity-Kontext üblich.

export interface DrawInfo {
  flushDraw: boolean
  nutFlushDraw: boolean
  /** Anzahl der Ränge, die eine Straße vervollständigen. */
  straightOuts: number
  straightType: 'oesd' | 'gutshot' | 'none'
  madeFlush: boolean
  madeStraight: boolean
  /** Hole-Karten über der höchsten Boardkarte (nur unpaired aussagekräftig). */
  overcards: number
}

function hasStraight(present: boolean[]): boolean {
  for (let hi = 4; hi <= 12; hi++) {
    if (present[hi] && present[hi - 1] && present[hi - 2] && present[hi - 3] && present[hi - 4]) return true
  }
  // Wheel A-2-3-4-5: A=12, 2=0, 3=1, 4=2, 5=3
  return present[12] && present[0] && present[1] && present[2] && present[3]
}

/** Erkennt Draws für eine Hole-Hand auf einem Flop/Turn (3–4 Boardkarten). */
export function detectDraws(hole: readonly [Card, Card], board: readonly Card[]): DrawInfo {
  const all = [hole[0], hole[1], ...board]

  // ── Flush ──
  const suitCount = [0, 0, 0, 0]
  for (const c of all) suitCount[cardSuit(c)]++
  const holeSuits = new Set(hole.map(cardSuit))
  let flushDraw = false, madeFlush = false, nutFlushDraw = false
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) madeFlush = true
    else if (suitCount[s] === 4 && holeSuits.has(s)) {
      flushDraw = true
      // Nut-Flush-Draw: Hero hält das Ass dieser Farbe.
      if (hole.some(c => cardSuit(c) === s && cardRank(c) === 12)) nutFlushDraw = true
    }
  }

  // ── Straße ──
  const present = new Array<boolean>(13).fill(false)
  for (const c of all) present[cardRank(c)] = true
  const madeStraight = hasStraight(present)
  let straightOuts = 0
  if (!madeStraight) {
    for (let r = 0; r < 13; r++) {
      if (present[r]) continue
      present[r] = true
      if (hasStraight(present)) straightOuts++
      present[r] = false
    }
  }
  const straightType: DrawInfo['straightType'] =
    madeStraight ? 'none' : straightOuts >= 2 ? 'oesd' : straightOuts === 1 ? 'gutshot' : 'none'

  // ── Overcards ──
  const topBoard = Math.max(...board.map(cardRank))
  const overcards = hole.filter(c => cardRank(c) > topBoard).length

  return { flushDraw, nutFlushDraw, straightOuts, straightType, madeFlush, madeStraight, overcards }
}

/** Deutsche Kurz-Labels der erkannten Draws (für die Anzeige). */
export function drawLabels(d: DrawInfo): string[] {
  const out: string[] = []
  if (d.madeFlush) out.push('Flush')
  else if (d.nutFlushDraw) out.push('Nut-Flush-Draw')
  else if (d.flushDraw) out.push('Flush-Draw')
  if (d.madeStraight) out.push('Straße')
  else if (d.straightType === 'oesd') out.push('OESD')
  else if (d.straightType === 'gutshot') out.push('Gutshot')
  if (!d.madeFlush && !d.madeStraight && d.overcards === 2) out.push('2 Overcards')
  return out
}
