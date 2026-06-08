// weightedPushEv: gewichteter Push-EV (Delta vs Fold) aus den vier ICM-Szenarien.
// Referenzwerte + Grenzfälle. Sichert die aus RoundSimulator/SpotAnalyzer
// extrahierte Formel (equity.ts) gegen Regressionen ab.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { weightedPushEv } = await import('../src/renderer/src/lib/equity.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e

const sc = { fold: 0.5, pushWinBlinds: 0.6, pushCallWin: 0.8, pushCallLose: 0.2 }

// ── Grenzfälle ────────────────────────────────────────────────────────────────
// pCall=0: Villain foldet immer ⇒ ev = pushWinBlinds − fold
ok('pCall=0 ⇒ pushWinBlinds − fold', near(weightedPushEv(sc, 0, 0.5), sc.pushWinBlinds - sc.fold),
   `${weightedPushEv(sc, 0, 0.5)}`)
// pCall=1, eq=1: immer gecallt & gewonnen ⇒ ev = pushCallWin − fold
ok('pCall=1, eq=1 ⇒ pushCallWin − fold', near(weightedPushEv(sc, 1, 1), sc.pushCallWin - sc.fold))
// pCall=1, eq=0: immer gecallt & verloren ⇒ ev = pushCallLose − fold
ok('pCall=1, eq=0 ⇒ pushCallLose − fold', near(weightedPushEv(sc, 1, 0), sc.pushCallLose - sc.fold))

// ── Alle Szenarien gleich ⇒ ev = 0, unabhängig von pCall/eq ────────────────────
{
  const flat = { fold: 0.4, pushWinBlinds: 0.4, pushCallWin: 0.4, pushCallLose: 0.4 }
  ok('flache Szenarien ⇒ 0', near(weightedPushEv(flat, 0.7, 0.3), 0))
}

// ── Konkreter gewichteter Wert ─────────────────────────────────────────────────
// 0.5*(0.6-0.5) + 0.5*0.5*(0.8-0.5) + 0.5*0.5*(0.2-0.5) = 0.05 + 0.075 − 0.075 = 0.05
ok('Referenz pCall=0.5, eq=0.5 ⇒ 0.05', near(weightedPushEv(sc, 0.5, 0.5), 0.05),
   `${weightedPushEv(sc, 0.5, 0.5)}`)

// ── Monotonie: höhere Equity ⇒ höherer EV (pushCallWin > pushCallLose) ──────────
ok('monoton in Equity', weightedPushEv(sc, 0.6, 0.8) > weightedPushEv(sc, 0.6, 0.2),
   `${weightedPushEv(sc, 0.6, 0.8)} > ${weightedPushEv(sc, 0.6, 0.2)}`)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
