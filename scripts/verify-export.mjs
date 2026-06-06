// Phase 8: Export-Anonymisierung — kein Spielername im Export.
const { anonymizeForExport } = await import('../src/main/exportUtil.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }

const data = {
  settings: { pokerStarsPath: null },
  tournaments: [
    { id: 'pokerstars:1', source: 'pokerstars', handStats: { hero: 'RealName123', hands: 5 } },
    { id: 'ggpoker:2', source: 'ggpoker' },  // ohne handStats
  ],
}

const out = anonymizeForExport(data)
ok('exportedAt vorhanden', typeof out.exportedAt === 'string' && out.exportedAt.length > 0)
ok('Hero-Name anonymisiert', out.tournaments[0].handStats.hero === 'Hero', out.tournaments[0].handStats.hero)
ok('andere handStats-Felder erhalten', out.tournaments[0].handStats.hands === 5)
ok('Turnier ohne handStats unveraendert', out.tournaments[1].handStats === undefined)
ok('Original unveraendert (kein Mutieren)', data.tournaments[0].handStats.hero === 'RealName123')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
