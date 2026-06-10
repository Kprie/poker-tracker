// Reine MC-Paar-Equity (equityMc) — Plausibilität + Symmetrie. MC hat Varianz,
// daher Toleranzen. Sichert die aus equityTable extrahierte Kernberechnung ab.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { computeCanonicalEquity, ITERS_PER_COMBO } = await import('../src/renderer/src/lib/equityMc.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const inRange = (v, lo, hi) => v >= lo && v <= hi

ok('ITERS_PER_COMBO = 200', ITERS_PER_COMBO === 200)

const aaVs72 = computeCanonicalEquity('AA', '72o')
ok('AA vs 72o starker Favorit (>0.80)', aaVs72 > 0.80, `${aaVs72.toFixed(3)}`)

const aaVsKK = computeCanonicalEquity('AA', 'KK')
ok('AA vs KK ~0.81 (0.76–0.86)', inRange(aaVsKK, 0.76, 0.86), `${aaVsKK.toFixed(3)}`)

const weakVsAA = computeCanonicalEquity('72o', 'AA')
ok('72o vs AA klarer Underdog (<0.20)', weakVsAA < 0.20, `${weakVsAA.toFixed(3)}`)

// Symmetrie: E(A,B) + E(B,A) ≈ 1 (innerhalb MC-Rauschen)
ok('Symmetrie AA/72o ~1.0', inRange(aaVs72 + weakVsAA, 0.95, 1.05), `${(aaVs72 + weakVsAA).toFixed(3)}`)

// Spiegelhand: AA vs AA ~0.5
const mirror = computeCanonicalEquity('AA', 'AA')
ok('AA vs AA ~0.5', inRange(mirror, 0.42, 0.58), `${mirror.toFixed(3)}`)

// Wertebereich
for (const [a, b] of [['AKs', 'QQ'], ['JTs', '99'], ['A5s', 'KQo']]) {
  const e = computeCanonicalEquity(a, b)
  ok(`${a} vs ${b} im Bereich [0,1]`, inRange(e, 0, 1), `${e.toFixed(3)}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
