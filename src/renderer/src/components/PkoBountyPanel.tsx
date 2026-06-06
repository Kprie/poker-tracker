import { useMemo, useState } from 'react'
import { bountyShoveEv } from '../lib/bounty'

const inputCls = 'bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text tabnum focus:outline-none focus:ring-1 focus:ring-accent w-full'

function num(v: string, f = 0): number {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? f : n
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

/**
 * PKO-Bounty-Rechner: sofortiger Bounty-EV einer All-in-Konfrontation. Zeigt, wie
 * der Bounty den Gesamt-EV anhebt (Chip-/ICM-$EV plus Bounty-Cash).
 */
export function PkoBountyPanel(): JSX.Element {
  const [heroStack, setHeroStack]     = useState('40')
  const [villainStack, setVillainStack] = useState('30')
  const [equity, setEquity]           = useState('45')
  const [bounty, setBounty]           = useState('20')
  const [cashFrac, setCashFrac]       = useState('50')
  const [baseEv, setBaseEv]           = useState('0')

  const r = useMemo(() => bountyShoveEv({
    heroStack: num(heroStack), villainStack: num(villainStack),
    heroEquity: num(equity) / 100, villainBounty: num(bounty),
    bountyCashFraction: num(cashFrac) / 100, baseEv: num(baseEv),
  }), [heroStack, villainStack, equity, bounty, cashFrac, baseEv])

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-5">
      <p className="text-xs text-muted">
        Sofortiger Bounty-EV einer All-in-Konfrontation. Hero kassiert den Cash-Anteil des gegnerischen
        Bounties nur, wenn er den Gegner <span className="text-text">covert</span> und gewinnt.
        Zukünftiger Bounty-Wert und eigene Bounty-Liability sind nicht modelliert.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Hero-Stack" value={heroStack} onChange={setHeroStack} suffix="BB" />
        <Field label="Gegner-Stack" value={villainStack} onChange={setVillainStack} suffix="BB" />
        <Field label="Hero-Equity" value={equity} onChange={setEquity} suffix="%" />
        <Field label="Gegner-Bounty" value={bounty} onChange={setBounty} suffix="€" />
        <Field label="Cash-Anteil (PKO 50)" value={cashFrac} onChange={setCashFrac} suffix="%" />
        <Field label="Basis-EV (Chip/ICM)" value={baseEv} onChange={setBaseEv} suffix="€" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Metric label="Covert Gegner?" value={r.covers ? 'Ja' : 'Nein'} tone={r.covers ? 'profit' : 'loss'} />
        <Metric label="Bounty-Cash" value={`${r.bountyCash.toFixed(2)} €`} />
        <Metric label="Bounty-EV" value={`+${r.bountyEv.toFixed(2)} €`} tone="profit" />
        <Metric label="Gesamt-EV" value={`${r.totalEv >= 0 ? '+' : ''}${r.totalEv.toFixed(2)} €`} tone={r.totalEv >= 0 ? 'profit' : 'loss'} />
      </div>

      {!r.covers && (
        <p className="text-[10px] text-gg">
          Hero covert den Gegner nicht (Stack kleiner) — kein Bounty möglich, Entscheidung rein nach Chip-/ICM-$EV.
        </p>
      )}
      <p className="text-[10px] text-slate-600">
        Modellabhängig · nur sofortiger Bounty · gilt nur unter den eingegebenen Annahmen.
      </p>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'profit' | 'loss' }): JSX.Element {
  const cls = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-text'
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      <span className={`text-base font-semibold tabnum ${cls}`}>{value}</span>
    </div>
  )
}
