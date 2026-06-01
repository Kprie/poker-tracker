import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisTick, chartGrid, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '../lib/chartTheme'

interface Props {
  positionEquities: number[][]  // [player][positionIndex]
  payouts: number[]
  playerCount: number
}

// Farben pro Auszahlungsposition (1. Platz = Gold, 2. = Silber, 3. = Bronze …)
const POS_COLORS = [
  '#FFD700', '#C0C0C0', '#CD7F32',
  '#6B7280', '#4B5563', '#374151',
  '#1F2937', '#111827', '#0F172A',
]

function posLabel(k: number): string {
  return `${k + 1}. Platz`
}

export function LadderChart({ positionEquities, payouts, playerCount }: Props): JSX.Element {
  const m = payouts.length

  // Ein Datenpunkt pro Spieler, gestapelt nach Positions-Beitrag
  const data = Array.from({ length: playerCount }, (_, i) => {
    const entry: Record<string, number | string> = { name: `Sp. ${i + 1}` }
    for (let k = 0; k < m; k++) {
      entry[posLabel(k)] = parseFloat((positionEquities[i]?.[k] ?? 0).toFixed(2))
    }
    return entry
  })

  const totalPayout = payouts.reduce((a, b) => a + b, 0)
  const unit = totalPayout > 0 ? '€' : 'Chips'

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Equity-Beitrag je Auszahlungsposition — zeigt, aus welchen Platzierungen die Gesamt-Equity stammt.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chartGrid} vertical={false} />
          <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(0)} ${unit}`}
            width={64}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value: number, name: string) => [
              `${value.toFixed(2)} ${unit}`,
              name,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={val => <span style={{ color: '#9a9aa1' }}>{val}</span>}
          />
          {Array.from({ length: m }, (_, k) => (
            <Bar key={k} dataKey={posLabel(k)} stackId="a" fill={POS_COLORS[k] ?? '#374151'} radius={k === m - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={POS_COLORS[k] ?? '#374151'} opacity={0.85} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
