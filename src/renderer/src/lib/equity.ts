import type { Card } from './cards'
import { drawRandom, FULL_DECK, handIdToCombos } from './cards'
import { eval7 } from './handEval'
import type { HandEntry, PushFoldSpot } from '../data/pushFoldData'
import { ALL_HAND_IDS } from '../data/pushFoldData'

export interface RangeCombo {
  cards: [Card, Card]
  /** Nash-Frequenz 0–1. 1.0 = immer; 0.6 = 60 % der Zeit. */
  weight: number
}

/**
 * Baut die Calling-Range eines Villains aus einem PushFoldSpot.
 * Hände mit ev > 0 sind im Call enthalten; Mixed-Strategy-Hände mit freq ≠ null anteilig.
 * hero_cards werden als blockiert ausgeschlossen.
 */
export function buildCallingRange(spot: PushFoldSpot, heroCards: [Card, Card]): RangeCombo[] {
  const blocked = new Set<Card>(heroCards)
  const result: RangeCombo[] = []

  for (const id of ALL_HAND_IDS) {
    const entry: HandEntry | null = spot.hands[id] ?? null
    if (entry === null || entry.ev === null || entry.ev <= 0) continue

    const weight = entry.freq !== null ? entry.freq / 100 : 1.0

    for (const [c1, c2] of handIdToCombos(id)) {
      if (blocked.has(c1) || blocked.has(c2)) continue
      result.push({ cards: [c1, c2], weight })
    }
  }

  return result
}

export interface EquityResult {
  /** Equity des Heros (0–1). Ties zählen als 0.5. */
  equity: number
  /** Standardabweichung der Schätzung. */
  stdDev: number
  /** Anteil der Villain-Hände (gewichtet), die diesen Spot callen. */
  callFraction: number
  /** Anzahl MC-Iterationen. */
  iterations: number
}

/**
 * Monte-Carlo-Equity: Heros konkrete Hand vs Villain-Range (preflop All-in).
 * Algorithmus: pick random weighted villain combo → shuffle 5 Board-Karten → eval7 beide.
 * Konfidenzintervall: ±1.96 × stdDev ≈ 95 %-Intervall.
 *
 * @param heroCards  Die zwei konkreten Karten des Heros
 * @param range      Villain-Range aus buildCallingRange
 * @param iterations Anzahl MC-Samples (2000 ≈ <100 ms, Fehler ±~2 %)
 */
export function computeEquityMC(
  heroCards: [Card, Card],
  range: RangeCombo[],
  iterations = 2000,
): EquityResult {
  if (range.length === 0) return { equity: 0.5, stdDev: 0, callFraction: 0, iterations: 0 }

  // Gewichtete Sampling-Tabelle (alias method wäre optimal; hier direkte weighted-pick)
  const totalWeight = range.reduce((s, r) => s + r.weight, 0)

  // callFraction: gewichtete Combo-Summe / verfügbare Villain-Combos (C(50,2)=1225 nach Hero-Blocking)
  const weightedCombos = range.reduce((s, r) => s + r.weight, 0)
  const callFraction = Math.min(1, weightedCombos / 1225)

  // Deck ohne Hero-Karten
  const deckWithoutHero = FULL_DECK.filter(c => c !== heroCards[0] && c !== heroCards[1])

  let wins = 0
  let ties = 0

  for (let i = 0; i < iterations; i++) {
    // Gewichtetes Ziehen eines Villain-Combos
    let rnd = Math.random() * totalWeight
    let villain = range[0].cards
    for (const combo of range) {
      rnd -= combo.weight
      if (rnd <= 0) { villain = combo.cards; break }
    }

    // Board aus verbleibendem Deck (ohne Hero + Villain)
    const available = deckWithoutHero.filter(c => c !== villain[0] && c !== villain[1])
    const board = drawRandom(available, 5)

    const heroScore = eval7([heroCards[0], heroCards[1], ...board])
    const villScore = eval7([villain[0],   villain[1],   ...board])

    if (heroScore > villScore) wins++
    else if (heroScore === villScore) ties++
  }

  const equity = (wins + ties * 0.5) / iterations
  // Binomial-Standardabweichung
  const stdDev = Math.sqrt((equity * (1 - equity)) / iterations)

  return { equity, stdDev, callFraction, iterations }
}

/** ICM-Equity-Szenarien nach einem Push-/Fold-Entscheid. */
export interface IcmScenarios {
  /** Equity wenn Hero jetzt foldet (unveränderter Zustand). */
  fold: number
  /** Equity wenn Hero pushed und alle anderen folden (gewinnt Blinds + Antes). */
  pushWinBlinds: number
  /** Equity wenn Hero pushed, gecallt wird und gewinnt. */
  pushCallWin: number
  /** Equity wenn Hero pushed, gecallt wird und verliert. */
  pushCallLose: number
}

/**
 * Berechnet ICM-Equity für alle 4 Push-Szenarien.
 *
 * @param stacks      Chip-Stacks aller Spieler (Index 0 = Hero)
 * @param payouts     Auszahlungen
 * @param bbSize      Wert eines Big Blinds in Chips
 * @param ante        Ante pro Spieler (0 = kein Ante)
 * @param callerIdx   Index des wahrscheinlichsten Callers (typischerweise BB)
 */
export function computeIcmScenarios(
  stacks: number[],
  payouts: number[],
  bbSize: number,
  ante: number,
  callerIdx: number,
  computeEquities: (s: number[], p: number[]) => number[],
): IcmScenarios {
  const n = stacks.length
  const heroIdx = 0

  // Pot = SB + BB + alle Antes
  const pot = Math.round(bbSize * 1.5) + ante * n

  // A: Fold — keine Änderung
  const fold = computeEquities(stacks, payouts)[heroIdx]

  // B: Push, alle folden — Hero gewinnt pot
  const sB = [...stacks]
  sB[heroIdx] += pot
  const pushWinBlinds = computeEquities(sB, payouts)[heroIdx]

  // C: Push, gecallt, Hero gewinnt — Hero übernimmt Callers Stack (bis Hero-Stack)
  const effectivePot = Math.min(stacks[heroIdx], stacks[callerIdx])
  const sC = [...stacks]
  sC[heroIdx] = stacks[heroIdx] + effectivePot + pot
  sC[callerIdx] = Math.max(0, stacks[callerIdx] - effectivePot)
  const pushCallWin = computeEquities(sC, payouts)[heroIdx]

  // D: Push, gecallt, Hero verliert — Caller übernimmt Heroes Stack
  const sD = [...stacks]
  sD[callerIdx] = stacks[callerIdx] + effectivePot + pot
  sD[heroIdx] = Math.max(0, stacks[heroIdx] - effectivePot)
  const pushCallLose = computeEquities(sD, payouts)[heroIdx]

  return { fold, pushWinBlinds, pushCallWin, pushCallLose }
}
