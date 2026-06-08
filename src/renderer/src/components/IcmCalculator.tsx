import { useMemo, useState } from 'react'
import { computeIcmEquities, convertEquities } from '../lib/icm'
import type { EvMode } from '../lib/icm'
import { inputCls, selectCls } from '../lib/formStyles'

export interface IcmResult {
  equities: number[]
  stacks: number[]
  payouts: number[]
  mode: EvMode
  bbSize: number
  ante: number
}

interface Props {
  onResult: (result: IcmResult) => void
}

// ─── Payout-Presets ───────────────────────────────────────────────────────────

interface PayoutPreset {
  label: string
  players: number
  paid: number
  payouts: string[]
  bbSize: number
}

const PAYOUT_PRESETS: PayoutPreset[] = [
  { label: '—',                           players: 3,  paid: 3,  payouts: ['50','30','20'],              bbSize: 100 },
  { label: 'Heads-Up',                    players: 2,  paid: 1,  payouts: ['100'],                       bbSize: 200 },
  { label: 'SNG 6-Handed (2 bezahlt)',    players: 6,  paid: 2,  payouts: ['65','35'],                   bbSize: 200 },
  { label: 'SNG 9-Handed (3 bezahlt)',    players: 9,  paid: 3,  payouts: ['50','30','20'],              bbSize: 200 },
  { label: 'SNG 9-Handed (5 bezahlt)',    players: 9,  paid: 5,  payouts: ['40','28','18','9','5'],      bbSize: 200 },
  { label: 'Final Table 6 (6 bezahlt)',   players: 6,  paid: 6,  payouts: ['35','22','15','12','9','7'], bbSize: 1000 },
  { label: 'Final Table 9 (9 bezahlt)',   players: 9,  paid: 9,  payouts: ['30','18','12','9','7','6','5','4','3'], bbSize: 1000 },
  { label: 'PKO 9-Handed (3 bezahlt)',    players: 9,  paid: 3,  payouts: ['40','25','15'],              bbSize: 200 },
  { label: 'Satellit (1 Ticket)',         players: 9,  paid: 1,  payouts: ['100'],                       bbSize: 200 },
]

const EV_MODES: { value: EvMode; label: string }[] = [
  { value: 'icm_pct', label: 'ICM %' },
  { value: 'icm_usd', label: 'ICM €' },
  { value: 'chip_ev', label: 'Chip EV' },
  { value: 'chip_bb', label: 'Chip BB' },
]

function defaultStacks(n: number): number[] {
  return Array.from({ length: n }, () => 1000)
}

function defaultPayoutInputs(paid: number): string[] {
  if (paid === 1) return ['100']
  if (paid === 2) return ['65', '35']
  if (paid === 3) return ['50', '30', '20']
  return Array.from({ length: paid }, () => '')
}

export function IcmCalculator({ onResult }: Props): JSX.Element {
  const [playerCount, setPlayerCount] = useState(3)
  const [paidPlaces, setPaidPlaces] = useState(3)
  const [stacks, setStacks] = useState<number[]>(defaultStacks(3))
  const [payoutInputs, setPayoutInputs] = useState<string[]>(defaultPayoutInputs(3))
  const [bbSize, setBbSize] = useState(100)
  const [ante, setAnte] = useState(0)
  const [mode, setMode] = useState<EvMode>('icm_pct')
  const [result, setResult] = useState<IcmResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function applyPreset(preset: PayoutPreset): void {
    setPlayerCount(preset.players)
    setPaidPlaces(preset.paid)
    setStacks(defaultStacks(preset.players))
    setPayoutInputs(preset.payouts)
    setBbSize(preset.bbSize)
    setResult(null)
    setErrors({})
  }

  function handlePlayerCountChange(n: number): void {
    const newPaid = Math.min(paidPlaces, n - 1)
    setPlayerCount(n)
    setPaidPlaces(newPaid)
    setStacks(defaultStacks(n))
    setPayoutInputs(defaultPayoutInputs(newPaid))
    setResult(null)
    setErrors({})
  }

  function handlePaidPlacesChange(n: number): void {
    setPaidPlaces(n)
    setPayoutInputs(defaultPayoutInputs(n))
    setResult(null)
    setErrors({})
  }

  function handleStackChange(idx: number, val: string): void {
    const updated = [...stacks]
    updated[idx] = parseInt(val, 10) || 0
    setStacks(updated)
  }

  function handlePayoutChange(idx: number, val: string): void {
    const updated = [...payoutInputs]
    updated[idx] = val
    setPayoutInputs(updated)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    stacks.forEach((s, i) => {
      if (s <= 0) errs[`stack_${i}`] = 'Stack muss > 0 sein.'
    })
    payoutInputs.forEach((p, i) => {
      const v = parseFloat(p)
      if (isNaN(v) || v < 0) errs[`payout_${i}`] = 'Ungültiger Wert.'
    })
    const totalPayout = payoutInputs.reduce((s, p) => s + (parseFloat(p) || 0), 0)
    if (totalPayout <= 0) errs['payouts'] = 'Die Summe der Auszahlungen muss > 0 sein.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleCalculate(): void {
    if (!validate()) return
    const payouts = payoutInputs.map(p => parseFloat(p))
    const equities = computeIcmEquities(stacks, payouts)
    const r: IcmResult = { equities, stacks, payouts, mode, bbSize, ante }
    setResult(r)
    onResult(r)
  }

  function handleModeChange(m: EvMode): void {
    setMode(m)
    if (result) {
      const updated = { ...result, mode: m }
      setResult(updated)
      onResult(updated)
    }
  }

  const maxStack = result ? Math.max(...result.stacks) : -1

  const converted = useMemo(() => {
    if (!result) return null
    return convertEquities(result.equities, result.stacks, result.payouts, result.mode, result.bbSize)
  }, [result])

  const totalChips = stacks.reduce((s, v) => s + v, 0)

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-6">
      {/* Preset-Auswahl */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted w-32 shrink-0">Schnell-Preset</label>
        <select
          className={selectCls}
          defaultValue=""
          onChange={e => {
            const idx = parseInt(e.target.value, 10)
            if (!isNaN(idx)) applyPreset(PAYOUT_PRESETS[idx])
          }}
        >
          <option value="">Preset wählen…</option>
          {PAYOUT_PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Spieleranzahl + Bezahlte Plätze + BB + Ante */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Spieleranzahl</label>
          <select className={selectCls} value={playerCount} onChange={e => handlePlayerCountChange(Number(e.target.value))}>
            {Array.from({ length: 9 }, (_, i) => i + 2).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Bezahlte Plätze</label>
          <select className={selectCls} value={paidPlaces} onChange={e => handlePaidPlacesChange(Number(e.target.value))}>
            {Array.from({ length: playerCount - 1 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Big Blind (Chips)</label>
          <input
            type="number" min={1}
            className={`${selectCls} w-28`}
            value={bbSize}
            onChange={e => setBbSize(parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Ante (optional)</label>
          <input
            type="number" min={0}
            className={`${selectCls} w-28`}
            value={ante}
            onChange={e => setAnte(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>

      {/* Chip-Stacks */}
      <div>
        <p className="text-sm font-medium text-muted mb-3">Chip-Stacks</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {stacks.map((stack, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label className="text-xs text-muted">Spieler {i + 1}</label>
              <input
                type="number" min={1}
                className={`${inputCls} ${errors[`stack_${i}`] ? 'ring-1 ring-red-500' : ''}`}
                value={stack}
                onChange={e => handleStackChange(i, e.target.value)}
              />
              {errors[`stack_${i}`] && <p className="text-xs text-loss">{errors[`stack_${i}`]}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Auszahlungen */}
      <div>
        <p className="text-sm font-medium text-muted mb-3">Auszahlungen</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {payoutInputs.map((val, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label className="text-xs text-muted">Platz {i + 1}</label>
              <input
                type="number" min={0} step={1}
                className={`${inputCls} ${errors[`payout_${i}`] ? 'ring-1 ring-red-500' : ''}`}
                value={val}
                onChange={e => handlePayoutChange(i, e.target.value)}
              />
              {errors[`payout_${i}`] && <p className="text-xs text-loss">{errors[`payout_${i}`]}</p>}
            </div>
          ))}
        </div>
        {errors['payouts'] && <p className="text-sm text-loss mt-2">{errors['payouts']}</p>}
      </div>

      {/* EV-Modus */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted w-32 shrink-0">EV-Modus</span>
        <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
          {EV_MODES.map(m => (
            <button
              key={m.value}
              className={`px-3 py-1.5 transition-colors ${mode === m.value ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-text'}`}
              onClick={() => handleModeChange(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn-primary self-start" onClick={handleCalculate}>
        Berechnen
      </button>

      {/* Ergebnis-Tabelle */}
      {result && converted && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted">Spieler</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted">Stack</th>
                  {result.ante > 0 && (
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted">Effektiv</th>
                  )}
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted">BB</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted">
                    Equity ({converted.unit})
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.stacks.map((stack, i) => {
                  const isMax = stack === maxStack
                  const effStack = result.ante > 0 ? stack - result.ante : stack
                  const bb = result.bbSize > 0 ? (effStack / result.bbSize).toFixed(1) : '—'
                  const eqVal = converted.values[i]
                  const totalChipsResult = result.stacks.reduce((s, v) => s + v, 0)
                  const chipPct = totalChipsResult > 0 ? ((stack / totalChipsResult) * 100).toFixed(1) : '0'
                  const eqDisplay =
                    result.mode === 'icm_pct'
                      ? `${eqVal.toFixed(2)} %`
                      : result.mode === 'chip_bb'
                        ? `${eqVal.toFixed(1)} BB`
                        : eqVal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                  return (
                    <tr key={i} className={`border-b border-white/5 hover:bg-white/[0.02] ${isMax ? 'font-semibold' : ''}`}>
                      <td className="py-2 px-3 text-text">Spieler {i + 1}</td>
                      <td className="py-2 px-3 text-right tabnum text-text">
                        {stack.toLocaleString('de-DE')}
                        <span className="ml-1 text-muted font-normal text-xs">({chipPct} %)</span>
                      </td>
                      {result.ante > 0 && (
                        <td className="py-2 px-3 text-right tabnum text-muted">
                          {effStack.toLocaleString('de-DE')}
                        </td>
                      )}
                      <td className="py-2 px-3 text-right tabnum text-muted">{bb}</td>
                      <td className="py-2 px-3 text-right tabnum text-profit">{eqDisplay}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Berechnung basiert auf dem Independent Chip Model (Malmuth-Harville). ChipEV ignoriert Auszahlungsstruktur.
          </p>
        </div>
      )}
    </div>
  )
}
