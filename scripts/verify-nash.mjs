// Laufzeit-Verifikation von solveNash: Konvergenz + plausible Push/Fold-Ranges.
// Datei-gestützter localStorage-Shim: Equity-Cache überlebt Läufe (1. Lauf warmt).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const CACHE_FILE = new URL('./.equity-cache.json', import.meta.url)
globalThis.localStorage = {
  _m: new Map(existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : []),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, v); writeFileSync(CACHE_FILE, JSON.stringify([...this._m.entries()])) },
  removeItem(k) { this._m.delete(k) },
}

const { solveNash, getHandNashResult } = await import('../src/renderer/src/lib/nashSolver.ts')

let failures = 0
function expect(name, cond, detail = '') {
  if (!cond) failures++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

// HU Push/Fold, Hero im SB mit 10 BB. bbSize=100 chips → 10bb = 1000.
// Stacks gleich (1000/1000), Payouts 70/30, BB = caller.
const t0 = Date.now()
const res = solveNash({
  stacks: [1000, 1000],
  payouts: [70, 30],
  bbSize: 100,
  ante: 0,
  callerIdx: 1,
})
const secs = ((Date.now() - t0) / 1000).toFixed(1)

console.log(`\nSolver: converged=${res.converged}, iterations=${res.iterations}, ${secs}s\n`)

expect('converged', res.converged, `nach ${res.iterations} Iterationen`)

const aa = getHandNashResult(res, 'AA', true)
const kk = getHandNashResult(res, 'KK', true)
const t2o = getHandNashResult(res, '72o', true)

console.log(`  AA  push ev=${aa?.ev.toFixed(4)} freq=${aa?.freq} eq=${aa?.equity.toFixed(3)}`)
console.log(`  KK  push ev=${kk?.ev.toFixed(4)} freq=${kk?.freq} eq=${kk?.equity.toFixed(3)}`)
console.log(`  72o push ev=${t2o?.ev.toFixed(4)} freq=${t2o?.freq} eq=${t2o?.equity.toFixed(3)}`)

// AA muss bei 10bb HU SB immer pushen (höchste EV-Hand).
expect('AA pusht (freq=1)', aa?.freq === 1)
// AA-Equity gegen die (engere) Calling-Range bleibt hoch (> 0.75).
expect('AA equity > 0.75', (aa?.equity ?? 0) > 0.75, `eq=${aa?.equity.toFixed(3)}`)
// 72o ist die schwächste Hand — Equity gegen Call-Range deutlich niedriger als AA.
expect('72o equity < AA equity', (t2o?.equity ?? 1) < (aa?.equity ?? 0))

// Zähle Push-Range-Größe — bei 10bb HU sollte SB einen großen Teil pushen (> 50%).
let pushCount = 0
for (const [, r] of res.pushRange) if (r.freq === 1) pushCount++
const pushFrac = pushCount / res.pushRange.size
const pushPct = (pushFrac * 100).toFixed(0)
console.log(`\n  Push-Range: ${pushCount}/${res.pushRange.size} Hände (${pushPct}%)`)
// B6.1: chip-erhaltendes HU-Modell → Nash-Soll bei 10bb SB ≈ 55% (vorher fälschlich 100%).
expect('Push-Range realistisch (45–65%)', pushFrac >= 0.45 && pushFrac <= 0.65, `${pushPct}% (Soll ~55%)`)

// Stärkste Hände pushen, schwächste folden.
expect('72o foldet (freq=0)', t2o?.freq === 0, `72o freq=${t2o?.freq}`)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
