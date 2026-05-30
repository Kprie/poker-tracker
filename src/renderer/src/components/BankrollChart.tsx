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

interface Props {
  data: BankrollPoint[]
}

export function BankrollChart({ data }: Props): JSX.Element {
  const last = data.length ? data[data.length - 1].cumulative : 0
  const positive = last >= 0
  const color = positive ? '#22c55e' : '#ef4444'

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text">Bankroll-Verlauf</h2>
        <span className={`text-sm font-semibold tabular-nums ${positive ? 'text-profit' : 'text-loss'}`}>
          {money(last)}
        </span>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="br" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a313c" vertical={false} />
            <XAxis
              dataKey="index"
              stroke="#8b95a5"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2a313c' }}
            />
            <YAxis
              stroke="#8b95a5"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v) => money(v)}
            />
            <Tooltip
              contentStyle={{
                background: '#161b22',
                border: '1px solid #2a313c',
                borderRadius: 10,
                fontSize: 12
              }}
              labelStyle={{ color: '#8b95a5' }}
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
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
