// Phase 2: Positions-Modell. Prüft nBehind, active-Sitze und Post-Struktur.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { seatLayoutForPosition } = await import('../src/renderer/src/lib/positions.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const eqArr = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── 6-max, kein Ante ──
{
  const btn = seatLayoutForPosition('BTN', 6, 200, 0)
  ok('BTN/6: nBehind=2', btn.nBehind === 2, `${btn.nBehind}`)
  ok('BTN/6: active=[0,1,2]', eqArr(btn.active, [0, 1, 2]), JSON.stringify(btn.active))
  ok('BTN/6: posts=[0,100,200,0,0,0]', eqArr(btn.posts, [0, 100, 200, 0, 0, 0]), JSON.stringify(btn.posts))

  const utg = seatLayoutForPosition('UTG', 6, 200, 0)
  ok('UTG/6: nBehind=5 (alle)', utg.nBehind === 5, `${utg.nBehind}`)
  ok('UTG/6: posts SB/BB auf Sitz 4/5', eqArr(utg.posts, [0, 0, 0, 0, 100, 200]), JSON.stringify(utg.posts))

  const sb = seatLayoutForPosition('SB', 6, 200, 0)
  ok('SB/6: nBehind=1', sb.nBehind === 1, `${sb.nBehind}`)
  ok('SB/6: Hero postet SB', eqArr(sb.posts, [100, 200, 0, 0, 0, 0]), JSON.stringify(sb.posts))
}

// ── Position-Ordnung: später = weniger Responder ──
{
  const n = p => seatLayoutForPosition(p, 6, 200, 0).nBehind
  ok('nBehind: BTN<CO<HJ<UTG', n('BTN') < n('CO') && n('CO') < n('HJ') && n('HJ') < n('UTG'),
     `BTN${n('BTN')} CO${n('CO')} HJ${n('HJ')} UTG${n('UTG')}`)
  ok('nBehind: SB=1, BB clamped≥1', n('SB') === 1 && seatLayoutForPosition('BB', 6, 200, 0).nBehind >= 1)
}

// ── Ante wird auf alle aktiven Sitze verteilt ──
{
  const btn = seatLayoutForPosition('BTN', 6, 200, 25)
  ok('BTN/6+Ante: posts=[25,125,225,0,0,0]', eqArr(btn.posts, [25, 125, 225, 0, 0, 0]), JSON.stringify(btn.posts))
}

// ── HU ──
{
  const sb = seatLayoutForPosition('SB', 2, 200, 0)
  ok('HU SB: active=[0,1], posts=[100,200]', eqArr(sb.active, [0, 1]) && eqArr(sb.posts, [100, 200]), JSON.stringify(sb.posts))
}

// ── Clamp: CO an 3-max nutzt nur players-1 ──
{
  const co = seatLayoutForPosition('CO', 3, 200, 0)
  ok('CO/3: nBehind auf players-1 gekappt (2)', co.nBehind === 2, `${co.nBehind}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
