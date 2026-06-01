import { lookupEquityVsRange } from './equityTable'
import type { IcmDeltas } from './nashSolver'
import type { NashResult } from './nashSolver'
import type { HandId } from '../data/pushFoldData'
import { ALL_HAND_IDS, handStrength } from '../data/pushFoldData'
import { handIdToCombos } from './cards'

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface HandEvTableEntry {
  handId: HandId
  ev: number          // ICM-adjustierter Push-EV (Delta vs Fold)
  row: number         // 0–12 im 13×13 Grid
  col: number         // 0–12 im 13×13 Grid
}

export interface HandEvPoint {
  width: number       // 0–100: Villain Call Range Breite (%)
  ev: number          // EV(push) in Payout-Einheit
}

export interface RangeCorrelationPoint {
  callPct: number     // 0–100: Villain Call Range (%)
  pushPct: number     // 0–100: Hero Push Range (%)
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

/** Wie nashSolver.ts/rangeWeight — Summe der Kombos × Frequenz. */
function rangeWeight(range: Map<HandId, number>): number {
  let total = 0
  for (const [id, freq] of range) {
    total += handIdToCombos(id).length * freq
  }
  return total
}

const MAX_COMBOS = 1326  // C(52,2)

/** Sortiert alle 169 HandIds absteigend nach Handstärke (einmalig). */
const HANDS_BY_STRENGTH: HandId[] = [...ALL_HAND_IDS].sort(
  (a, b) => handStrength(b) - handStrength(a),
)

/**
 * Baut eine Range aus den stärksten W% aller 169 Hände.
 * W=0 → leere Range, W=100 → alle Hände.
 */
function buildTopRange(widthPct: number): Map<HandId, number> {
  const n = Math.round((widthPct / 100) * HANDS_BY_STRENGTH.length)
  return new Map(HANDS_BY_STRENGTH.slice(0, n).map(id => [id, 1.0]))
}

// ─── Feature 1: Hand EV Table ─────────────────────────────────────────────────

/**
 * Konvertiert das Nash-Solver-Ergebnis in Einträge für das 13×13 Grid.
 * Verwendet pushRange — jede Hand erhält row/col-Position und ihren Push-EV.
 * O(169) reine Map-Lookups, kein Equity-Recalc.
 */
export function getHandEvTableData(nashResult: NashResult): HandEvTableEntry[] {
  return ALL_HAND_IDS.map(id => {
    const entry = nashResult.pushRange.get(id)
    const ev = entry?.ev ?? 0

    // Row/Col aus Hand-ID ableiten (identisch zu getHandId in SpotAnalyzer)
    const r1 = RANKS.indexOf(id[0] as typeof RANKS[number])
    const isPair   = id.length === 2
    const isSuited = id.endsWith('s')
    const r2 = isPair ? r1 : RANKS.indexOf(id[1] as typeof RANKS[number])
    const row = isPair ? r1 : (isSuited ? r1 : r2)
    const col = isPair ? r1 : (isSuited ? r2 : r1)

    return { handId: id, ev, row, col }
  })
}

// ─── Feature 2: Hand EV Chart ─────────────────────────────────────────────────

/**
 * Berechnet EV(push) für eine konkrete Hero-Hand über alle Villain-Call-Range-Breiten.
 *
 * Algorithmus:
 *   Für W ∈ {0, 5, 10, …, 100}:
 *     1. callRange = stärkste W% der 169 Hände (nach handStrength)
 *     2. eq = lookupEquityVsRange(heroHand, callRange)
 *     3. pCall = rangeWeight(callRange) / 1326
 *     4. evPush = (1-pCall)·Δ_winPot + pCall·[eq·Δ_winCall + (1-eq)·Δ_loseCall]
 *
 * Interpretation:
 *   W=0  → Villain callt nie  → evPush = Δ_winPot (Pot immer gewonnen)
 *   W=100 → Villain callt immer → evPush = eq·Δ_winCall + (1-eq)·Δ_loseCall
 *
 * Performance: 21 Breiten × ~50 Lookup-Einträge = ~1.000 Equity-Lookups (Cache-warm: <5ms).
 */
export function getHandEvChartData(
  heroHand: HandId,
  deltas: IcmDeltas,
): HandEvPoint[] {
  const points: HandEvPoint[] = []

  for (let w = 0; w <= 100; w += 5) {
    const callRange = buildTopRange(w)
    const eq = lookupEquityVsRange(heroHand, callRange)
    const callW = rangeWeight(callRange)
    const pCall = Math.min(1, callW / MAX_COMBOS)
    const evPush = (1 - pCall) * deltas.winPot
      + pCall * (eq * deltas.winCall + (1 - eq) * deltas.loseCall)

    points.push({ width: w, ev: evPush })
  }

  return points
}

// ─── Feature 3: Range Correlation Chart ──────────────────────────────────────

/**
 * Berechnet die Nash-Gleichgewichtskurve: für jede Villain-Call-Range-Breite W
 * wird ermittelt, wie groß Hero's profitables Push-Set ist.
 *
 * Algorithmus:
 *   Für W ∈ {0, 5, 10, …, 100}:
 *     1. callRange = stärkste W% Hände
 *     2. Für jede der 169 heroHände: evPush = EV(push,hand) vs callRange
 *     3. pushPct = |{h : evPush > 0}| / 169 × 100
 *
 * Der Nash-Gleichgewichtspunkt (nashCallPct, nashPushPct) liegt auf dieser Kurve
 * an der Stelle, wo Villain's Call-Range optimal auf Hero's Push-Range antwortet.
 *
 * Performance: 21 × 169 = 3.549 lookupEquityVsRange-Aufrufe.
 *   Cache-warm: ~18ms (Map-Lookups).
 *   Cache-kalt: kann 10–60 Sekunden dauern → immer in setTimeout(0) aufrufen.
 */
export function getRangeCorrelationData(
  deltas: IcmDeltas,
  nashCallPct: number,
  nashPushPct: number,
): { points: RangeCorrelationPoint[]; nashPoint: { callPct: number; pushPct: number } } {
  const points: RangeCorrelationPoint[] = []

  for (let w = 0; w <= 100; w += 5) {
    const callRange = buildTopRange(w)
    const callW = rangeWeight(callRange)
    const pCall = Math.min(1, callW / MAX_COMBOS)

    let pushCount = 0
    for (const heroHand of ALL_HAND_IDS) {
      const eq = lookupEquityVsRange(heroHand, callRange)
      const evPush = (1 - pCall) * deltas.winPot
        + pCall * (eq * deltas.winCall + (1 - eq) * deltas.loseCall)
      if (evPush > 0) pushCount++
    }

    points.push({
      callPct: w,
      pushPct: Math.round((pushCount / ALL_HAND_IDS.length) * 1000) / 10,
    })
  }

  return {
    points,
    nashPoint: { callPct: nashCallPct, pushPct: nashPushPct },
  }
}
