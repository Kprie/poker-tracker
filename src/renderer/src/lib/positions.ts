import type { Position } from '../data/pushFoldData'

// ─── Positions-Modell für Push/Fold ───────────────────────────────────────────
//
// Der strategisch entscheidende Effekt der Position im Open-Jam-Spot ist die
// Anzahl der Spieler, die NACH Hero noch handeln (Fold Equity / mögliche Caller).
// Späte Position (BTN) → wenige Responder → weite Range; frühe Position (UTG) →
// viele Responder → enge Range.
//
// `SEATS_BEHIND` ist der feste Abstand jeder Position zum BB (BB=0, SB=1, BTN=2,
// …). Über die tatsächliche Spielerzahl wird auf players−1 gekappt. Konvention:
// Hero ist immer Sitz 0 (Akteur, jammt zuerst). Die Spieler VOR Hero haben bereits
// gefoldet (kein Post, aber weiterhin im ICM über die vollen Stacks). Die Blinds
// (SB/BB) sind die letzten zwei aktiven Sitze.

const SEATS_BEHIND: Record<Position, number> = {
  BB: 0,
  SB: 1,
  BTN: 2,
  CO: 3,
  HJ: 4,
  'UTG+1': 5,
  UTG: 6,
}

export interface SeatLayout {
  /** Anzahl Responder hinter Hero (Spieler, die nach Heros Jam handeln). ≥1. */
  nBehind: number
  /** Aktive Sitze im Spot: [Hero=0, …Responder]. Länge = nBehind+1. */
  active: number[]
  /** Post (Blind+Ante) je Sitz, sitz-indiziert über alle `players`. */
  posts: number[]
}

/**
 * Leitet aus Position + Spielerzahl die aktiven Sitze und die Post-Struktur ab.
 * Gefoldete Sitze (vor Hero) posten 0; die letzten zwei aktiven Sitze posten SB/BB.
 */
export function seatLayoutForPosition(
  position: Position,
  players: number,
  bbSize: number,
  ante: number,
): SeatLayout {
  const behind = SEATS_BEHIND[position] ?? players - 1
  // Mindestens 1 Responder (sonst kein Spot), maximal alle übrigen Spieler.
  const nBehind = Math.min(Math.max(1, behind), players - 1)
  const activeLen = nBehind + 1
  const active = Array.from({ length: activeLen }, (_, i) => i)

  const posts = Array.from({ length: players }, () => 0)
  for (let i = 0; i < activeLen; i++) posts[i] = ante
  if (activeLen - 2 >= 0) posts[activeLen - 2] += Math.round(bbSize * 0.5)  // SB
  posts[activeLen - 1] += bbSize                                            // BB

  return { nBehind, active, posts }
}
