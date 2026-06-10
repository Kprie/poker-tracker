import { useMemo, useState } from 'react'
import {
  requiredEquityCall, breakEvenFoldFreq, callEvChips, betEv, sizingComparison,
} from '../lib/betEv'
import { inputCls } from '../lib/formStyles'

// ─── Pot-Odds- & Bet-EV-Rechner (Turnier, Chip-EV) ────────────────────────────
// Einheit: BB. Rein analytisch. ICM-Aufschlag (Risk Premium) als manuelle Eingabe
// — exakte ICM-Schwellen liefert der Spot-Analyser.

function num(v: string, fallback = 0): number {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? fallback : n
}

function Field({ label, value, onChange, suffix }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <div className="relative">
        <input className={inputCls} value={value} onChange={e => onChange(e.target.value)} inputMode="decimal" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">{suffix}</span>}
      </div>
    </div>
  )
}

export function PotOddsCalculator(): JSX.Element {
  // ── Call-Sektion ──
  const [potWithBet, setPotWithBet] = useState('150')
  const [callAmount, setCallAmount] = useState('50')
  const [callEquity, setCallEquity] = useState('40')
  const [riskPremium, setRiskPremium] = useState('0')

  // ── Bet-Sektion ──
  const [potBefore, setPotBefore]   = useState('100')
  const [betSize, setBetSize]       = useState('50')
  const [betEquity, setBetEquity]   = useState('35')
  const [foldFreq, setFoldFreq]     = useState('45')

  const call = useMemo(() => {
    const pot = num(potWithBet), c = num(callAmount), eq = num(callEquity) / 100, rp = num(riskPremium) / 100
    const req = requiredEquityCall(pot, c)
    const reqIcm = Math.min(1, req + rp)
    const ev = callEvChips(eq, pot, c)
    return { req, reqIcm, ev, eq, profitable: eq >= reqIcm }
  }, [potWithBet, callAmount, callEquity, riskPremium])

  const bet = useMemo(() => {
    const P = num(potBefore), B = num(betSize), F = num(foldFreq) / 100, E = num(betEquity) / 100
    const be = breakEvenFoldFreq(P, B)
    const ev = betEv({ potBefore: P, bet: B, call: B, foldFreq: F, equityWhenCalled: E })
    return { be, ev, F }
  }, [potBefore, betSize, betEquity, foldFreq])

  const sizing = useMemo(() => {
    const P = num(potBefore), F = num(foldFreq) / 100, E = num(betEquity) / 100
    return sizingComparison(P, [0.33, 0.5, 0.75, 1.0, 1.5], F, E)
  }, [potBefore, betEquity, foldFreq])

  const pctRP = num(riskPremium) > 0

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-6">
      <p className="text-xs text-muted">
        Rein analytischer Chip-EV-Rechner (Einheit: BB). In ICM-intensiven Spots steigt die benötigte
        Equity um den <span className="text-text">Risk Premium</span> — manuell eingeben oder im
        Spot-Analyser ICM-genau berechnen.
      </p>

      {/* ── Call-Analyse ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-4">
        <p className="text-sm font-medium text-text">Call-Analyse (Pot Odds)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Pot inkl. Villain-Bet" value={potWithBet} onChange={setPotWithBet} suffix="BB" />
          <Field label="Zu callen" value={callAmount} onChange={setCallAmount} suffix="BB" />
          <Field label="Hero-Equity" value={callEquity} onChange={setCallEquity} suffix="%" />
          <Field label="Risk Premium (ICM)" value={riskPremium} onChange={setRiskPremium} suffix="%" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Metric label="Benötigte Equity" value={`${(call.req * 100).toFixed(1)} %`} />
          <Metric label={pctRP ? 'Benötigt inkl. RP' : 'Benötigt (ICM)'} value={`${(call.reqIcm * 100).toFixed(1)} %`} tone={pctRP ? 'warn' : undefined} />
          <Metric label="Call-EV (Chip)" value={`${call.ev >= 0 ? '+' : ''}${call.ev.toFixed(2)} BB`} tone={call.ev >= 0 ? 'profit' : 'loss'} />
          <Metric label="Verdikt" value={call.profitable ? 'CALL' : 'FOLD'} tone={call.profitable ? 'profit' : 'loss'} />
        </div>
      </div>

      {/* ── Bet-/Bluff-Analyse ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-4">
        <p className="text-sm font-medium text-text">Bet-/Bluff-Analyse (Fold Equity)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Pot vor Bet" value={potBefore} onChange={setPotBefore} suffix="BB" />
          <Field label="Bet-Größe" value={betSize} onChange={setBetSize} suffix="BB" />
          <Field label="Equity wenn gecallt" value={betEquity} onChange={setBetEquity} suffix="%" />
          <Field label="Erwartete Foldfreq." value={foldFreq} onChange={setFoldFreq} suffix="%" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Metric label="Break-even-Foldfreq." value={`${(bet.be * 100).toFixed(1)} %`} />
          <Metric label="Bet-EV" value={`${bet.ev >= 0 ? '+' : ''}${bet.ev.toFixed(2)} BB`} tone={bet.ev >= 0 ? 'profit' : 'loss'} />
          <Metric label="Marge ggü. Break-even" value={`${((bet.F - bet.be) * 100).toFixed(1)} %-Pkt`} tone={bet.F >= bet.be ? 'profit' : 'loss'} />
        </div>

        {/* Sizing-Vergleich */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted">
                <th className="text-left py-1.5 px-2 font-medium">Sizing</th>
                <th className="text-right py-1.5 px-2 font-medium">Bet (BB)</th>
                <th className="text-right py-1.5 px-2 font-medium">Break-even-Fold</th>
                <th className="text-right py-1.5 px-2 font-medium">EV @ {foldFreq} % Fold</th>
              </tr>
            </thead>
            <tbody>
              {sizing.map(r => (
                <tr key={r.fraction} className="border-b border-white/5">
                  <td className="py-1.5 px-2 text-text">{Math.round(r.fraction * 100)} % Pot</td>
                  <td className="py-1.5 px-2 text-right tabnum text-muted">{r.bet.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-right tabnum text-muted">{(r.breakEvenFold * 100).toFixed(1)} %</td>
                  <td className={`py-1.5 px-2 text-right tabnum ${r.evAtFold >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {r.evAtFold >= 0 ? '+' : ''}{r.evAtFold.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-neutral-600">
        Modellabhängig · Chip-EV ohne zukünftige Straßen · Caller-Betrag = Bet · gilt nur unter den eingegebenen Annahmen.
      </p>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'profit' | 'loss' | 'warn' }): JSX.Element {
  const cls = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : tone === 'warn' ? 'text-gg' : 'text-text'
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      <span className={`text-base font-semibold tabnum ${cls}`}>{value}</span>
    </div>
  )
}
