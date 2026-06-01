import { computeIcmEquities } from './icm'
import { lookupEquityVsRange } from './equityTable'
import type { HandId } from '../data/pushFoldData'
import { ALL_HAND_IDS } from '../data/pushFoldData'
import { handIdToCombos } from './cards'  // for rangeWeight

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface NashHandResult {
  handId: HandId
  /** EV von Push/Call minus EV von Fold, in Payout-Einheit. Positiv = Aktion besser. */
  ev: number
  /** Nash-Frequenz 0–1. 1 = immer pushen/callen, 0 = nie. */
  freq: number
  /** Equity dieser Hand gegen die Villain-Range (0–1). */
  equity: number
}

export interface NashResult {
  pushRange: Map<HandId, NashHandResult>   // Hände, die Hero pushen sollte
  callRange: Map<HandId, NashHandResult>   // Hände, die Villain callen sollte
  converged: boolean
  iterations: number
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Gesamtgewicht einer Range (Summe über Kombos × Frequenz).
 * Wird für die Berechnung von P(call) benötigt.
 */
function rangeWeight(range: Map<HandId, number>): number {
  let total = 0
  for (const [id, freq] of range) {
    const combos = handIdToCombos(id).length
    total += combos * freq
  }
  return total
}

/** Maximale mögliche Villain-Kombos (ohne Hero-Blocking). */
const MAX_COMBOS = 1326  // C(52,2)

// ─── ICM-Szenario-Berechnung ──────────────────────────────────────────────────

export interface IcmDeltas {
  /** ICM-Equity-Zunahme wenn Hero den Pot gewinnt (alle folden). */
  winPot: number
  /** ICM-Equity-Zunahme wenn Hero gecallt wird und gewinnt. */
  winCall: number
  /** ICM-Equity-Veränderung wenn Hero gecallt wird und verliert (negativ). */
  loseCall: number
  /** Aktuelle ICM-Equity des Heroes. */
  currentEq: number
}

export function computeIcmDeltas(
  stacks: number[],
  payouts: number[],
  heroIdx: number,
  callerIdx: number,
  bbSize: number,
  ante: number,
): IcmDeltas {
  const n = stacks.length
  const pot = Math.round(bbSize * 1.5) + ante * n
  const currentEq = computeIcmEquities(stacks, payouts)[heroIdx]

  // Szenario: Alle folden — Hero gewinnt Pot
  const sWinPot = [...stacks]
  sWinPot[heroIdx] += pot
  const eqWinPot = computeIcmEquities(sWinPot, payouts)[heroIdx]

  // Szenario: Gecallt + gewonnen
  const eff = Math.min(stacks[heroIdx], stacks[callerIdx])
  const sWinCall = [...stacks]
  sWinCall[heroIdx] = stacks[heroIdx] + eff + pot
  sWinCall[callerIdx] = Math.max(0, stacks[callerIdx] - eff)
  const eqWinCall = computeIcmEquities(sWinCall, payouts)[heroIdx]

  // Szenario: Gecallt + verloren
  const sLoseCall = [...stacks]
  sLoseCall[callerIdx] = stacks[callerIdx] + eff + pot
  sLoseCall[heroIdx] = Math.max(0, stacks[heroIdx] - eff)
  const eqLoseCall = computeIcmEquities(sLoseCall, payouts)[heroIdx]

  return {
    winPot: eqWinPot - currentEq,
    winCall: eqWinCall - currentEq,
    loseCall: eqLoseCall - currentEq,
    currentEq,
  }
}

// ─── Nash-Solver ──────────────────────────────────────────────────────────────

export interface NashInput {
  /** Chip-Stacks aller Spieler. Index 0 = Hero. */
  stacks: number[]
  payouts: number[]
  bbSize: number
  ante: number
  /** Index des wahrscheinlichsten Callers (typisch BB = Index 1). */
  callerIdx?: number
  maxIterations?: number
  convergenceThreshold?: number
}

/**
 * Iterativer Nash-Push/Fold-Solver via Alternating Best Response.
 *
 * Algorithmus:
 *   1. Initialisiere Call-Range = Nash-Approximation (alle Hände mit Stärke > 0.5)
 *   2. Für jede Hero-Hand: berechne EV(push) via Equity vs Call-Range + ICM
 *   3. Setze Push-Range = {h : EV(push,h) > 0}
 *   4. Für jede Villain-Hand: berechne EV(call) via Equity vs Push-Range + ICM
 *   5. Setze Call-Range = {v : EV(call,v) > 0}
 *   6. Wiederhole 2–5 bis Konvergenz
 *
 * Anmerkung: Nutzt lookupEquityVsRange aus equityTable.ts.
 * Erster Aufruf berechnet fehlende Equity-Paare on-demand (gecacht).
 */
export function solveNash(input: NashInput): NashResult {
  const {
    stacks,
    payouts,
    bbSize,
    ante,
    callerIdx = 1,
    maxIterations = 12,
    convergenceThreshold = 0.02,
  } = input

  const heroIdx = 0
  const deltas = computeIcmDeltas(stacks, payouts, heroIdx, callerIdx, bbSize, ante)

  // ── Initialisierung ────────────────────────────────────────────────────────
  // Caller startet mit einer weiten Range (alle Hände), Hero-Push-Range leer
  let callRange: Map<HandId, number> = new Map(ALL_HAND_IDS.map(id => [id, 1.0]))
  let pushRange: Map<HandId, number> = new Map()

  const totalCallCombos = MAX_COMBOS
  let converged = false
  let iter = 0

  for (; iter < maxIterations; iter++) {
    // ── Schritt A: Hero-Push-Range ────────────────────────────────────────
    const prevPushSize = pushRange.size
    const newPushRange = new Map<HandId, number>()
    const heroPushResults = new Map<HandId, NashHandResult>()

    for (const hHand of ALL_HAND_IDS) {
      const eq = lookupEquityVsRange(hHand, callRange)

      // P(call): Anteil der Villain-Hände die laut Call-Range callen
      // Gewichtete Call-Kombos / Max-Kombos (ohne Blocking; vereinfacht)
      const callW = rangeWeight(callRange)
      const pCall = Math.min(1, callW / totalCallCombos)
      const pFold = 1 - pCall

      // EV(push) = P(fold) × Δ_winPot + P(call) × [eq × Δ_winCall + (1−eq) × Δ_loseCall]
      const evPush = pFold * deltas.winPot
        + pCall * (eq * deltas.winCall + (1 - eq) * deltas.loseCall)

      heroPushResults.set(hHand, { handId: hHand, ev: evPush, freq: evPush > 0 ? 1 : 0, equity: eq })

      if (evPush > 0) newPushRange.set(hHand, 1.0)
    }
    pushRange = newPushRange

    // ── Schritt B: Villain-Call-Range ─────────────────────────────────────
    const prevCallSize = callRange.size
    const newCallRange = new Map<HandId, number>()
    const villainCallResults = new Map<HandId, NashHandResult>()

    if (pushRange.size > 0) {
      // ICM aus Villain-Sicht (Hero = callerIdx, Villain = heroIdx für diesen Schritt)
      const villainDeltas = computeIcmDeltas(stacks, payouts, callerIdx, heroIdx, bbSize, ante)
      const pushW = rangeWeight(pushRange)

      for (const vHand of ALL_HAND_IDS) {
        // Equity des Villains gegen Hero-Push-Range
        const vilEq = lookupEquityVsRange(vHand, pushRange)

        const pPush = Math.min(1, pushW / totalCallCombos)

        // EV(call) = pPush × [vilEq × Δ_winCall + (1−vilEq) × Δ_loseCall]
        // EV(fold) = 0 (kein Dead Money vom Villain in diesem vereinfachten Modell)
        const evCall = pPush * (vilEq * villainDeltas.winCall + (1 - vilEq) * villainDeltas.loseCall)

        villainCallResults.set(vHand, { handId: vHand, ev: evCall, freq: evCall > 0 ? 1 : 0, equity: vilEq })

        if (evCall > 0) newCallRange.set(vHand, 1.0)
      }
      callRange = newCallRange
    }

    // ── Konvergenz-Check ──────────────────────────────────────────────────
    const pushDelta = Math.abs(pushRange.size - prevPushSize) / ALL_HAND_IDS.length
    const callDelta = Math.abs(callRange.size - prevCallSize) / ALL_HAND_IDS.length
    if (pushDelta < convergenceThreshold && callDelta < convergenceThreshold) {
      converged = true
      iter++
      break
    }
  }

  // ── Finales Ergebnis ──────────────────────────────────────────────────────
  const finalPushResults = new Map<HandId, NashHandResult>()
  for (const hHand of ALL_HAND_IDS) {
    const eq = lookupEquityVsRange(hHand, callRange)
    const callW = rangeWeight(callRange)
    const pCall = Math.min(1, callW / totalCallCombos)
    const pFold = 1 - pCall
    const evPush = pFold * deltas.winPot
      + pCall * (eq * deltas.winCall + (1 - eq) * deltas.loseCall)
    finalPushResults.set(hHand, { handId: hHand, ev: evPush, freq: evPush > 0 ? 1 : 0, equity: eq })
  }

  const finalCallResults = new Map<HandId, NashHandResult>()
  if (pushRange.size > 0) {
    const villainDeltas = computeIcmDeltas(stacks, payouts, callerIdx, heroIdx, bbSize, ante)
    const pushW = rangeWeight(pushRange)
    for (const vHand of ALL_HAND_IDS) {
      const vilEq = lookupEquityVsRange(vHand, pushRange)
      const pPush = Math.min(1, pushW / totalCallCombos)
      const evCall = pPush * (vilEq * villainDeltas.winCall + (1 - vilEq) * villainDeltas.loseCall)
      finalCallResults.set(vHand, { handId: vHand, ev: evCall, freq: evCall > 0 ? 1 : 0, equity: vilEq })
    }
  }

  return {
    pushRange: finalPushResults,
    callRange: finalCallResults,
    converged,
    iterations: iter,
  }
}

// ─── Hilfsfunktion: Nash-Ergebnis für eine spezifische Hand ──────────────────

export function getHandNashResult(
  result: NashResult,
  handId: HandId,
  isHero: boolean,
): NashHandResult | null {
  const map = isHero ? result.pushRange : result.callRange
  return map.get(handId) ?? null
}

