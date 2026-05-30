import type { PlayStyle as PlayStyleData } from '../lib/analytics'
import { pct } from '../lib/format'
import { Panel } from './Panel'
import { KpiTile } from './KpiTile'

interface Props {
  s: PlayStyleData
}

/** Rough qualitative label for a VPIP/PFR pairing. */
function styleLabel(vpip: number, pfr: number): string {
  if (vpip === 0) return '—'
  const gap = vpip - pfr
  const tight = vpip < 0.24
  const aggressive = pfr / Math.max(vpip, 0.0001) > 0.7
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
    <Panel
      title={
        <>
          Spielstil <span className="font-normal text-muted">· aus Hand-Histories</span>
        </>
      }
      aside={
        <>
          <span className="tabnum text-text">{s.hands.toLocaleString('de-DE')}</span> Hände ·{' '}
          <span className="tabnum text-text">{s.tournaments}</span> Turniere ·{' '}
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">
            {styleLabel(s.vpip, s.pfr)}
          </span>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <KpiTile key={c.label} label={c.label} value={c.value} sub={c.hint} />
        ))}
      </div>
    </Panel>
  )
}
