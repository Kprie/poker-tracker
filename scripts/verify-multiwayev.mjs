globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { evShoveMultiway, comboToHandId } = await import('../src/renderer/src/lib/multiwayEv.ts')
const { computeIcmScenarios } = await import('../src/renderer/src/lib/equity.ts')
const { computeIcmEquities } = await import('../src/renderer/src/lib/icm.ts')
const { makeCard } = await import('../src/renderer/src/lib/cards.ts')
const { ALL_HAND_IDS } = await import('../src/renderer/src/data/pushFoldData.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }

// ── comboToHandId ──
{
  const As = makeCard(12, 3), Ks = makeCard(11, 3), Kc = makeCard(11, 0), Ac = makeCard(12, 0)
  ok('comboToHandId AsKs = AKs', comboToHandId(As, Ks) === 'AKs', comboToHandId(As, Ks))
  ok('comboToHandId AsKc = AKo', comboToHandId(As, Kc) === 'AKo', comboToHandId(As, Kc))
  ok('comboToHandId AsAc = AA', comboToHandId(As, Ac) === 'AA', comboToHandId(As, Ac))
}

const AA = [makeCard(12, 0), makeCard(12, 1)]
const KK = [makeCard(11, 0), makeCard(11, 1)]
const AKs = [makeCard(12, 3), makeCard(11, 3)]

// ── Stärkster Check: 0% Call → evShove == pushWinBlinds (exakt) ──
{
  const stacks = [1000, 1000], payouts = [70, 30], posts = [50, 100]  // HU: SB 0.5bb, BB 1bb
  const sc = computeIcmScenarios(stacks, payouts, 100, 0, 1, computeIcmEquities)
  const emptyRange = new Map()  // Gegner callt nie
  const ev = evShoveMultiway({ stacks, payouts, posts, heroIdx: 0, heroCards: AKs, callRanges: [null, emptyRange], iterations: 500 })
  ok('0% Call → evShove == pushWinBlinds', Math.abs(ev - sc.pushWinBlinds) < 1e-9,
     `evShove=${ev.toFixed(4)} pushWinBlinds=${sc.pushWinBlinds.toFixed(4)}`)
}

// ── 100% Call: Wert in (pushCallLose, pushCallWin), AA > KK ──
{
  const stacks = [1000, 1000], payouts = [70, 30], posts = [50, 100]
  const sc = computeIcmScenarios(stacks, payouts, 100, 0, 1, computeIcmEquities)
  const callAll = new Map(ALL_HAND_IDS.map(id => [id, 1]))
  const evAA = evShoveMultiway({ stacks, payouts, posts, heroIdx: 0, heroCards: AA, callRanges: [null, callAll], iterations: 8000 })
  const evKK = evShoveMultiway({ stacks, payouts, posts, heroIdx: 0, heroCards: KK, callRanges: [null, callAll], iterations: 8000 })
  console.log(`  evAA=${evAA.toFixed(3)} evKK=${evKK.toFixed(3)} (CallWin=${sc.pushCallWin} CallLose=${sc.pushCallLose})`)
  ok('100% Call: evAA in (CallLose, CallWin)', evAA > sc.pushCallLose && evAA < sc.pushCallWin)
  ok('100% Call: AA > KK', evAA > evKK)
  // AA vs random ~0.85 → blend ≈ 0.85*70 + 0.15*30 ≈ 64
  ok('100% Call: evAA ≈ 64 (±3)', Math.abs(evAA - 64) <= 3, `evAA=${evAA.toFixed(2)}`)
}

// ── 3-way: Hero shoved gegen 2 Caller (top ~20%), EV plausibel ──
{
  const stacks = [1000, 1000, 1000], payouts = [50, 30, 20], posts = [0, 50, 100]  // Hero BTN (kein Blind)
  const top20 = new Map(ALL_HAND_IDS.slice(0, 34).map(id => [id, 1]))  // grobe Top-Range
  const ev = evShoveMultiway({ stacks, payouts, posts, heroIdx: 0, heroCards: AA, callRanges: [null, top20, top20], iterations: 6000 })
  console.log(`  3-way evAA(BTN) = ${ev.toFixed(3)}`)
  ok('3-way: EV im Payout-Bereich [20,50]', ev >= 20 && ev <= 50, `ev=${ev.toFixed(2)}`)
  // AA shove als Chipleader-Gleichstand sollte besser als reines Fold-Equity (~33.3) sein
  ok('3-way: AA-Shove EV > 33 (besser als neutral)', ev > 33, `ev=${ev.toFixed(2)}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
