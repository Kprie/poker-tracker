// Main-Thread-Client für den multiway-Solver-Worker. Kapselt postMessage/onmessage
// in ein Promise. Der Worker wird lazy erzeugt und über alle Aufrufe wiederverwendet.
import type { MultiwaySolveCtx, MultiwaySolveResult } from './multiwaySolver'
import type { MultiwaySolveRequest, MultiwaySolveResponse } from '../workers/multiwaySolver.worker'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: MultiwaySolveResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/multiwaySolver.worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (e: MessageEvent) => {
      const msg = e.data as MultiwaySolveResponse
      const p = pending.get(msg.id)
      if (!p) return
      pending.delete(msg.id)
      if (msg.ok) p.resolve(msg.result)
      else p.reject(new Error(msg.error))
    })
    worker.addEventListener('error', (e: ErrorEvent) => {
      // Globaler Worker-Fehler — alle ausstehenden Anfragen ablehnen.
      for (const [, p] of pending) p.reject(new Error(e.message || 'Worker-Fehler'))
      pending.clear()
    })
  }
  return worker
}

/** Löst einen multiway-Push/Fold-Spot asynchron im Worker (UI bleibt flüssig). */
export function solveMultiwaySpotAsync(active: number[], ctx: MultiwaySolveCtx): Promise<MultiwaySolveResult> {
  const w = getWorker()
  const id = nextId++
  const req: MultiwaySolveRequest = { id, active, ctx }
  return new Promise<MultiwaySolveResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage(req)
  })
}
