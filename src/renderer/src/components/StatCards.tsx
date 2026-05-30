import type { Kpis } from '../lib/analytics'
import { money, pct } from '../lib/format'

interface Props {
  k: Kpis
}

interface Card {
  label: string
  value: string
  sub?: string
  tone?: 'profit' | 'loss' | 'neutral'
}

export function StatCards({ k }: Props): JSX.Element {
  const profitTone = k.profit > 0 ? 'profit' : k.profit < 0 ? 'loss' : 'neutral'
  const roiTone = k.roi > 0 ? 'profit' : k.roi < 0 ? 'loss' : 'neutral'

  const resultNote =
    k.resultCount < k.count ? `${k.resultCount}/${k.count} mit Ergebnis` : `${k.count} Turniere`

  const cards: Card[] = [
    { label: 'Netto-Profit', value: money(k.profit), tone: profitTone, sub: resultNote },
    { label: 'ROI', value: pct(k.roi), tone: roiTone, sub: `Ø Buy-in ${money(k.avgBuyIn)}` },
    { label: 'Buy-ins gesamt', value: money(k.totalCost), tone: 'neutral' },
    { label: 'Auszahlungen', value: money(k.totalPayout), tone: 'neutral' },
    {
      label: 'ITM-Quote',
      value: pct(k.itmRate),
      sub: `${k.itmCount} im Geld`,
      tone: 'neutral'
    },
    { label: 'Größter Cash', value: money(k.biggestWin), tone: 'neutral' }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="card p-4 transition-colors duration-200 hover:border-border/80"
        >
          <div className="text-[11px] uppercase tracking-wide text-muted/80">{c.label}</div>
          <div
            className={`tabnum mt-1.5 text-[1.7rem] leading-none font-semibold tracking-tight ${
              c.tone === 'profit' ? 'text-profit' : c.tone === 'loss' ? 'text-loss' : 'text-text'
            }`}
          >
            {c.value}
          </div>
          {c.sub && <div className="mt-1.5 text-xs text-muted">{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}
