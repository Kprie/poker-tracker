import type { Card } from './cards'
import { drawRandom, FULL_DECK, handIdToCombos } from './cards'
import { eval7 } from './handEval'
import type { HandId } from '../data/pushFoldData'
import { ALL_HAND_IDS } from '../data/pushFoldData'

// ─── Lazy Equity Cache ────────────────────────────────────────────────────────
// Schlüssel: "H1_H2" wobei H1 ≤ H2 lexikografisch.
// Wert: Equity von H1 gegen H2 (0–1).
// Werte bleiben über die Session erhalten; localStorage-Persistierung für
// nachfolgende Ladevorgänge.

const STORAGE_KEY = 'poker-tracker:equity-cache-v2'  // v2: 200 iters/combo, SE < 1%
const ITERS_PER_COMBO = 200  // 200 Iters × ~10 Combos = 2000 eff. Samples → SE ≈ 1 %

// In-Memory-Cache
const memCache = new Map<string, number>(loadFromStorage())

function loadFromStorage(): [string, number][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as [string, number][]
  } catch {
    return []
  }
}

function persistCache(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...memCache.entries()]))
  } catch { /* QuotaExceeded — stille Ignorierung */ }
}

/** Kanonischer Schlüssel: kleinerer ID zuerst → Wert ist Equity des kleineren. */
function cacheKey(id1: HandId, id2: HandId): { key: string; flipped: boolean } {
  if (id1 <= id2) return { key: `${id1}_${id2}`, flipped: false }
  return { key: `${id2}_${id1}`, flipped: true }
}

/**
 * Berechnet Equity von h1 gegen h2 via MC über alle nicht-konfliktierenden Combos.
 * Nutzt den schnellen array-freien eval7.
 */
function computeCanonicalEquity(h1: HandId, h2: HandId): number {
  const c1 = handIdToCombos(h1)
  const c2 = handIdToCombos(h2)

  let sumWin = 0
  let count  = 0

  for (const [a, b] of c1) {
    for (const [c, d] of c2) {
      if (a === c || a === d || b === c || b === d) continue  // Karten-Konflikt

      const deck = FULL_DECK.filter(x => x !== a && x !== b && x !== c && x !== d)
      let wins = 0, ties = 0

      for (let i = 0; i < ITERS_PER_COMBO; i++) {
        const board = drawRandom(deck, 5)
        const s1 = eval7([a, b, board[0], board[1], board[2], board[3], board[4]])
        const s2 = eval7([c, d, board[0], board[1], board[2], board[3], board[4]])
        if (s1 > s2) wins++
        else if (s1 === s2) ties++
      }

      sumWin += (wins + ties * 0.5) / ITERS_PER_COMBO
      count++
    }
  }

  return count > 0 ? sumWin / count : 0.5
}

/**
 * Gibt die Equity von h1 gegen h2 zurück.
 * Erster Aufruf pro Paar berechnet via MC und speichert im Cache.
 */
export function lookupEquity(h1: HandId, h2: HandId): number {
  if (h1 === h2) return 0.5   // gleiche Hand → Remis per Definition
  const { key, flipped } = cacheKey(h1, h2)

  if (!memCache.has(key)) {
    const eq = flipped ? 1 - computeCanonicalEquity(h2, h1) : computeCanonicalEquity(h1, h2)
    memCache.set(key, eq)
    // Kein persistCache() pro Eintrag — zu langsam. Batch-Persist am Ende.
  }

  const eq = memCache.get(key)!
  return flipped ? 1 - eq : eq
}

/**
 * Equity von hand h gegen eine gewichtete Range.
 * range: Map von HandId → Gewicht (0–1), typischerweise aus Nash-Calling-Range.
 */
export function lookupEquityVsRange(
  h: HandId,
  range: Map<HandId, number>,
): number {
  let sumEq = 0
  let sumW  = 0

  for (const [opponent, weight] of range) {
    if (opponent === h) continue  // gleiches Hand-Cluster ignorieren
    const eq = lookupEquity(h, opponent)
    sumEq += eq * weight
    sumW  += weight
  }

  return sumW > 0 ? sumEq / sumW : 0.5
}

// ─── Vorberechnung (optional) ─────────────────────────────────────────────────

export interface PrecomputeProgress {
  done: number
  total: number
  pct: number
}

/**
 * Berechnet alle n*(n+1)/2 kanonischen Hand-Paare vor und persistiert den Cache.
 * Kann asynchron mit requestIdleCallback-ähnlichem Chunking aufgerufen werden.
 * onProgress: Callback mit Fortschritts-Info (kann zum Rendern eines Fortschrittsbalkens genutzt werden).
 * Gibt ein Promise zurück, das resolved, wenn alles fertig ist.
 */
export async function precomputeAllEquities(
  onProgress?: (p: PrecomputeProgress) => void,
  chunkSize = 20,
): Promise<void> {
  const pairs: [HandId, HandId][] = []

  for (let i = 0; i < ALL_HAND_IDS.length; i++) {
    for (let j = i; j < ALL_HAND_IDS.length; j++) {
      const { key } = cacheKey(ALL_HAND_IDS[i], ALL_HAND_IDS[j])
      if (!memCache.has(key)) {
        pairs.push([ALL_HAND_IDS[i], ALL_HAND_IDS[j]])
      }
    }
  }

  const total = pairs.length

  for (let i = 0; i < pairs.length; i += chunkSize) {
    const chunk = pairs.slice(i, i + chunkSize)
    for (const [h1, h2] of chunk) {
      lookupEquity(h1, h2)
    }

    if (onProgress) {
      onProgress({ done: Math.min(i + chunkSize, total), total, pct: Math.min(1, (i + chunkSize) / total) })
    }

    // Mikrotask-Grenze: UI kann rendern
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }

  persistCache()
}

/** Wie viele Equity-Paare sind bereits im Cache? */
export function cachedPairCount(): number {
  return memCache.size
}

export const TOTAL_PAIR_COUNT = ALL_HAND_IDS.length * (ALL_HAND_IDS.length + 1) / 2  // 14365
