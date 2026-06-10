// Geteiltes Top-Panel für den Turnier-Kontext (nur im Eingabemodus „Gemeinsam").
// Editiert players/stacks/payouts/bbSize/ante zentral im useSpotStore; die
// kontext-gesteuerten Tools lesen diese Werte über useToolContext.
import { useSpotStore, defaultPayoutInputs } from '../lib/spotStore'
import { PAYOUT_PRESETS } from './IcmCalculator'
import { inputCls, selectCls } from '../lib/formStyles'

export function SpotContextPanel(): JSX.Element {
  const players = useSpotStore((s) => s.players)
  const stacks = useSpotStore((s) => s.stacks)
  const payoutInputs = useSpotStore((s) => s.payoutInputs)
  const bbSize = useSpotStore((s) => s.bbSize)
  const ante = useSpotStore((s) => s.ante)
  const setContext = useSpotStore((s) => s.setContext)
  const setStacks = useSpotStore((s) => s.setStacks)
  const setBbSize = useSpotStore((s) => s.setBbSize)
  const setAnte = useSpotStore((s) => s.setAnte)

  const paidPlaces = payoutInputs.length

  function applyPreset(idx: number): void {
    const p = PAYOUT_PRESETS[idx]
    setContext({
      players: p.players,
      stacks: Array.from({ length: p.players }, (_, i) => stacks[i] ?? 1000),
      payoutInputs: p.payouts,
      bbSize: p.bbSize,
    })
  }

  function changePlayers(n: number): void {
    const newStacks = Array.from({ length: n }, (_, i) => stacks[i] ?? 1000)
    const newPaid = Math.min(paidPlaces, n - 1)
    setContext({ players: n, stacks: newStacks, payoutInputs: payoutInputs.slice(0, newPaid) })
  }

  function changePaid(n: number): void {
    const next = Array.from({ length: n }, (_, i) => payoutInputs[i] ?? defaultPayoutInputs(n)[i] ?? '')
    setContext({ payoutInputs: next })
  }

  function changeStack(i: number, val: string): void {
    const next = [...stacks]
    next[i] = parseInt(val, 10) || 0
    setStacks(next)
  }

  function changePayout(i: number, val: string): void {
    const next = [...payoutInputs]
    next[i] = val
    setContext({ payoutInputs: next })
  }

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-6">
      {/* Preset-Auswahl */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted w-32 shrink-0">Schnell-Preset</label>
        <select
          className={selectCls}
          defaultValue=""
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10)
            if (!isNaN(idx)) applyPreset(idx)
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
          <select className={selectCls} value={players} onChange={(e) => changePlayers(Number(e.target.value))}>
            {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Bezahlte Plätze</label>
          <select className={selectCls} value={paidPlaces} onChange={(e) => changePaid(Number(e.target.value))}>
            {Array.from({ length: players - 1 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Big Blind (Chips)</label>
          <input type="number" min={1} className={`${selectCls} w-28`} value={bbSize}
            onChange={(e) => setBbSize(parseInt(e.target.value, 10) || 1)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Ante (optional)</label>
          <input type="number" min={0} className={`${selectCls} w-28`} value={ante}
            onChange={(e) => setAnte(parseInt(e.target.value, 10) || 0)} />
        </div>
      </div>

      {/* Chip-Stacks */}
      <div>
        <p className="text-sm font-medium text-muted mb-3">Chip-Stacks</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {stacks.map((stack, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label className="text-xs text-muted">{i === 0 ? <span className="text-accent font-semibold">Hero</span> : `Gegner ${i}`}</label>
              <input type="number" min={1} className={inputCls} value={stack}
                onChange={(e) => changeStack(i, e.target.value)} />
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
              <input type="number" min={0} step={1} className={inputCls} value={val}
                onChange={(e) => changePayout(i, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
