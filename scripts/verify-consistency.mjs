// Phase 1: EIN ICM-Modell. Prüft, dass computeIcmScenarios (equity.ts) und
// computeIcmDeltas (nashSolver.ts) aus derselben Quelle (icmScenarioConfigs)
// rechnen und chip-erhaltend für jede Spielerzahl sind. Damit liefern „Nash-
// Ranges laden", „Analysieren" und der RoundSimulator denselben ICM-Begriff.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { computeIcmScenarios, icmScenarioConfigs } = await import('../src/renderer/src/lib/equity.ts')
const { computeIcmDeltas, defaultPosts } = await import('../src/renderer/src/lib/nashSolver.ts')
const { computeIcmEquities } = await import('../src/renderer/src/lib/icm.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const sum = a => a.reduce((x, y) => x + y, 0)
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

// ── Szenarien und Deltas sind konsistent (gleiche Quelle) ──
function checkConsistency(label, stacks, payouts, bbSize, ante) {
  const posts = defaultPosts(stacks.length, bbSize, ante)
  const sc = computeIcmScenarios(stacks, payouts, posts, 1, computeIcmEquities)
  const d  = computeIcmDeltas(stacks, payouts, 0, 1, posts)
  ok(`${label}: fold == currentEq`, near(sc.fold, d.currentEq), `${sc.fold} vs ${d.currentEq}`)
  ok(`${label}: pushWinBlinds == fold + winPot`, near(sc.pushWinBlinds, d.currentEq + d.winPot))
  ok(`${label}: pushCallWin == fold + winCall`, near(sc.pushCallWin, d.currentEq + d.winCall))
  ok(`${label}: pushCallLose == fold + loseCall`, near(sc.pushCallLose, d.currentEq + d.loseCall))
}

checkConsistency('HU', [1500, 1500], [65, 35], 200, 0)
checkConsistency('HU+Ante', [1500, 1500], [65, 35], 200, 25)
checkConsistency('3-way', [1000, 1000, 1000], [50, 30, 20], 200, 0)
checkConsistency('4-way uneven', [800, 1500, 2200, 1000], [50, 30, 20], 200, 25)

// ── Chip-Erhaltung aller vier Konfigurationen, auch n>2 ──
function checkConservation(label, stacks, bbSize, ante) {
  const posts = defaultPosts(stacks.length, bbSize, ante)
  const cfgs = icmScenarioConfigs(stacks, posts, 0, 1)
  const T = sum(stacks)
  for (const [name, c] of Object.entries(cfgs)) {
    ok(`${label}/${name}: chip-erhaltend (Σ=${sum(c)})`, near(sum(c), T), `soll ${T}`)
    ok(`${label}/${name}: keine negativen Stacks`, c.every(x => x >= 0), `[${c.join(',')}]`)
  }
}

checkConservation('3-way', [1000, 1000, 1000], 200, 0)
checkConservation('4-way+Ante', [800, 1500, 2200, 1000], 200, 25)
// Short-Blind: BB-Sitz hat weniger Chips als der BB-Post → Posts auf Stack gekappt, keine negativen Stacks.
checkConservation('short-blind', [2000, 2000, 50], 200, 0)

// ── Regression: HU-Generalisierung == altes exaktes Stack-Swap-Modell ──
{
  const cfgs = icmScenarioConfigs([1500, 1500], [100, 200], 0, 1)  // posts SB100/BB200
  ok('HU fold == [1400,1600]', JSON.stringify(cfgs.fold) === JSON.stringify([1400, 1600]), JSON.stringify(cfgs.fold))
  ok('HU winPot == [1700,1300]', JSON.stringify(cfgs.winPot) === JSON.stringify([1700, 1300]), JSON.stringify(cfgs.winPot))
  ok('HU winCall == [3000,0]', JSON.stringify(cfgs.winCall) === JSON.stringify([3000, 0]), JSON.stringify(cfgs.winCall))
  ok('HU loseCall == [0,3000]', JSON.stringify(cfgs.loseCall) === JSON.stringify([0, 3000]), JSON.stringify(cfgs.loseCall))
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
