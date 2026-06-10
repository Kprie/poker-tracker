import type { Card } from './cards'
import { handIdToCombos } from './cards'
import type { HandId } from '../data/pushFoldData'
import { ALL_HAND_IDS } from '../data/pushFoldData'
import { computeCanonicalEquity } from './equityMc'

// ─── Lazy Equity Cache ────────────────────────────────────────────────────────
// Schlüssel: "H1_H2" wobei H1 ≤ H2 lexikografisch.
// Wert: Equity von H1 gegen H2 (0–1).
// Werte bleiben über die Session erhalten; localStorage-Persistierung für
// nachfolgende Ladevorgänge.

const STORAGE_KEY = 'poker-tracker:equity-cache-v3'  // v3: Fix invertierter Flip-Equity-Bug; v2-Cache war korrupt

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
 * Gibt die Equity von h1 gegen h2 zurück.
 * Erster Aufruf pro Paar berechnet via MC und speichert im Cache.
 */
export function lookupEquity(h1: HandId, h2: HandId): number {
  if (h1 === h2) return 0.5   // gleiche Hand → Remis per Definition
  const { key, flipped } = cacheKey(h1, h2)

  if (!memCache.has(key)) {
    // Cache speichert immer E(A,B) der kanonischen Paar-Reihenfolge (A=key-erste Hand).
    // Bei flipped ist die kanonische Paarung (h2,h1) → direkt E(h2,h1) speichern.
    // Das Flipping wird ausschließlich beim Rückgabewert (1 - eq) angewandt.
    const eq = flipped ? computeCanonicalEquity(h2, h1) : computeCanonicalEquity(h1, h2)
    memCache.set(key, eq)
    // Kein persistCache() pro Eintrag — zu langsam. Batch-Persist am Ende.
  }

  const eq = memCache.get(key)!
  return flipped ? 1 - eq : eq
}

/**
 * Equity von hand h gegen eine gewichtete Range.
 * range: Map von HandId → Gewicht (0–1), typischerweise aus Nash-Calling-Range.
 *
 * heroCards (optional): konkrete bzw. repräsentative Karten des Heroes. Wenn gesetzt,
 * werden Gegner-Combos, die eine Hero-Karte enthalten, per Karten-Removal entfernt —
 * der Gewichtungsanteil einer Gegnerhand sinkt entsprechend dem Anteil noch möglicher
 * Combos. Ohne heroCards wird nur das identische Hand-Cluster grob ausgeschlossen.
 */
export function lookupEquityVsRange(
  h: HandId,
  range: Map<HandId, number>,
  heroCards?: readonly [Card, Card],
): number {
  let sumEq = 0
  let sumW  = 0

  for (const [opponent, weight] of range) {
    let effWeight = weight
    if (heroCards) {
      const combos = handIdToCombos(opponent)
      let valid = 0
      for (const [a, b] of combos) {
        if (a !== heroCards[0] && a !== heroCards[1] && b !== heroCards[0] && b !== heroCards[1]) valid++
      }
      if (valid === 0) continue  // Gegnerhand vollständig durch Hero-Karten blockiert
      effWeight = weight * (valid / combos.length)
    } else if (opponent === h) {
      continue  // grober Blocker, wenn keine konkreten Karten vorliegen
    }
    const eq = lookupEquity(h, opponent)
    sumEq += eq * effWeight
    sumW  += effWeight
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
  // Fehlende kanonische Paare ermitteln (lo ≤ hi lexikografisch = Schlüssel-Reihenfolge).
  const pairs: [HandId, HandId][] = []
  for (let i = 0; i < ALL_HAND_IDS.length; i++) {
    for (let j = i; j < ALL_HAND_IDS.length; j++) {
      const { key } = cacheKey(ALL_HAND_IDS[i], ALL_HAND_IDS[j])
      if (!memCache.has(key)) {
        const [lo, hi] = key.split('_') as [HandId, HandId]
        pairs.push([lo, hi])
      }
    }
  }

  const total = pairs.length
  if (total === 0) {
    onProgress?.({ done: 0, total: 0, pct: 1 })
    return
  }

  // Bevorzugt im Web-Worker rechnen (Main-Thread bleibt frei → kein Ruckeln).
  // Fällt bei fehlendem Worker (z. B. Nicht-Browser-Umgebung) auf den chunked
  // Main-Thread-Pfad zurück.
  try {
    await precomputeViaWorker(pairs, total, onProgress)
  } catch {
    await precomputeChunkedMainThread(pairs, total, chunkSize, onProgress)
  }

  persistCache()
}

/** Rechnet die fehlenden Paare im Web-Worker; Ergebnisse landen im memCache. */
function precomputeViaWorker(
  pairs: [HandId, HandId][],
  total: number,
  onProgress?: (p: PrecomputeProgress) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('../workers/equityPrecompute.worker.ts', import.meta.url), { type: 'module' })
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
      return
    }
    worker.addEventListener('message', (e: MessageEvent) => {
      const msg = e.data as
        | { type: 'progress'; done: number; entries: [HandId, HandId, number][] }
        | { type: 'done' }
      if (msg.type === 'progress') {
        for (const [lo, hi, eq] of msg.entries) memCache.set(`${lo}_${hi}`, eq)
        onProgress?.({ done: msg.done, total, pct: Math.min(1, msg.done / total) })
      } else {
        worker.terminate()
        resolve()
      }
    })
    worker.addEventListener('error', (e: ErrorEvent) => {
      worker.terminate()
      reject(new Error(e.message || 'Equity-Worker-Fehler'))
    })
    worker.postMessage({ pairs })
  })
}

/** Fallback: synchron-chunked auf dem Main-Thread (mit setTimeout-Yield). */
async function precomputeChunkedMainThread(
  pairs: [HandId, HandId][],
  total: number,
  chunkSize: number,
  onProgress?: (p: PrecomputeProgress) => void,
): Promise<void> {
  for (let i = 0; i < pairs.length; i += chunkSize) {
    const chunk = pairs.slice(i, i + chunkSize)
    for (const [lo, hi] of chunk) memCache.set(`${lo}_${hi}`, computeCanonicalEquity(lo, hi))
    onProgress?.({ done: Math.min(i + chunkSize, total), total, pct: Math.min(1, (i + chunkSize) / total) })
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

/** Wie viele Equity-Paare sind bereits im Cache? */
export function cachedPairCount(): number {
  return memCache.size
}

export const TOTAL_PAIR_COUNT = ALL_HAND_IDS.length * (ALL_HAND_IDS.length + 1) / 2  // 14365
