import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  axisTick,
  chartGrid,
  CHART_GREEN,
  CHART_UNKNOWN,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from '../lib/chartTheme'

interface Props {
  equities: number[]     // ICM-Equities in Payout-Einheit
  stacks: number[]
  payouts: number[]
}

export function IcmCompareChart({ equities, stacks, payouts }: Props): JSX.Element {
  const totalPayout = payouts.reduce((a, b) => a + b, 0)
  const totalChips = stacks.reduce((a, b) => a + b, 0)

  const data = stacks.map((stack, i) => {
    const chipEv = totalChips > 0 ? (stack / totalChips) * 100 : 0
    const icmPct = totalPayout > 0 ? (equities[i] / totalPayout) * 100 : 0
    const diff = icmPct - chipEv
    return {
      name: `Sp. ${i + 1}`,
      'Chip EV': parseFloat(chipEv.toFixed(2)),
      'ICM': parseFloat(icmPct.toFixed(2)),
      diff,
    }
  })

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Chip&nbsp;EV (proportionaler Anteil) vs. ICM-Equity — positive Differenz = ICM-Prämie,
        negative = ICM-Steuer.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid stroke={chartGrid} vertical={false} />
          <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(0)} %`}
            width={48}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value: number, name: string) => [`${value.toFixed(2)} %`, name]}
          />
          <Bar dataKey="Chip EV" fill={CHART_UNKNOWN} radius={[3, 3, 0, 0]} opacity={0.75}>
            <LabelList
              dataKey="Chip EV"
              position="top"
              style={{ fontSize: 9, fill: '#9a9aa1' }}
              formatter={(v: number) => `${v.toFixed(1)}%`}
            />
          </Bar>
          <Bar dataKey="ICM" fill={CHART_GREEN} radius={[3, 3, 0, 0]} opacity={0.85}>
            <LabelList
              dataKey="diff"
              position="top"
              style={{ fontSize: 9 }}
              formatter={(v: number) => {
                if (Math.abs(v) < 0.05) return ''
                return v > 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`
              }}
              // colour the diff label based on sign — done via content prop below
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Differenz-Übersicht als kompakte Zeile */}
      <div className="flex flex-wrap gap-3">
        {data.map((d, i) => (
          <span key={i} className="text-xs tabnum">
            <span className="text-muted">Sp. {i + 1}: </span>
            <span className={d.diff > 0.05 ? 'text-profit' : d.diff < -0.05 ? 'text-loss' : 'text-text'}>
              {d.diff > 0 ? '+' : ''}{d.diff.toFixed(2)} %
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
