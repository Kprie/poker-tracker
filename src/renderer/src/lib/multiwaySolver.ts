import type { Card } from './cards'
import { handIdToCombos } from './cards'
import { computeIcmEquities } from './icm'
import { multiwaySeatEv, simulateAllSeatsIcm } from './multiwayEv'
import type { SeatMode } from './multiwayEv'
import type { HandId } from '../data/pushFoldData'
import { ALL_HAND_IDS } from '../data/pushFoldData'

// ─── Multiway-Push/Fold-Nash-Solver (rekursiv, Bottom-up-DP) ──────────────────
//
// Spielbaum: der Akteur (active[0]) shoved (terminaler All-in-Knoten mit Callern)
// oder foldet (→ nächster Akteur, kleineres Subgame). Subgames werden bottom-up
// einmalig gelöst (memoisiert über die aktive Sitzmenge); der Fold-EV eines Akteurs
// ist seine ICM-$ im bereits gelösten Subgame ohne ihn. Strategien (Push-Range des
// Akteurs + Call-Range je Responder) via gedämpfte Fictitious Play.
//
// Modellierung: simultaner Call (jeder Responder hat eine unkonditionierte Call-Range
// gegen Heros Range + die übrigen Responder). Chip-/ICM-/Side-Pot-Mathematik exakt
// (über multiwaySeatEv/simulateAllSeatsIcm); die Strategie-Struktur ist der übliche
// praktische Multiway-Solver-Ansatz (keine sequenzielle Konditionierung auf beobachtete
// Calls). Siehe plans/01-b6-ev-model.md.

const TOTAL_COMBOS = 1326

function rangeWeight(range: ReadonlyMap<HandId, number>): number {
  let t = 0
  for (const [id, f] of range) t += handIdToCombos(id).length * f
  return t
}

function symDiff(a: Set<HandId>, b: Set<HandId>): number {
  let d = 0
  for (const x of a) if (!b.has(x)) d++
  for (const x of b) if (!a.has(x)) d++
  return d
}

/** Repräsentativer Combo einer Hand (für Karten-Removal im EV-Target). */
function rep(id: HandId): [Card, Card] {
  return handIdToCombos(id)[0]
}

export interface MultiwayHandResult {
  handId: HandId
  ev: number
  freq: number   // 0/1 (reine Strategie)
}

export interface MultiwaySolveResult {
  /** Push-Range des Akteurs (active[0]). */
  pushRange: Map<HandId, MultiwayHandResult>
  /** Call-Range je Responder-Sitz. */
  callRanges: Map<number, Map<HandId, MultiwayHandResult>>
  /** Erwartete ICM-$ je Sitz (Outcome-Verteilung dieses Spots). */
  expectedIcm: number[]
  converged: boolean
  iterations: number
}

export interface MultiwaySolveCtx {
  stacks: number[]
  payouts: number[]
  posts: number[]
  /** MC-Iterationen je EV-Auswertung. */
  evIterations?: number
  maxIterations?: number
  damping?: number
}

/**
 * Löst den Push/Fold-Spot mit den aktiven Sitzen `active` (in Aktionsreihenfolge;
 * active[0] = Akteur). Rekursiv über den Fold-Baum, memoisiert.
 */
export function solveMultiwaySpot(
  active: number[],
  ctx: MultiwaySolveCtx,
  memo: Map<string, MultiwaySolveResult> = new Map(),
): MultiwaySolveResult {
  const key = active.join(',')
  const cached = memo.get(key)
  if (cached) return cached

  const { stacks, payouts, posts } = ctx
  const n = stacks.length
  const evIters = ctx.evIterations ?? 1000
  const maxIter = ctx.maxIterations ?? 8
  const DAMP = ctx.damping ?? 0.5

  const actor = active[0]
  const responders = active.slice(1)
  const activeSet = new Set(active)

  // ── Basisfall: 1 aktiver Spieler → gewinnt das gesamte Dead Money ──
  if (active.length === 1) {
    const config = stacks.slice()
    let pot = 0
    for (let i = 0; i < n; i++) {
      if (!activeSet.has(i)) { config[i] = stacks[i] - posts[i]; pot += posts[i] }
    }
    config[actor] = stacks[actor] + pot
    const res: MultiwaySolveResult = {
      pushRange: new Map(), callRanges: new Map(),
      expectedIcm: computeIcmEquities(config, payouts), converged: true, iterations: 0,
    }
    memo.set(key, res)
    return res
  }

  // ── Fold-Fortsetzung (Akteur foldet → Responder spielen weiter) ──
  const foldCont = solveMultiwaySpot(responders, ctx, memo)
  const evFoldActor = foldCont.expectedIcm[actor]

  // ── Strategie-Zustand ──
  const pushFreq = new Map<HandId, number>(ALL_HAND_IDS.map(id => [id, 0]))
  const callFreq = new Map<number, Map<HandId, number>>(
    responders.map(r => [r, new Map<HandId, number>(ALL_HAND_IDS.map(id => [id, 1]))]),
  )

  let converged = false
  let iter = 0
  let prevPush = new Set<HandId>()
  const prevCall = new Map<number, Set<HandId>>(responders.map(r => [r, new Set(ALL_HAND_IDS)]))

  for (; iter < maxIter; iter++) {
    let changes = 0

    // ── Akteur: Push-Best-Response (gegen aktuelle Responder-Call-Ranges) ──
    const seatsForActor: (SeatMode | null)[] = new Array(n).fill(null)
    for (const r of responders) seatsForActor[r] = { mode: 'call', range: callFreq.get(r)! }
    const pushDec = new Set<HandId>()
    for (const h of ALL_HAND_IDS) {
      const ev = multiwaySeatEv({ stacks, payouts, posts, targetIdx: actor, targetCards: rep(h), seats: seatsForActor, iterations: evIters })
      const target = ev > evFoldActor ? 1 : 0
      if (target) pushDec.add(h)
      const prev = pushFreq.get(h)!
      pushFreq.set(h, prev * (1 - DAMP) + target * DAMP)
    }
    changes += symDiff(pushDec, prevPush)
    prevPush = pushDec

    // ── Responder: Call-Best-Response (gegen Akteur-Push + andere Responder) ──
    for (const j of responders) {
      // Fold-zu-Shove-EV: Akteur commit, andere Responder call, j foldet.
      const seatsFold: (SeatMode | null)[] = new Array(n).fill(null)
      seatsFold[actor] = { mode: 'commit', range: pushFreq }
      for (const r of responders) if (r !== j) seatsFold[r] = { mode: 'call', range: callFreq.get(r)! }
      seatsFold[j] = { mode: 'fold' }
      const foldEvJ = simulateAllSeatsIcm(stacks, payouts, posts, seatsFold, evIters)[j]

      // Call-EV: j (feste Hand) callt, Akteur commit, andere Responder call.
      const seatsCall: (SeatMode | null)[] = new Array(n).fill(null)
      seatsCall[actor] = { mode: 'commit', range: pushFreq }
      for (const r of responders) if (r !== j) seatsCall[r] = { mode: 'call', range: callFreq.get(r)! }

      const cf = callFreq.get(j)!
      const callDec = new Set<HandId>()
      for (const v of ALL_HAND_IDS) {
        const ev = multiwaySeatEv({ stacks, payouts, posts, targetIdx: j, targetCards: rep(v), seats: seatsCall, iterations: evIters })
        const target = ev > foldEvJ ? 1 : 0
        if (target) callDec.add(v)
        const prev = cf.get(v)!
        cf.set(v, prev * (1 - DAMP) + target * DAMP)
      }
      changes += symDiff(callDec, prevCall.get(j)!)
      prevCall.set(j, callDec)
    }

    if (iter > 0 && changes <= 1) { converged = true; iter++; break }
  }

  // ── Erwartete ICM-$ dieses Spots: P(shove)·Shove-Knoten + P(fold)·Fold-Cont ──
  const pShove = Math.min(1, rangeWeight(pushFreq) / TOTAL_COMBOS)
  const shoveSeats: (SeatMode | null)[] = new Array(n).fill(null)
  shoveSeats[actor] = { mode: 'commit', range: pushFreq }
  for (const r of responders) shoveSeats[r] = { mode: 'call', range: callFreq.get(r)! }
  const shoveIcm = simulateAllSeatsIcm(stacks, payouts, posts, shoveSeats, evIters * 2)
  const expectedIcm = new Array<number>(n)
  for (let i = 0; i < n; i++) expectedIcm[i] = pShove * shoveIcm[i] + (1 - pShove) * foldCont.expectedIcm[i]

  // ── Finale reine Strategien (freq 0/1 anhand EV-Vorzeichen) ──
  const seatsFinalActor: (SeatMode | null)[] = new Array(n).fill(null)
  for (const r of responders) seatsFinalActor[r] = { mode: 'call', range: callFreq.get(r)! }
  const pushRange = new Map<HandId, MultiwayHandResult>()
  for (const h of ALL_HAND_IDS) {
    const ev = multiwaySeatEv({ stacks, payouts, posts, targetIdx: actor, targetCards: rep(h), seats: seatsFinalActor, iterations: evIters })
    pushRange.set(h, { handId: h, ev: ev - evFoldActor, freq: ev > evFoldActor ? 1 : 0 })
  }

  const callRanges = new Map<number, Map<HandId, MultiwayHandResult>>()
  for (const j of responders) {
    const seatsFold: (SeatMode | null)[] = new Array(n).fill(null)
    seatsFold[actor] = { mode: 'commit', range: pushFreq }
    for (const r of responders) if (r !== j) seatsFold[r] = { mode: 'call', range: callFreq.get(r)! }
    seatsFold[j] = { mode: 'fold' }
    const foldEvJ = simulateAllSeatsIcm(stacks, payouts, posts, seatsFold, evIters)[j]

    const seatsCall: (SeatMode | null)[] = new Array(n).fill(null)
    seatsCall[actor] = { mode: 'commit', range: pushFreq }
    for (const r of responders) if (r !== j) seatsCall[r] = { mode: 'call', range: callFreq.get(r)! }

    const jr = new Map<HandId, MultiwayHandResult>()
    for (const v of ALL_HAND_IDS) {
      const ev = multiwaySeatEv({ stacks, payouts, posts, targetIdx: j, targetCards: rep(v), seats: seatsCall, iterations: evIters })
      jr.set(v, { handId: v, ev: ev - foldEvJ, freq: ev > foldEvJ ? 1 : 0 })
    }
    callRanges.set(j, jr)
  }

  const res: MultiwaySolveResult = { pushRange, callRanges, expectedIcm, converged, iterations: iter }
  memo.set(key, res)
  return res
}
