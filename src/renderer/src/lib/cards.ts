// Card encoding: card = rank * 4 + suit
// Rank: 0=2, 1=3, ..., 12=A
// Suit: 0=c, 1=d, 2=h, 3=s

export type Card = number

export const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const
type RankChar = typeof RANK_CHARS[number]

export function cardRank(c: Card): number { return c >> 2 }
export function cardSuit(c: Card): number { return c & 3 }
export function makeCard(rank: number, suit: number): Card { return rank * 4 + suit }

export const FULL_DECK: Card[] = Array.from({ length: 52 }, (_, i) => i)

/**
 * Wandelt eine kanonische Hand-ID (z.B. "AKs", "QTo", "JJ") in alle möglichen
 * konkreten Kartenkombinationen um:
 * - Paar:    6 Kombos  (C(4,2))
 * - Suited:  4 Kombos  (je eine pro Farbe)
 * - Offsuit: 12 Kombos (4×4 minus 4 suited)
 */
export function handIdToCombos(id: string): [Card, Card][] {
  const isPair   = id.length === 2
  const isSuited = id.endsWith('s')
  const r1 = RANK_CHARS.indexOf(id[0] as RankChar)
  const r2 = isPair ? r1 : RANK_CHARS.indexOf(id[1] as RankChar)

  const out: [Card, Card][] = []

  if (isPair) {
    for (let s1 = 0; s1 < 4; s1++)
      for (let s2 = s1 + 1; s2 < 4; s2++)
        out.push([makeCard(r1, s1), makeCard(r2, s2)])
  } else if (isSuited) {
    for (let s = 0; s < 4; s++)
      out.push([makeCard(r1, s), makeCard(r2, s)])
  } else {
    for (let s1 = 0; s1 < 4; s1++)
      for (let s2 = 0; s2 < 4; s2++)
        if (s1 !== s2) out.push([makeCard(r1, s1), makeCard(r2, s2)])
  }

  return out
}

/** Fisher-Yates-Partial-Shuffle: zieht k zufällige Karten aus arr (in-place auf Kopie). */
export function drawRandom(arr: Card[], k: number): Card[] {
  const a = arr.slice()
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i))
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp
  }
  return a.slice(0, k)
}
