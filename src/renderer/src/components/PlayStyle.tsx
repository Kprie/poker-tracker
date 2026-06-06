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

/** Rate-Anzeige mit Sample-Size-Warnung: unter `min` Gelegenheiten als unsicher markiert. */
function rateTile(label: string, rate: number, opp: number, min: number): { label: string; value: string; sub: string } {
  if (opp === 0) return { label, value: '—', sub: 'keine Gelegenheiten' }
  const low = opp < min
  return {
    label,
    value: pct(rate),
    sub: low ? `n=${opp} · wenig Daten` : `n=${opp}`,
  }
}

export function PlayStyle({ s }: Props): JSX.Element | null {
  if (s.hands === 0) return null

  const lowHands = s.hands < 500

  const preflop = [
    { label: 'VPIP', value: pct(s.vpip), sub: 'freiwillig im Pot' },
    { label: 'PFR', value: pct(s.pfr), sub: 'preflop erhöht' },
    rateTile('3-Bet', s.threeBet, s.threeBetOpp, 100),
    rateTile('4-Bet', s.fourBet, s.fourBetOpp, 30),
    rateTile('Fold vs 3-Bet', s.foldTo3Bet, s.foldTo3BetOpp, 30),
    { label: 'Aggression (AF)', value: s.af.toFixed(2), sub: '(Bet+Raise)/Call' },
  ]

  const postflop = [
    rateTile('C-Bet Flop', s.cbet, s.cbetOpp, 50),
    rateTile('Fold vs C-Bet', s.foldToCbet, s.foldToCbetOpp, 50),
    rateTile('Check-Raise Flop', s.checkRaise, s.checkRaiseOpp, 30),
    { label: 'WTSD', value: pct(s.wtsd), sub: 'bis zum Showdown' },
    { label: 'W$SD', value: pct(s.wonSd), sub: 'am Showdown gewonnen' },
  ]

  return (
    <Section
      title={
        <>
          Spielstil{' '}
          <span className="font-normal text-muted">· aus Hand-Histories</span>
          <span className="ml-1.5 rounded bg-[#f0a500]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#f0a500]">
            nur PokerStars
          </span>
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
      {lowHands && (
        <p className="mb-3 text-xs text-[#f0a500]">
          Kleines Sample ({s.hands.toLocaleString('de-DE')} Hände) — Werte sind statistisch wenig belastbar.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {preflop.map((c) => <KpiTile key={c.label} label={c.label} value={c.value} sub={c.sub} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {postflop.map((c) => <KpiTile key={c.label} label={c.label} value={c.value} sub={c.sub} />)}
      </div>
    </Section>
  )
}
