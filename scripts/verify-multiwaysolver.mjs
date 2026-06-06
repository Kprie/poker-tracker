globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { solveMultiwaySpot } = await import('../src/renderer/src/lib/multiwaySolver.ts')
const { ALL_HAND_IDS } = await import('../src/renderer/src/data/pushFoldData.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const pct = (range) => [...range.values()].filter(r => r.freq === 1).length / ALL_HAND_IDS.length

// Reduzierte MC-Iterationen für tragbare Testlaufzeit (Production tuned höher / Web Worker).
const ctx = { stacks: [1000, 1000, 1000], payouts: [50, 30, 20], posts: [0, 50, 100], evIterations: 700, maxIterations: 6, damping: 0.5 }

// 3-handed: Akteur (Sitz 0, BTN, kein Blind) shoved, Sitze 1 (SB) und 2 (BB) callen.
const t0 = Date.now()
const res = solveMultiwaySpot([0, 1, 2], ctx)
const secs = ((Date.now() - t0) / 1000).toFixed(1)

const pushPct = pct(res.pushRange)
console.log(`\n3-handed Solve: ${secs}s, converged=${res.converged}, iters=${res.iterations}`)
console.log(`  Push-Range (BTN): ${(pushPct * 100).toFixed(0)}%`)
for (const j of res.callRanges.keys()) {
  console.log(`  Call-Range Sitz ${j}: ${(pct(res.callRanges.get(j)) * 100).toFixed(0)}%`)
}
console.log(`  expectedIcm = [${res.expectedIcm.map(e => e.toFixed(2)).join(', ')}]  Σ=${res.expectedIcm.reduce((a, b) => a + b, 0).toFixed(2)}`)

const aa = res.pushRange.get('AA')
const t72 = res.pushRange.get('72o')
console.log(`  AA push ev=${aa.ev.toFixed(3)} freq=${aa.freq} | 72o push ev=${t72.ev.toFixed(3)} freq=${t72.freq}`)

// ── Plausibilität ──
ok('AA pusht (freq=1)', aa.freq === 1)
ok('72o foldet (freq=0)', t72.freq === 0, `freq=${t72.freq}`)
// BTN-Push 3-handed gegen 2 Caller: enger als HU (~59%). Plausibel ~25–55%.
ok('Push-Range plausibel (20–60%)', pushPct >= 0.20 && pushPct <= 0.60, `${(pushPct * 100).toFixed(0)}%`)
// expectedIcm chip-konsistent: Summe == Preispool (100)
ok('expectedIcm Σ == Preispool 100', Math.abs(res.expectedIcm.reduce((a, b) => a + b, 0) - 100) < 1.0, `Σ=${res.expectedIcm.reduce((a, b) => a + b, 0).toFixed(2)}`)
// Caller callen enger als sie pushen würden (Call-Range < 100%)
for (const j of res.callRanges.keys()) {
  ok(`Call-Range Sitz ${j} < 80% (nicht jeder callt alles)`, pct(res.callRanges.get(j)) < 0.80)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
