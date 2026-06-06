// Phase 5: Risk Premium, Deal/Chop, Satellite, PKO-Bounty.
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const { requiredCallEquity, riskPremium, computeIcmEquities } = await import('../src/renderer/src/lib/icm.ts')
const { chipChop, computeDeal, satelliteEquities, isEffectivelyLocked } = await import('../src/renderer/src/lib/deal.ts')
const { bountyShoveEv, totalBountyEv } = await import('../src/renderer/src/lib/bounty.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e
const sum = a => a.reduce((x, y) => x + y, 0)

// ── Risk Premium ──
ok('requiredCallEquity BF=1 = 0.5', near(requiredCallEquity(1), 0.5))
ok('requiredCallEquity BF=2 = 2/3', near(requiredCallEquity(2), 2 / 3))
ok('requiredCallEquity BF=∞ = 1', near(requiredCallEquity(Infinity), 1))
ok('riskPremium BF=1 = 0', near(riskPremium(1), 0))
ok('riskPremium BF=2 ≈ 0.1667', near(riskPremium(2), 1 / 6))

// ── Chip-Chop ──
{
  const cc = chipChop([5000, 3000, 2000], [50, 30, 20])
  ok('chipChop Σ = Prizepool', near(sum(cc), 100), `Σ=${sum(cc)}`)
  ok('chipChop = [40,32,28]', near(cc[0], 40) && near(cc[1], 32) && near(cc[2], 28), `[${cc.map(x => x.toFixed(1))}]`)
  ok('chipChop komprimiert (Leader<prop, Short>prop)', cc[0] < 50 && cc[2] > 20)
}

// ── Deal: ICM-Chop Σ = Prizepool, diff Σ = 0 ──
{
  const d = computeDeal([5000, 3000, 2000], [50, 30, 20])
  ok('icmChop Σ = Prizepool', near(sum(d.icmChop), 100), `Σ=${sum(d.icmChop)}`)
  ok('deal diff Σ ≈ 0', near(sum(d.diff), 0, 1e-9))
  ok('icmChop komprimierter als reine Chips für Leader', d.icmChop[0] < 50)
}

// ── Satellite ──
{
  const s = satelliteEquities([3000, 3000, 3000], 2, 1)  // 3 gleiche Stacks, 2 Tickets
  ok('Satellite Σ Ticket-Equity = tickets', near(sum(s.ticketEquity), 2), `Σ=${sum(s.ticketEquity)}`)
  ok('Satellite gleiche Stacks → je 2/3', near(s.ticketEquity[0], 2 / 3), `${s.ticketEquity[0]}`)

  const big = satelliteEquities([9000, 500, 500], 2, 1)  // Chipleader ~ gesichert
  ok('Satellite Chipleader fast gesichert', big.lockPct[0] > 0.95, `lock=${big.lockPct[0].toFixed(3)}`)
  ok('isEffectivelyLocked Leader = true', isEffectivelyLocked(big.lockPct[0]))
  ok('isEffectivelyLocked Short = false', !isEffectivelyLocked(big.lockPct[1]))
}

// ── PKO-Bounty ──
{
  const r = bountyShoveEv({ heroStack: 100, villainStack: 80, heroEquity: 0.6, villainBounty: 10, bountyCashFraction: 0.5 })
  ok('bounty: covert', r.covers === true)
  ok('bounty: Cash = 5', near(r.bountyCash, 5))
  ok('bounty: EV = 0.6×5 = 3', near(r.bountyEv, 3), `${r.bountyEv}`)

  const r2 = bountyShoveEv({ heroStack: 50, villainStack: 80, heroEquity: 0.6, villainBounty: 10 })
  ok('bounty: nicht covert → EV 0', r2.covers === false && near(r2.bountyEv, 0))

  const r3 = bountyShoveEv({ heroStack: 100, villainStack: 80, heroEquity: 0.6, villainBounty: 10, baseEv: -1 })
  ok('bounty: totalEv = baseEv + bountyEv', near(r3.totalEv, -1 + 3))

  const t = totalBountyEv(100, [{ stack: 50, bounty: 10, equity: 0.6 }, { stack: 120, bounty: 8, equity: 0.4 }], 0.5)
  ok('totalBountyEv: nur gedeckte zählen (3)', near(t, 3), `${t}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
