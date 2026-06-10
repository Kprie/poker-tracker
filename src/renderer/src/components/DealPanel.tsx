import { computeDeal, satelliteEquities, isEffectivelyLocked } from '../lib/deal'

interface Props {
  stacks: number[]
  payouts: number[]
}

function money(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Deal-/Chop-Vergleich (Chip-Chop vs. ICM-Chop) plus Satellite-Lock-Indikator,
 * wenn alle Auszahlungen gleich sind (Ticket-Struktur).
 */
export function DealPanel({ stacks, payouts }: Props): JSX.Element {
  const deal = computeDeal(stacks, payouts)
  const totalChips = stacks.reduce((a, b) => a + b, 0)

  // Satellite erkennen: alle (verteilten) Auszahlungen gleich.
  const relevant = payouts.slice(0, Math.min(stacks.length, payouts.length))
  const isSatellite = relevant.length >= 2 && relevant.every(p => Math.abs(p - relevant[0]) < 1e-9)
  const sat = isSatellite ? satelliteEquities(stacks, relevant.length, relevant[0]) : null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Verteilung des Prizepools bei einem Deal. <span className="text-text">Chip-Chop</span> sichert
        jedem den kleinsten Platz und verteilt den Rest nach Chips; <span className="text-text">ICM-Chop</span>
        {' '}verteilt nach Prizepool-Equity (fairer, da Chips nicht-linear sind).
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs text-muted">
              <th className="text-left py-1.5 px-2 font-medium">Spieler</th>
              <th className="text-right py-1.5 px-2 font-medium">Stack</th>
              <th className="text-right py-1.5 px-2 font-medium">Chip-Chop</th>
              <th className="text-right py-1.5 px-2 font-medium">ICM-Chop</th>
              <th className="text-right py-1.5 px-2 font-medium">Differenz</th>
            </tr>
          </thead>
          <tbody>
            {stacks.map((s, i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="py-1.5 px-2 text-text">Sp.&nbsp;{i + 1}</td>
                <td className="py-1.5 px-2 text-right tabnum text-muted">
                  {s.toLocaleString('de-DE')}
                  <span className="ml-1 text-[10px] text-neutral-600">({totalChips > 0 ? ((s / totalChips) * 100).toFixed(0) : 0} %)</span>
                </td>
                <td className="py-1.5 px-2 text-right tabnum text-muted">{money(deal.chipChop[i])}</td>
                <td className="py-1.5 px-2 text-right tabnum text-text">{money(deal.icmChop[i])}</td>
                <td className={`py-1.5 px-2 text-right tabnum ${deal.diff[i] >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {deal.diff[i] >= 0 ? '+' : ''}{money(deal.diff[i])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sat && (
        <div className="rounded-lg border border-white/10 p-3 flex flex-col gap-2">
          <p className="text-xs font-medium text-text">Satellite-Modus ({relevant.length} gleichwertige Tickets)</p>
          <div className="flex flex-wrap gap-2">
            {sat.lockPct.map((lp, i) => (
              <div key={i} className={`rounded-md px-2.5 py-1 text-xs tabnum ${isEffectivelyLocked(lp) ? 'bg-profit/15 text-profit' : 'bg-white/[0.03] text-muted'}`}>
                Sp.&nbsp;{i + 1}: {(lp * 100).toFixed(0)} % Ticket
                {isEffectivelyLocked(lp) && <span className="ml-1">· gesichert</span>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-neutral-600">
            „Gesichert" (≥95 % Ticket-Equity): zusätzliche Chips bringen kaum Wert — selbst sehr starke
            Hände können korrekt gefoldet werden (Survival &gt; Chipakkumulation).
          </p>
        </div>
      )}

      <p className="text-[10px] text-neutral-600">
        Modellabhängig · ICM nach Malmuth-Harville · ignoriert Skill, künftige Blinds und Spieldynamik.
      </p>
    </div>
  )
}
