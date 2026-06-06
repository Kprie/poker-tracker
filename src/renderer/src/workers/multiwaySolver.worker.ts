// Web Worker: führt den rechenintensiven multiway-Push/Fold-Solver in einem eigenen
// Thread aus, damit der UI-Thread nie blockiert. Kommunikation via postMessage.
// Hinweis: Worker haben kein localStorage — der multiway-Solver nutzt frische MC
// (keine equityTable), daher unproblematisch.
import { solveMultiwaySpot } from '../lib/multiwaySolver'
import type { MultiwaySolveCtx, MultiwaySolveResult } from '../lib/multiwaySolver'

export interface MultiwaySolveRequest {
  id: number
  active: number[]
  ctx: MultiwaySolveCtx
}

export type MultiwaySolveResponse =
  | { id: number; ok: true; result: MultiwaySolveResult }
  | { id: number; ok: false; error: string }

// Minimales Worker-Scope-Interface (tsconfig hat DOM- statt WebWorker-lib).
interface WorkerScope {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void
}
const ws = self as unknown as WorkerScope

ws.addEventListener('message', (e: MessageEvent) => {
  const req = e.data as MultiwaySolveRequest
  try {
    const result = solveMultiwaySpot(req.active, req.ctx)
    const res: MultiwaySolveResponse = { id: req.id, ok: true, result }
    ws.postMessage(res)
  } catch (err) {
    const res: MultiwaySolveResponse = { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) }
    ws.postMessage(res)
  }
})
