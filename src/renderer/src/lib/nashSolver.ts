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

/** Verfügbare Villain-Kombos nach Abzug der 2 Hero-Karten. */
const VILLAIN_COMBOS = 1225  // C(50,2): alle Villain-Combos nach Abzug der 2 Hero-Karten

// ─── ICM-Szenario-Berechnung ──────────────────────────────────────────────────

export interface IcmDeltas {
  /** ICM-$ von (Shove, Gegner foldet) minus Fold-Knoten. */
  winPot: number
  /** ICM-$ von (Shove, gecallt, gewonnen) minus Fold-Knoten. */
  winCall: number
  /** ICM-$ von (Shove, gecallt, verloren) minus Fold-Knoten (i. d. R. negativ). */
  loseCall: number
  /** ICM-$ des Fold-Knotens (neue Basislinie für alle Deltas). */
  currentEq: number
}

/**
 * ICM-$-Deltas der Push-Knoten **relativ zum Fold-Knoten**.
 *
 * HU (n=2): chip-erhaltendes, exaktes Modell (B6.1).
 *   Konvention: Sitz 0 = SB, Sitz 1 = BB (SpotAnalyzer-Setup). Stacks sind
 *   Pre-Posting-Werte; Posts werden intern abgezogen. Der Entscheider ist
 *   `heroIdx`, der Gegner `callerIdx` — die Funktion wird vom Solver auch mit
 *   vertauschten Indizes (BB-Call-Entscheidung) aufgerufen, daher sind Posts
 *   **sitz-indiziert**, nicht rollen-indiziert.
 *
 * n>2: bisheriges (vereinfachtes, nicht chip-erhaltendes) Modell — wird in
 *   Phase B6.4 durch das multiway-exakte Modell mit Side-Pots und rekursivem
 *   Fold-Baum ersetzt. Siehe plans/01-b6-ev-model.md.
 */
export function computeIcmDeltas(
  stacks: number[],
  payouts: number[],
  heroIdx: number,
  callerIdx: number,
  bbSize: number,
  ante: number,
): IcmDeltas {
  const n = stacks.length

  if (n === 2) {
    const posts = [bbSize * 0.5 + ante, bbSize + ante]  // [SB(Sitz0), BB(Sitz1)]
    const dm = heroIdx    // Entscheider
    const op = callerIdx  // Gegner
    const eff = Math.min(stacks[dm], stacks[op])
    const cfg = (dmStack: number, opStack: number): number[] => {
      const c = [...stacks]
      c[dm] = dmStack
      c[op] = opStack
      return c
    }
    // Fold: Entscheider gibt seinen eigenen Post auf, Gegner gewinnt ihn.
    const foldEq = computeIcmEquities(cfg(stacks[dm] - posts[dm], stacks[op] + posts[dm]), payouts)[dm]
    // Shove + Gegner foldet: Gegner verliert seinen Post an den Entscheider.
    const winPotEq = computeIcmEquities(cfg(stacks[dm] + posts[op], stacks[op] - posts[op]), payouts)[dm]
    // Shove + Call: effektiver Stack-Swap (Blinds/Antes stecken bereits in den Stacks).
    const winCallEq = computeIcmEquities(cfg(stacks[dm] + eff, stacks[op] - eff), payouts)[dm]
    const loseCallEq = computeIcmEquities(cfg(stacks[dm] - eff, stacks[op] + eff), payouts)[dm]

    return {
      winPot: winPotEq - foldEq,
      winCall: winCallEq - foldEq,
      loseCall: loseCallEq - foldEq,
      currentEq: foldEq,
    }
  }

  // ── n > 2: vereinfachtes Alt-Modell (B6.4 ersetzt dies, siehe plans/01) ──
  const pot = Math.round(bbSize * 1.5) + ante * n
  const currentEq = computeIcmEquities(stacks, payouts)[heroIdx]

  const sWinPot = [...stacks]
  sWinPot[heroIdx] += pot
  const eqWinPot = computeIcmEquities(sWinPot, payouts)[heroIdx]

  const eff = Math.min(stacks[heroIdx], stacks[callerIdx])
  const sWinCall = [...stacks]
  sWinCall[heroIdx] = stacks[heroIdx] + eff + pot
  sWinCall[callerIdx] = Math.max(0, stacks[callerIdx] - eff)
  const eqWinCall = computeIcmEquities(sWinCall, payouts)[heroIdx]

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
    maxIterations = 20,
    convergenceThreshold = 0.01,
  } = input

  const heroIdx = 0
  const deltas = computeIcmDeltas(stacks, payouts, heroIdx, callerIdx, bbSize, ante)
  // ICM aus Villain-Sicht (Hero = callerIdx, Villain = heroIdx für den Call-Schritt)
  const villainDeltas = computeIcmDeltas(stacks, payouts, callerIdx, heroIdx, bbSize, ante)

  const totalCallCombos = VILLAIN_COMBOS

  // Fictitious-Play-Dämpfung: statt harter Range-Wechsel (0/1 pro Iteration) werden
  // die Frequenzen kontinuierlich Richtung Best-Response gezogen. Das verhindert die
  // Oszillation, an der reines Alternating Best Response häufig nicht konvergiert.
  const DAMPING = 0.5

  // Kontinuierliche Mit-Frequenz je Hand (0–1). Caller startet weit, Hero leer.
  const callFreq = new Map<HandId, number>(ALL_HAND_IDS.map(id => [id, 1]))
  const pushFreq = new Map<HandId, number>(ALL_HAND_IDS.map(id => [id, 0]))

  // EV des Hero-Pushs einer Hand gegen die aktuelle (gewichtete) Call-Range.
  const heroPushEv = (hHand: HandId, pCall: number): { ev: number; eq: number } => {
    // Repräsentativer Combo der Hand für Karten-Removal in der Gegner-Range.
    const heroRep = handIdToCombos(hHand)[0]
    const eq = lookupEquityVsRange(hHand, callFreq, heroRep)
    const pFold = 1 - pCall
    // EV(push) = P(fold) × Δ_winPot + P(call) × [eq × Δ_winCall + (1−eq) × Δ_loseCall]
    const ev = pFold * deltas.winPot + pCall * (eq * deltas.winCall + (1 - eq) * deltas.loseCall)
    return { ev, eq }
  }

  // EV des Villain-Calls einer Hand gegen die aktuelle (gewichtete) Push-Range.
  const villainCallEv = (vHand: HandId, pPush: number): { ev: number; eq: number } => {
    const vilRep = handIdToCombos(vHand)[0]
    const eq = lookupEquityVsRange(vHand, pushFreq, vilRep)
    // EV(call) = P(push) × [eq × Δ_winCall + (1−eq) × Δ_loseCall], EV(fold) = 0
    const ev = pPush * (eq * villainDeltas.winCall + (1 - eq) * villainDeltas.loseCall)
    return { ev, eq }
  }

  let converged = false
  let iter = 0
  // Konvergenz wird über die Stabilität der reinen Entscheidungs-Mengen erkannt
  // (welche Hände pushen/callen), nicht über Float-Deltas der Frequenzen: Grenzhände
  // oszillieren durch die Dämpfung minimal um die Schwelle, ohne dass sich die
  // tatsächliche Push/Fold-Entscheidung ändert. `convergenceThreshold` (als Anteil
  // von 169) erlaubt ein kleines Flackern.
  const changeTolerance = Math.max(1, Math.floor(convergenceThreshold * ALL_HAND_IDS.length))
  let prevPushDec = new Set<HandId>()
  let prevCallDec = new Set<HandId>(ALL_HAND_IDS)

  const symDiff = (a: Set<HandId>, b: Set<HandId>): number => {
    let d = 0
    for (const x of a) if (!b.has(x)) d++
    for (const x of b) if (!a.has(x)) d++
    return d
  }

  for (; iter < maxIterations; iter++) {
    // ── Schritt A: Hero-Push-Frequenzen (gedämpft) ───────────────────────
    // P(call) hängt nur von der aktuellen Call-Range ab → einmal pro Sweep.
    const callW = rangeWeight(callFreq)
    const pCall = Math.min(1, callW / totalCallCombos)
    const pushDec = new Set<HandId>()
    for (const hHand of ALL_HAND_IDS) {
      const target = heroPushEv(hHand, pCall).ev > 0 ? 1 : 0
      if (target) pushDec.add(hHand)
      const prev = pushFreq.get(hHand)!
      pushFreq.set(hHand, prev * (1 - DAMPING) + target * DAMPING)
    }

    // ── Schritt B: Villain-Call-Frequenzen (gedämpft) ────────────────────
    const pushW = rangeWeight(pushFreq)
    const pPush = Math.min(1, pushW / totalCallCombos)
    const callDec = new Set<HandId>()
    for (const vHand of ALL_HAND_IDS) {
      const target = villainCallEv(vHand, pPush).ev > 0 ? 1 : 0
      if (target) callDec.add(vHand)
      const prev = callFreq.get(vHand)!
      callFreq.set(vHand, prev * (1 - DAMPING) + target * DAMPING)
    }

    // ── Konvergenz: Entscheidungs-Mengen stabil ──────────────────────────
    const changes = symDiff(pushDec, prevPushDec) + symDiff(callDec, prevCallDec)
    prevPushDec = pushDec
    prevCallDec = callDec
    if (iter > 0 && changes <= changeTolerance) {
      converged = true
      iter++
      break
    }
  }

  // ── Finales Ergebnis ──────────────────────────────────────────────────────
  // Reine Strategie (freq 0/1) anhand des EV-Vorzeichens gegen die konvergierte
  // Gegner-Range — bewahrt den dokumentierten Pure-Strategy-Kontrakt.
  const finalCallW = rangeWeight(callFreq)
  const finalPCall = Math.min(1, finalCallW / totalCallCombos)
  const finalPushResults = new Map<HandId, NashHandResult>()
  for (const hHand of ALL_HAND_IDS) {
    const { ev, eq } = heroPushEv(hHand, finalPCall)
    finalPushResults.set(hHand, { handId: hHand, ev, freq: ev > 0 ? 1 : 0, equity: eq })
  }

  const finalPushW = rangeWeight(pushFreq)
  const finalPPush = Math.min(1, finalPushW / totalCallCombos)
  const finalCallResults = new Map<HandId, NashHandResult>()
  for (const vHand of ALL_HAND_IDS) {
    const { ev, eq } = villainCallEv(vHand, finalPPush)
    finalCallResults.set(vHand, { handId: vHand, ev, freq: ev > 0 ? 1 : 0, equity: eq })
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

