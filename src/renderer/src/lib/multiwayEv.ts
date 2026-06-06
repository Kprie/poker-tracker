import type { Card } from './cards'
import { FULL_DECK, drawRandom, cardRank, cardSuit, RANK_CHARS, handIdToCombos } from './cards'
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

/**
 * Sitz-Rolle relativ zu Heros Shove:
 *  - `commit`: Spieler ist bereits all-in (z. B. Hero hat gepusht). Seine Hand wird
 *    aus `range` (gewichtet nach Frequenz) gesampelt; er ist immer beteiligt.
 *  - `call`: Spieler entscheidet call/fold. Er bekommt eine zufällige Hand und callt
 *    mit der Frequenz seiner Range für diese Hand.
 *  - `fold`: nicht beteiligt; sein Post ist Dead Money.
 */
export type SeatMode =
  | { mode: 'commit'; range: ReadonlyMap<HandId, number> }
  | { mode: 'call'; range: ReadonlyMap<HandId, number> }
  | { mode: 'fold' }

export interface MultiwaySeatInput {
  /** Chip-Stacks je Sitz, **vor** Blind/Ante-Posting. */
  stacks: number[]
  payouts: number[]
  /** Geposteter Blind+Ante je Sitz (≥0). */
  posts: number[]
  /** Sitz, dessen ICM-$-EV berechnet wird (mit fester Hand). */
  targetIdx: number
  targetCards: readonly [Card, Card]
  /** Rolle je Sitz; Eintrag für `targetIdx` wird ignoriert. */
  seats: (SeatMode | null)[]
  iterations?: number
}

interface RangeSampler {
  combos: [Card, Card][]
  cum: number[]   // kumulierte Gewichte
  total: number
}

/** Gewichtete Combo-Liste einer Range, ohne durch `block` belegte Karten. */
function buildSampler(range: ReadonlyMap<HandId, number>, block: ReadonlySet<Card>): RangeSampler {
  const combos: [Card, Card][] = []
  const cum: number[] = []
  let total = 0
  for (const [hid, freq] of range) {
    if (freq <= 0) continue
    for (const [a, b] of handIdToCombos(hid)) {
      if (block.has(a) || block.has(b)) continue
      total += freq
      combos.push([a, b])
      cum.push(total)
    }
  }
  return { combos, cum, total }
}

/** Zieht einen Combo aus dem Sampler, der keine Karte aus `used` enthält (Rejection). */
function sampleCommit(s: RangeSampler, used: ReadonlySet<Card>): [Card, Card] | null {
  if (s.total <= 0) return null
  for (let attempt = 0; attempt < 16; attempt++) {
    const r = Math.random() * s.total
    // binäre Suche nach erstem cum > r
    let lo = 0, hi = s.cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (s.cum[mid] > r) hi = mid; else lo = mid + 1
    }
    const [a, b] = s.combos[lo]
    if (!used.has(a) && !used.has(b)) return [a, b]
  }
  // Fallback: linear ersten freien Combo suchen
  for (const [a, b] of s.combos) if (!used.has(a) && !used.has(b)) return [a, b]
  return null
}

/**
 * Chip-erhaltende, multiway-exakte ICM-$-Equity eines Sitzes mit fester Hand (Monte Carlo).
 *
 * Pro Sample werden committe Sitze (Hero-Push etc.) aus ihrer Range gesampelt, callende
 * Sitze bekommen eine Zufallshand und committen mit ihrer Call-Frequenz. Aus den Einsätzen
 * (committe = voller Stack, Folder = Post als Dead Money) werden Side-Pots gebaut, das Board
 * gezogen, die Layer an die besten committen Berechtigten vergeben und die resultierenden
 * (chip-erhaltenden) Stacks via ICM bewertet. Rückgabe: gemittelte ICM-$ des Ziel-Sitzes.
 */
export function multiwaySeatEv(input: MultiwaySeatInput): number {
  const { stacks, payouts, posts, targetIdx, targetCards, seats, iterations = 4000 } = input
  const n = stacks.length

  const targetBlock = new Set<Card>([targetCards[0], targetCards[1]])
  // Sampler für commit-Sitze einmalig vorberechnen (Range fix über alle Iterationen).
  const samplers: (RangeSampler | null)[] = seats.map((s, j) =>
    s && j !== targetIdx && s.mode === 'commit' ? buildSampler(s.range, targetBlock) : null,
  )

  const baseDeck = FULL_DECK.filter(c => c !== targetCards[0] && c !== targetCards[1])
  let sum = 0

  for (let it = 0; it < iterations; it++) {
    let avail = baseDeck
    const used = new Set<Card>(targetBlock)
    const committedSeats: number[] = [targetIdx]
    const committedHands: [Card, Card][] = [[targetCards[0], targetCards[1]]]

    for (let j = 0; j < n; j++) {
      const s = seats[j]
      if (!s || j === targetIdx || s.mode === 'fold') continue

      if (s.mode === 'commit') {
        const hand = sampleCommit(samplers[j]!, used)
        if (!hand) continue
        committedSeats.push(j)
        committedHands.push(hand)
        used.add(hand[0]); used.add(hand[1])
        avail = avail.filter(c => c !== hand[0] && c !== hand[1])
      } else {
        // call: Zufallshand, committen mit Frequenz
        const [c1, c2] = drawRandom(avail, 2)
        const freq = s.range.get(comboToHandId(c1, c2)) ?? 0
        if (freq > 0 && Math.random() < freq) {
          committedSeats.push(j)
          committedHands.push([c1, c2])
          used.add(c1); used.add(c2)
          avail = avail.filter(c => c !== c1 && c !== c2)
        }
      }
    }

    const board = drawRandom(avail, 5)
    const scores = scoreHandsOnBoard(committedHands, board)

    const committedSet = new Set(committedSeats)
    const contributions = new Array<number>(n)
    for (let i = 0; i < n; i++) contributions[i] = committedSet.has(i) ? stacks[i] : posts[i]

    const layers = buildSidePots(contributions)

    const result = new Array<number>(n)
    for (let i = 0; i < n; i++) result[i] = committedSet.has(i) ? 0 : stacks[i] - posts[i]

    const scoreIdxOf = new Map<number, number>()
    committedSeats.forEach((seat, k) => scoreIdxOf.set(seat, k))

    for (const layer of layers) {
      let best = -1
      let winners: number[] = []
      for (const seat of layer.eligible) {
        if (!committedSet.has(seat)) continue
        const sc = scores[scoreIdxOf.get(seat)!]
        if (sc > best) { best = sc; winners = [seat] }
        else if (sc === best) winners.push(seat)
      }
      if (winners.length === 0) continue
      const share = layer.amount / winners.length
      for (const w of winners) result[w] += share
    }

    sum += computeIcmEquities(result, payouts)[targetIdx]
  }

  return sum / iterations
}

export interface MultiwayShoveInput {
  stacks: number[]
  payouts: number[]
  posts: number[]
  heroIdx: number
  heroCards: readonly [Card, Card]
  /** Calling-Range je Sitz (Map HandId→Frequenz) oder `null` für nicht agierende Sitze. */
  callRanges: (ReadonlyMap<HandId, number> | null)[]
  iterations?: number
}

/**
 * ICM-$-EV von Heros All-in-Shove: alle Gegner mit Range sind `call`-Sitze.
 * Dünner Wrapper um {@link multiwaySeatEv}.
 */
export function evShoveMultiway(input: MultiwayShoveInput): number {
  const { stacks, payouts, posts, heroIdx, heroCards, callRanges, iterations } = input
  const seats: (SeatMode | null)[] = callRanges.map(r => (r ? { mode: 'call', range: r } : null))
  return multiwaySeatEv({ stacks, payouts, posts, targetIdx: heroIdx, targetCards: heroCards, seats, iterations })
}
