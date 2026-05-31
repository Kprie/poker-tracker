import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ItmTier } from '../lib/analytics'
import { money, pct } from '../lib/format'
import { Section } from './Section'
import {
  axisTick,
  chartGrid,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle
} from '../lib/chartTheme'

const TIER_COLORS = ['#f0686d', '#e8a838', '#6db8f0', '#3ddc97']

interface Props {
  data: ItmTier[]
  totalResults: number
}

export function ItmDepth({ data, totalResults }: Props): JSX.Element {
  if (totalResults < 10) {
    return (
      <Section title="Cash-Tiefe" aside="ergebnisbasiert">
        <div className="card p-5">
          <p className="py-8 text-center text-sm text-muted">
            Mindestens 10 gewertete Turniere benötigt ({totalResults} vorhanden).
          </p>
        </div>
      </Section>
    )
  }

  return (
    <Section title="Cash-Tiefe" aside="ergebnisbasiert">
      <div className="card p-5">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={38}
                tickFormatter={(v) => String(v)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                formatter={(value: number) => [value, 'Turniere']}
                labelFormatter={(label, payload) => {
                  const d = payload?.[0]?.payload as ItmTier | undefined
                  return d ? `${label} · ${pct(d.pct)} · Ø ${money(d.avgProfit)}` : String(label)
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 2, 2]} maxBarSize={72}>
                {data.map((d, i) => (
                  <Cell key={d.label} fill={TIER_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-3 text-[11px] text-muted">
          Schwellen basieren auf Auszahlung relativ zu Gesamtkosten (inkl. Re-Entries).
        </p>

        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-1.5 font-medium">Tier</th>
              <th className="pb-1.5 text-right font-medium">Anzahl</th>
              <th className="pb-1.5 text-right font-medium">Anteil</th>
              <th className="pb-1.5 text-right font-medium">Ø Profit</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tier, i) => (
              <tr key={tier.label} className="border-t border-white/5">
                <td className="py-1.5 font-medium" style={{ color: TIER_COLORS[i] }}>
                  {tier.label}
                </td>
                <td className="py-1.5 text-right tabnum text-text">{tier.count}</td>
                <td className="py-1.5 text-right tabnum text-text">{pct(tier.pct)}</td>
                <td
                  className={`py-1.5 text-right tabnum ${
                    tier.avgProfit > 0 ? 'text-profit' : tier.avgProfit < 0 ? 'text-loss' : 'text-text'
                  }`}
                >
                  {money(tier.avgProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
