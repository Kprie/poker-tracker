import type { PlayStyle as PlayStyleData } from '../lib/analytics'
import { pct } from '../lib/format'

interface Props {
  s: PlayStyleData
}

/** Rough qualitative label for a VPIP/PFR pairing. */
function styleLabel(vpip: number, pfr: number): string {
  const gap = vpip - pfr
  const tight = vpip < 0.24
  const aggressive = pfr / Math.max(vpip, 0.0001) > 0.7
  if (vpip === 0) return '—'
  const looseness = tight ? 'Tight' : vpip > 0.4 ? 'Very Loose' : 'Loose'
  const passivity = aggressive ? 'Aggressive' : gap > 0.12 ? 'Passive' : 'Aggressive'
  return `${looseness}-${passivity}`
}

export function PlayStyle({ s }: Props): JSX.Element | null {
  if (s.hands === 0) return null

  const cards: { label: string; value: string; hint?: string }[] = [
    { label: 'VPIP', value: pct(s.vpip), hint: 'freiwillig im Pot' },
    { label: 'PFR', value: pct(s.pfr), hint: 'preflop erhöht' },
    { label: '3-Bet', value: pct(s.threeBet), hint: 'von Gelegenheiten' },
    { label: 'Aggression (AF)', value: s.af.toFixed(2), hint: '(Bet+Raise)/Call' },
    { label: 'WTSD', value: pct(s.wtsd), hint: 'bis zum Showdown' },
    { label: 'W$SD', value: pct(s.wonSd), hint: 'am Showdown gewonnen' }
  ]

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-text">
          Spielstil <span className="text-muted font-normal">· aus Hand-Histories</span>
        </h2>
        <span className="text-xs text-muted">
          {s.hands.toLocaleString('de-DE')} Hände · {s.tournaments} Turniere ·{' '}
          <span className="text-text">{styleLabel(s.vpip, s.pfr)}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-xs text-muted">{c.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-text">{c.value}</div>
            {c.hint && <div className="mt-0.5 text-xs text-muted">{c.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
