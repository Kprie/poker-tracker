import type { Card } from './cards'
import { FULL_DECK, drawRandom, cardRank, cardSuit, RANK_CHARS } from './cards'
import { scoreHandsOnBoard } from './multiwayEquity'
import { buildSidePots } from './sidePots'
import { computeIcmEquities } from './icm'
import type { HandId } from '../data/pushFoldData'

/** Konkrete 2-Karten-Hand → kanonische Hand-ID (z. B. "AKs", "QTo", "JJ"). */
export function comboToHandId(c1: Card, c2: Card): HandId {
  const r1 = cardRank(c1)
  const r2 = cardRank(c2)
  const hi = Math.max(r1, r2)
  const lo = Math.min(r1, r2)
  if (r1 === r2) return RANK_CHARS[hi] + RANK_CHARS[hi]
  const suited = cardSuit(c1) === cardSuit(c2)
  return RANK_CHARS[hi] + RANK_CHARS[lo] + (suited ? 's' : 'o')
}

export interface MultiwayShoveInput {
  /** Chip-Stacks je Sitz, **vor** Blind/Ante-Posting. */
  stacks: number[]
  payouts: number[]
  /** Geposteter Blind+Ante je Sitz (≥0). Teil von stacks; wird in den Pot gebucht. */
  posts: number[]
  heroIdx: number
  /** Konkrete Hero-Karten (Pusher). */
  heroCards: readonly [Card, Card]
  /**
   * Calling-Range je Sitz: Map HandId→Frequenz (0..1). `null` für Sitze, die nicht
   * agieren (Hero selbst, bereits gefoldet, nicht hinter Hero). Sitze mit Range sind
   * die potenziellen Caller hinter Heros Shove.
   */
  callRanges: (ReadonlyMap<HandId, number> | null)[]
  iterations?: number
}

/**
 * Chip-erhaltende, multiway-exakte ICM-$-Equity von Heros All-in-Shove (Monte Carlo).
 *
 * Pro Sample:
 *   1. Jeder potenzielle Caller wird sequenziell eine Hand aus dem Restdeck gegeben;
 *      er callt mit der Frequenz seiner Range für diese Hand (Karten bleiben nur bei
 *      Call blockiert — Folder enthüllen keine Karten).
 *   2. Board wird gezogen; committe Spieler (Hero + Caller) werden via eval7 bewertet.
 *   3. Side-Pots werden aus den Einsätzen gebaut (committe = voller Stack; Folder =
 *      ihr Post als Dead Money), jeder Layer geht an den besten committen Berechtigten.
 *   4. Resultierende Stacks (chip-erhaltend) → ICM; Heros ICM-$ wird gemittelt.
 *
 * @returns Heros erwartete ICM-$ nach dem Shove.
 */
export function evShoveMultiway(input: MultiwayShoveInput): number {
  const { stacks, payouts, posts, heroIdx, heroCards, callRanges, iterations = 4000 } = input
  const n = stacks.length

  const opponents: number[] = []
  for (let j = 0; j < n; j++) {
    if (j !== heroIdx && callRanges[j]) opponents.push(j)
  }

  const baseDeck = FULL_DECK.filter(c => c !== heroCards[0] && c !== heroCards[1])

  let heroEqSum = 0

  for (let it = 0; it < iterations; it++) {
    // ── 1. Caller bestimmen + Hände samplen ──────────────────────────────
    let avail = baseDeck
    const committedSeats = [heroIdx]
    const committedHands: [Card, Card][] = [[heroCards[0], heroCards[1]]]

    for (const j of opponents) {
      const [c1, c2] = drawRandom(avail, 2)
      const freq = callRanges[j]!.get(comboToHandId(c1, c2)) ?? 0
      if (freq > 0 && Math.random() < freq) {
        committedSeats.push(j)
        committedHands.push([c1, c2])
        avail = avail.filter(c => c !== c1 && c !== c2)  // nur Caller-Karten blockieren
      }
    }

    // ── 2. Board + Showdown-Scores ───────────────────────────────────────
    const board = drawRandom(avail, 5)
    const scores = scoreHandsOnBoard(committedHands, board)

    // ── 3. Side-Pots aus Einsätzen ───────────────────────────────────────
    // Committe Spieler setzen ihren vollen Stack, Folder ihren Post (Dead Money).
    const committedSet = new Set(committedSeats)
    const contributions = new Array<number>(n)
    for (let i = 0; i < n; i++) contributions[i] = committedSet.has(i) ? stacks[i] : posts[i]

    const layers = buildSidePots(contributions)

    // Resultierende Stacks: Folder behalten Stack−Post; committe starten bei 0.
    const result = new Array<number>(n)
    for (let i = 0; i < n; i++) result[i] = committedSet.has(i) ? 0 : stacks[i] - posts[i]

    // committedSeats-Index → Score-Index (für scoreHandsOnBoard-Reihenfolge)
    const scoreIdxOf = new Map<number, number>()
    committedSeats.forEach((seat, k) => scoreIdxOf.set(seat, k))

    for (const layer of layers) {
      // Bester committer Spieler unter den Layer-Berechtigten gewinnt; Ties teilen.
      let best = -1
      let winners: number[] = []
      for (const seat of layer.eligible) {
        if (!committedSet.has(seat)) continue  // Folder gewinnen nie
        const s = scores[scoreIdxOf.get(seat)!]
        if (s > best) { best = s; winners = [seat] }
        else if (s === best) winners.push(seat)
      }
      if (winners.length === 0) continue  // sollte nicht vorkommen
      const share = layer.amount / winners.length
      for (const w of winners) result[w] += share
    }

    heroEqSum += computeIcmEquities(result, payouts)[heroIdx]
  }

  return heroEqSum / iterations
}
