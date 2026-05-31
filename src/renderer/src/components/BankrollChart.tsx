import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { BankrollPoint } from '../lib/analytics'
import { money } from '../lib/format'
import {
  axisTick,
  CHART_GREEN,
  CHART_RED,
  chartGrid,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle
} from '../lib/chartTheme'

interface Props {
  data: BankrollPoint[]
  height?: number
}

export function BankrollChart({ data, height = 248 }: Props): JSX.Element {
  const last = data.length ? data[data.length - 1].cumulative : 0
  const color = last >= 0 ? CHART_GREEN : CHART_RED

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="br" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={chartGrid} vertical={false} />
          <XAxis dataKey="index" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={62}
            tickFormatter={(v) => money(v)}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(value: number, name) => [money(value), name === 'cumulative' ? 'Bankroll' : name]}
            labelFormatter={(_l, payload) => {
              const p = payload?.[0]?.payload as BankrollPoint | undefined
              return p ? `${p.date} · ${p.name}` : ''
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={color}
            strokeWidth={2}
            fill="url(#br)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
