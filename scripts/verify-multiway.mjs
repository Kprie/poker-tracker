const { multiwayEquity, scoreHandsOnBoard } = await import('../src/renderer/src/lib/multiwayEquity.ts')
const { makeCard } = await import('../src/renderer/src/lib/cards.ts')

let failures = 0
function assert(cond, msg) {
  if (cond) {
    console.log('  PASS:', msg)
  } else {
    console.log('  FAIL:', msg)
    failures++
  }
}

// rank: 12=A, 11=K, 10=Q
const AA = [makeCard(12, 0), makeCard(12, 1)]
const KK = [makeCard(11, 0), makeCard(11, 1)]
const QQ = [makeCard(10, 0), makeCard(10, 1)]

// ── HU-Konsistenz: AA vs KK ≈ 0.82 / 0.18 ─────────────────────────────────
console.log('\n[HU] AA vs KK (iterations=20000)')
const hu = multiwayEquity([AA, KK], 20000)
console.log('  AA =', hu[0].toFixed(4), ' KK =', hu[1].toFixed(4), ' Summe =', (hu[0] + hu[1]).toFixed(12))
assert(Math.abs(hu[0] - 0.82) <= 0.02, `AA equity ${hu[0].toFixed(4)} ≈ 0.82 (±0.02)`)
assert(Math.abs(hu[1] - 0.18) <= 0.02, `KK equity ${hu[1].toFixed(4)} ≈ 0.18 (±0.02)`)
assert(Math.abs(hu[0] + hu[1] - 1.0) <= 1e-9, 'HU Summe == 1.0 (±1e-9)')

// ── 3-way: AA vs KK vs QQ ─────────────────────────────────────────────────
console.log('\n[3-way] AA vs KK vs QQ (iterations=20000)')
const tw = multiwayEquity([AA, KK, QQ], 20000)
console.log('  AA =', tw[0].toFixed(4), ' KK =', tw[1].toFixed(4), ' QQ =', tw[2].toFixed(4),
  ' Summe =', (tw[0] + tw[1] + tw[2]).toFixed(12))
assert(tw[0] > tw[1] && tw[1] > tw[2], `monotone Reihenfolge AA>KK>QQ (${tw[0].toFixed(3)}>${tw[1].toFixed(3)}>${tw[2].toFixed(3)})`)
// Reale 3-way-Preflop-Equity AA/KK/QQ ≈ 0.667 / 0.173 / 0.159.
assert(Math.abs(tw[0] - 0.667) <= 0.03, `AA equity ${tw[0].toFixed(4)} ≈ 0.667 (±0.03)`)
assert(Math.abs(tw[1] - 0.173) <= 0.03, `KK equity ${tw[1].toFixed(4)} ≈ 0.173 (±0.03)`)
assert(Math.abs(tw[2] - 0.159) <= 0.03, `QQ equity ${tw[2].toFixed(4)} ≈ 0.159 (±0.03)`)
assert(Math.abs(tw[0] + tw[1] + tw[2] - 1.0) <= 1e-9, '3-way Summe == 1.0 (±1e-9)')

// ── Summe-Invariante: zufällige 4-way-Hände ───────────────────────────────
console.log('\n[Summe-Invariante] zufällige 4-way-Hände')
{
  // 8 paarweise verschiedene Karten zufällig wählen
  const deck = Array.from({ length: 52 }, (_, i) => i)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const hands = [
    [deck[0], deck[1]], [deck[2], deck[3]],
    [deck[4], deck[5]], [deck[6], deck[7]],
  ]
  const eq = multiwayEquity(hands, 5000)
  const sum = eq.reduce((a, b) => a + b, 0)
  console.log('  Equities =', eq.map(e => e.toFixed(4)).join(', '), ' Summe =', sum.toFixed(12))
  assert(Math.abs(sum - 1.0) <= 1e-9, `4-way Summe == 1.0 (±1e-9), ist ${sum.toFixed(12)}`)
}

// ── scoreHandsOnBoard: Straight Flush schlägt High Card ───────────────────
console.log('\n[scoreHandsOnBoard] Straight Flush vs High Card')
{
  // Spieler 0: 9s-8s; Board: Ts-Js-Qs-2c-3d  → Straight Flush 8-9-T-J-Q (suit 3 = s)
  // Spieler 1: 2h-7d  → nur High Card
  const p0 = [makeCard(7, 3), makeCard(6, 3)]   // 9s, 8s
  const p1 = [makeCard(0, 2), makeCard(5, 1)]   // 2h, 7d
  const board = [makeCard(8, 3), makeCard(9, 3), makeCard(10, 3), makeCard(0, 0), makeCard(1, 1)] // Ts,Js,Qs,2c,3d
  const sc = scoreHandsOnBoard([p0, p1], board)
  console.log('  score[0] (Straight Flush) =', sc[0], ' score[1] (High Card) =', sc[1])
  assert(sc[0] > sc[1], `Straight Flush score ${sc[0]} > High Card score ${sc[1]}`)
}

console.log('\n' + (failures === 0 ? 'ALLE TESTS BESTANDEN' : `${failures} TEST(S) FEHLGESCHLAGEN`))
process.exit(failures === 0 ? 0 : 1)
