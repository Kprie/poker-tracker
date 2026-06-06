globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, v) },
}
const { lookupEquity, lookupEquityVsRange } = await import('../src/renderer/src/lib/equityTable.ts')
const { ALL_HAND_IDS } = await import('../src/renderer/src/data/pushFoldData.ts')
const { handIdToCombos } = await import('../src/renderer/src/lib/cards.ts')

// Direkte Hand-vs-Hand-Equities (bekannte Referenzwerte):
const aa_vs_72o = lookupEquity('AA', '72o')   // ~0.88
const aa_vs_kk  = lookupEquity('AA', 'KK')    // ~0.82
const ako_vs_qq = lookupEquity('AKo', 'QQ')   // ~0.43 (coinflip-ish, leicht underdog)
const t72o_vs_aa = lookupEquity('72o', 'AA')  // ~0.12
console.log('lookupEquity AA vs 72o =', aa_vs_72o.toFixed(3), '(erwartet ~0.88)')
console.log('lookupEquity AA vs KK  =', aa_vs_kk.toFixed(3), '(erwartet ~0.82)')
console.log('lookupEquity AKo vs QQ =', ako_vs_qq.toFixed(3), '(erwartet ~0.43)')
console.log('lookupEquity 72o vs AA =', t72o_vs_aa.toFixed(3), '(erwartet ~0.12)')

// Equity vs voller Range OHNE Blocking:
const full = new Map(ALL_HAND_IDS.map(id => [id, 1]))
const aa_vs_full = lookupEquityVsRange('AA', full)
const t72o_vs_full = lookupEquityVsRange('72o', full)
console.log('\nlookupEquityVsRange AA  vs full (kein Blocking) =', aa_vs_full.toFixed(3), '(erwartet ~0.85)')
console.log('lookupEquityVsRange 72o vs full (kein Blocking) =', t72o_vs_full.toFixed(3), '(erwartet ~0.34)')

// Equity vs voller Range MIT Blocking (repräsentativer Combo):
const aaRep = handIdToCombos('AA')[0]
const t72oRep = handIdToCombos('72o')[0]
const aa_vs_full_b = lookupEquityVsRange('AA', full, aaRep)
const t72o_vs_full_b = lookupEquityVsRange('72o', full, t72oRep)
console.log('\nlookupEquityVsRange AA  vs full (mit Blocking) =', aa_vs_full_b.toFixed(3), '(erwartet ~0.85)')
console.log('lookupEquityVsRange 72o vs full (mit Blocking) =', t72o_vs_full_b.toFixed(3), '(erwartet ~0.34)')
