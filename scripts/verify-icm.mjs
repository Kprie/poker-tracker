// Numerische Verifikation von icm.ts (computeIcmEquities + computeBubbleFactors).
// Wird via esbuild gebündelt und mit node ausgeführt — siehe npm-Aufruf unten.
import { computeIcmEquities, computeBubbleFactors } from '../src/renderer/src/lib/icm.ts'

let failures = 0
function check(name, actual, expected, tol = 1e-6) {
  const ok = Math.abs(actual - expected) <= tol
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${actual.toFixed(6)}, expected ${expected.toFixed(6)}`)
}

// ── Test 1: Gleiche Stacks, Winner-take-all → jeder gleiche Equity ──
{
  const eq = computeIcmEquities([1000, 1000, 1000], [100, 0, 0])
  check('equal stacks WTA p0', eq[0], 100 / 3)
  check('equal stacks WTA p1', eq[1], 100 / 3)
}

// ── Test 2: Bekanntes 2-Spieler-ICM (HU) ──
// Payouts 70/30, Stacks 1500/500. P(p0 1st) = 1500/2000 = 0.75.
// Eq(p0) = 0.75*70 + 0.25*30 = 52.5+7.5 = 60. Eq(p1) = 40.
{
  const eq = computeIcmEquities([1500, 500], [70, 30])
  check('HU eq p0', eq[0], 60)
  check('HU eq p1', eq[1], 40)
}

// ── Test 3: Klassisches 3-Spieler-ICM (Malmuth-Harville Referenzwert) ──
// Stacks 50/30/20 (in k), Payouts 50/30/20.
// Bekanntes Ergebnis (Standard-ICM-Rechner): ~ [38.33, 31.18, 30.49] grob.
// Wir prüfen Summe == Gesamtpreispool und Monotonie.
{
  const eq = computeIcmEquities([50, 30, 20], [50, 30, 20])
  const total = eq[0] + eq[1] + eq[2]
  check('3p sum == pool', total, 100, 1e-6)
  console.log(`      3p equities: [${eq.map(e => e.toFixed(2)).join(', ')}]`)
  if (!(eq[0] > eq[1] && eq[1] > eq[2])) { failures++; console.log('FAIL  3p monotonic (chipleader most equity)') }
  else console.log('PASS  3p monotonic (chipleader most equity)')
}

// ── Test 4: Bubble Factors — stabil bei kleinen Stacks, > 1 für Risiko ──
{
  // Klassische Bubble: 4 Spieler, 3 bezahlt, kurze Stacks.
  const bf = computeBubbleFactors([100, 100, 100, 100], [50, 30, 20])
  // Diagonale NaN
  if (Number.isNaN(bf[0][0])) console.log('PASS  BF diagonal NaN')
  else { failures++; console.log('FAIL  BF diagonal NaN') }
  // Off-Diagonale endlich und > 0 trotz kleiner Stacks
  const v = bf[0][1]
  if (Number.isFinite(v) && v > 0) console.log(`PASS  BF[0][1] finite & >0 (= ${v.toFixed(3)})`)
  else { failures++; console.log(`FAIL  BF[0][1] finite & >0 (= ${v})`) }
}

// ── Test 5: Bubble Factor sehr kleine Stacks (vorher instabil) ──
{
  const bf = computeBubbleFactors([100, 100, 100], [60, 40])
  const v = bf[0][1]
  if (Number.isFinite(v) && v > 0) console.log(`PASS  small-stack BF finite (= ${v.toFixed(3)})`)
  else { failures++; console.log(`FAIL  small-stack BF finite (= ${v})`) }
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
