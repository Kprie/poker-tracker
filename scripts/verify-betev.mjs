// Phase 4: Pot-Odds & Bet-EV. Lehrbuch-Referenzwerte + Konsistenz.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { requiredEquityCall, breakEvenFoldFreq, callEvChips, betEv, sizingComparison } =
  await import('../src/renderer/src/lib/betEv.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e

// ── Pot Odds: Pot 150 (inkl. Bet 50), Call 50 → 25 % ──
ok('requiredEquityCall 50/200 = 25%', near(requiredEquityCall(150, 50), 0.25), `${requiredEquityCall(150, 50)}`)
ok('requiredEquityCall 0-Pot = 0', near(requiredEquityCall(0, 0), 0))

// ── Break-even-Fold: Pot 100, Bet 50 → 33,33 % ──
ok('breakEvenFoldFreq 50/150 = 1/3', near(breakEvenFoldFreq(100, 50), 1 / 3), `${breakEvenFoldFreq(100, 50)}`)
ok('breakEvenFoldFreq Pot-Bet (100 in 100) = 50%', near(breakEvenFoldFreq(100, 100), 0.5))

// ── Call-EV: bei genau benötigter Equity == 0 (Breakeven) ──
{
  const req = requiredEquityCall(150, 50)  // 0.25
  ok('callEvChips bei req-Equity == 0', near(callEvChips(req, 150, 50), 0), `${callEvChips(req, 150, 50)}`)
  ok('callEvChips über req-Equity > 0', callEvChips(0.40, 150, 50) > 0)
  ok('callEvChips unter req-Equity < 0', callEvChips(0.10, 150, 50) < 0)
}

// ── Bet-EV: reiner Bluff (E=0) == F·P − (1−F)·B ──
{
  const P = 100, B = 50
  // E=0: EV = F*P + (1-F)*(0 - B) = F*P - (1-F)*B
  const F = 0.5
  ok('betEv Bluff E=0', near(betEv({ potBefore: P, bet: B, call: B, foldFreq: F, equityWhenCalled: 0 }), F * P - (1 - F) * B),
     `${betEv({ potBefore: P, bet: B, call: B, foldFreq: F, equityWhenCalled: 0 })}`)
  // Bei Break-even-Fold und E=0 ⇒ EV = 0
  const be = breakEvenFoldFreq(P, B)
  ok('betEv bei Break-even-Fold (E=0) == 0', near(betEv({ potBefore: P, bet: B, call: B, foldFreq: be, equityWhenCalled: 0 }), 0))
  // F=0 (immer Call), E=1 ⇒ EV = P + C = P + B (gewinnt alles, eigener Bet zurück)
  ok('betEv F=0,E=1 == P+B', near(betEv({ potBefore: P, bet: B, call: B, foldFreq: 0, equityWhenCalled: 1 }), P + B),
     `${betEv({ potBefore: P, bet: B, call: B, foldFreq: 0, equityWhenCalled: 1 })}`)
  // Korrigierte Formel: B unkonditional. F=0,E=0 ⇒ EV = -B (nicht -B*(1) trivial, aber prüft Vorzeichen)
  ok('betEv F=0,E=0 == -B', near(betEv({ potBefore: P, bet: B, call: B, foldFreq: 0, equityWhenCalled: 0 }), -B))
}

// ── Sizing-Vergleich: größere Bets brauchen höhere Foldfreq ──
{
  const rows = sizingComparison(100, [0.33, 0.5, 1.0], 0.5, 0)
  ok('sizing: Break-even-Fold steigt mit Größe',
     rows[0].breakEvenFold < rows[1].breakEvenFold && rows[1].breakEvenFold < rows[2].breakEvenFold,
     rows.map(r => (r.breakEvenFold * 100).toFixed(1)).join(' < '))
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
