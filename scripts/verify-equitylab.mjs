// Phase 6: Multiway-Equity mit Board, Handklassen-Verteilung, Draw-Detektion.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { multiwayEquityBoard } = await import('../src/renderer/src/lib/multiwayEquity.ts')
const { handClassDistribution } = await import('../src/renderer/src/lib/handClass.ts')
const { detectDraws } = await import('../src/renderer/src/lib/draws.ts')
const { makeCard } = await import('../src/renderer/src/lib/cards.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e
const sum = a => a.reduce((x, y) => x + y, 0)
// rank: 0=2..12=A ; suit 0=c,1=d,2=h,3=s
const C = (r, s) => makeCard(r, s)

// ── Multiway-Equity mit Board ──
{
  const AA = [C(12, 2), C(12, 3)], KK = [C(11, 2), C(11, 3)]
  const pre = multiwayEquityBoard([AA, KK], [], 6000)
  ok('AAvKK preflop: Σ=1', near(sum(pre), 1, 1e-9), `Σ=${sum(pre)}`)
  ok('AAvKK preflop: AA ~0.82', pre[0] > 0.78 && pre[0] < 0.86, `${pre[0].toFixed(3)}`)

  // River deterministisch: AA = Trips Asse schlägt KK = Paar Könige
  const board = [C(12, 1), C(5, 0), C(0, 2), C(7, 3), C(1, 1)]  // Ad 7c 2h 9s 3d
  const riv = multiwayEquityBoard([AA, KK], board)
  ok('AAvKK River: [1,0]', near(riv[0], 1) && near(riv[1], 0), `[${riv}]`)

  // 3-way Σ=1
  const QQ = [C(10, 0), C(10, 1)]
  const tw = multiwayEquityBoard([AA, KK, QQ], [], 4000)
  ok('3-way: Σ=1', near(sum(tw), 1, 1e-9), `Σ=${sum(tw)}`)
}

// ── Handklassen-Verteilung ──
{
  const AA = [C(12, 2), C(12, 3)]
  // Flop Ad Kc Qh → mind. Drilling, nie nur High Card/Paar/2Paar
  const flop = handClassDistribution(AA, [C(12, 1), C(11, 0), C(10, 2)])
  ok('handClass Flop: Σ=1', near(sum(flop.dist), 1, 1e-9), `Σ=${sum(flop.dist)}`)
  ok('handClass Flop: exakt', flop.isExact === true)
  ok('handClass Flop AA+A: keine Kat <3', flop.dist[0] + flop.dist[1] + flop.dist[2] === 0)

  // River Broadway-Straße: AhAs auf A-K-Q-J-T → Kategorie 4 (Straße)
  const riv = handClassDistribution(AA, [C(12, 1), C(11, 0), C(10, 0), C(9, 0), C(8, 0)])
  ok('handClass River Broadway = Straße', near(riv.dist[4], 1), `[${riv.dist.map(x => x.toFixed(2))}]`)
}

// ── Draw-Detektion ──
{
  // Nut-Flush-Draw: Ah Kh auf Qh 2h 5c
  const fd = detectDraws([C(12, 2), C(11, 2)], [C(10, 2), C(0, 2), C(3, 0)])
  ok('Draw: Nut-Flush-Draw', fd.flushDraw && fd.nutFlushDraw && !fd.madeFlush)

  // OESD: 9c 8d auf 7h 6s 2c
  const oe = detectDraws([C(7, 0), C(6, 1)], [C(5, 2), C(4, 3), C(0, 0)])
  ok('Draw: OESD (2 Outs-Ränge)', oe.straightType === 'oesd' && oe.straightOuts === 2, `outs=${oe.straightOuts}`)

  // Gutshot: 9c 7d auf 6h 5s 2c (nur 8 vervollständigt)
  const gs = detectDraws([C(7, 0), C(5, 1)], [C(4, 2), C(3, 3), C(0, 0)])
  ok('Draw: Gutshot (1 Out-Rang)', gs.straightType === 'gutshot' && gs.straightOuts === 1, `outs=${gs.straightOuts}`)

  // Kein Draw: Ah Kd auf 2c 7h 9s
  const nd = detectDraws([C(12, 2), C(11, 1)], [C(0, 0), C(5, 2), C(7, 3)])
  ok('Draw: kein Straßen-/Flush-Draw', !nd.flushDraw && nd.straightType === 'none')
  ok('Draw: 2 Overcards erkannt', nd.overcards === 2, `${nd.overcards}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
