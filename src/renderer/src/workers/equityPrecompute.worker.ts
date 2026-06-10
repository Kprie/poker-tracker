// Web Worker: berechnet die fehlenden Equity-Paare per Monte-Carlo in einem eigenen
// Thread, damit der UI-Thread während der Vorberechnung nicht ruckelt. Ergebnisse
// werden gebündelt zurückgeschickt; der Main-Thread füllt damit seinen memCache.
// Hinweis: Worker haben kein localStorage — equityMc ist rein (keine Persistenz).
import { computeCanonicalEquity } from '../lib/equityMc'
import type { HandId } from '../data/pushFoldData'

export interface EquityPrecomputeRequest {
  pairs: [HandId, HandId][]  // kanonisch: lo ≤ hi lexikografisch
}

export type EquityPrecomputeResponse =
  | { type: 'progress'; done: number; total: number; entries: [HandId, HandId, number][] }
  | { type: 'done' }

const BATCH = 64  // Paare pro Fortschritts-Nachricht

// Minimales Worker-Scope-Interface (tsconfig hat DOM- statt WebWorker-lib).
interface WorkerScope {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void
}
const ws = self as unknown as WorkerScope

ws.addEventListener('message', (e: MessageEvent) => {
  const { pairs } = e.data as EquityPrecomputeRequest
  const total = pairs.length
  let batch: [HandId, HandId, number][] = []

  for (let i = 0; i < total; i++) {
    const [lo, hi] = pairs[i]
    batch.push([lo, hi, computeCanonicalEquity(lo, hi)])
    if (batch.length >= BATCH || i === total - 1) {
      const msg: EquityPrecomputeResponse = { type: 'progress', done: i + 1, total, entries: batch }
      ws.postMessage(msg)
      batch = []
    }
  }

  ws.postMessage({ type: 'done' } as EquityPrecomputeResponse)
})
