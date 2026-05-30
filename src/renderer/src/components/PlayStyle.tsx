import type { PlayStyle as PlayStyleData } from '../lib/analytics'
import { pct } from '../lib/format'
import { Section } from './Section'
import { KpiTile } from './KpiTile'

interface Props {
  s: PlayStyleData
}

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
    <Section
      title={
        <>
          Spielstil <span className="font-normal text-muted">· aus Hand-Histories</span>
        </>
      }
      aside={
        <span className="inline-flex items-center gap-2">
          <span>
            <span className="tabnum text-text">{s.hands.toLocaleString('de-DE')}</span> Hände
          </span>
          <span className="rounded-md bg-accent/12 px-2 py-0.5 text-accent">
            {styleLabel(s.vpip, s.pfr)}
          </span>
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <KpiTile key={c.label} label={c.label} value={c.value} sub={c.hint} />
        ))}
      </div>
    </Section>
  )
}
