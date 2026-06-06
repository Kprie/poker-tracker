globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { computeIcmScenarios } = await import('../src/renderer/src/lib/equity.ts')
const { computeIcmEquities } = await import('../src/renderer/src/lib/icm.ts')
const { computeIcmDeltas } = await import('../src/renderer/src/lib/nashSolver.ts')

let failures = 0
const ok  = (n, c, d='') => { if (!c) failures++; console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`) }
const sum = a => a.reduce((x,y)=>x+y,0)

// ── Chip-Erhaltung: Spion zeichnet jede Stack-Config auf ──
function recordConfigs(stacks, payouts, bbSize, ante, callerIdx) {
  const configs = []
  const spy = (s, p) => { configs.push([...s]); return computeIcmEquities(s, p) }
  computeIcmScenarios(stacks, payouts, bbSize, ante, callerIdx, spy)
  return configs
}

// ── B7: 0-Stack-Spieler erhält untersten Auszahlungsplatz ──
{
  const eq = computeIcmEquities([0, 2000], [70, 30])
  ok('0-Stack HU: Verlierer = 2. Platz (30)', Math.abs(eq[0] - 30) < 1e-9, `eq[0]=${eq[0]}`)
  ok('0-Stack HU: Gewinner = 1. Platz (70)', Math.abs(eq[1] - 70) < 1e-9, `eq[1]=${eq[1]}`)
  // 3-handed: ein Spieler busted → bekommt 3. Platz
  const eq3 = computeIcmEquities([1000, 1000, 0], [50, 30, 20])
  ok('0-Stack 3-way: Busted = 3. Platz (20)', Math.abs(eq3[2] - 20) < 1e-9, `eq[2]=${eq3[2]}`)
  ok('0-Stack 3-way: Σ = Preispool', Math.abs(sum(eq3) - 100) < 1e-9, `Σ=${sum(eq3)}`)
}

const T = 3000
{
  const configs = recordConfigs([1500, 1500], [65, 35], 200, 0, 1)
  ok('computeIcmScenarios: 4 Knoten', configs.length === 4)
  configs.forEach((c, i) => ok(`Config ${i} chip-erhaltend (Σ=${sum(c)})`, Math.abs(sum(c) - T) < 1e-9, `Σ=${sum(c)} soll ${T}`))
}

// ── Mit Ante: ebenfalls chip-erhaltend ──
{
  const configs = recordConfigs([1500, 1500], [65, 35], 200, 25, 1)
  configs.forEach((c, i) => ok(`Ante-Config ${i} chip-erhaltend`, Math.abs(sum(c) - T) < 1e-9, `Σ=${sum(c)}`))
}

// ── Ungleiche Stacks: eff = min, Konfigs erhalten ──
{
  const configs = recordConfigs([800, 2200], [65, 35], 200, 0, 1)  // T=3000
  configs.forEach((c, i) => ok(`Uneven-Config ${i} chip-erhaltend`, Math.abs(sum(c) - T) < 1e-9, `Σ=${sum(c)}`))
  // Kein Stack negativ
  configs.forEach((c, i) => ok(`Uneven-Config ${i} ≥0`, c.every(x => x >= 0), `[${c.join(',')}]`))
}

// ── Plausibilität: Fold < WinBlinds (Pot gewinnen besser als aufgeben) ──
{
  const sc = computeIcmScenarios([1500, 1500], [65, 35], 200, 0, 1, computeIcmEquities)
  ok('Fold < Push-WinBlinds', sc.fold < sc.pushWinBlinds, `fold=${sc.fold.toFixed(3)} winBlinds=${sc.pushWinBlinds.toFixed(3)}`)
  ok('Push-CallLose < Fold < Push-CallWin', sc.pushCallLose < sc.fold && sc.fold < sc.pushCallWin,
     `lose=${sc.pushCallLose.toFixed(3)} fold=${sc.fold.toFixed(3)} win=${sc.pushCallWin.toFixed(3)}`)
}

// ── Deltas relativ zum Fold-Knoten: winPot > 0, loseCall < 0 ──
{
  const d = computeIcmDeltas([1500, 1500], [65, 35], 0, 1, 200, 0)  // (stacks,payouts,heroIdx,callerIdx,bbSize,ante)
  ok('Delta winPot > 0', d.winPot > 0, `winPot=${d.winPot.toFixed(3)}`)
  ok('Delta loseCall < 0', d.loseCall < 0, `loseCall=${d.loseCall.toFixed(3)}`)
  ok('Delta winCall > loseCall', d.winCall > d.loseCall)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
