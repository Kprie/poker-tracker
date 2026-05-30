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
  const color = positive ? '#34d399' : '#f76d6d'

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-text">
          <span className="h-3.5 w-1 rounded-full bg-accent" />
          Bankroll-Verlauf
        </h2>
        <span className={`text-base font-semibold tabnum ${positive ? 'text-profit' : 'text-loss'}`}>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#262e3b" vertical={false} />
            <XAxis
              dataKey="index"
              stroke="#8a94a6"
              tick={{ fontSize: 11, fontFamily: "'Geist Mono Variable', ui-monospace, monospace" }}
              tickLine={false}
              axisLine={{ stroke: '#262e3b' }}
            />
            <YAxis
              stroke="#8a94a6"
              tick={{ fontSize: 11, fontFamily: "'Geist Mono Variable', ui-monospace, monospace" }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v) => money(v)}
            />
            <Tooltip
              contentStyle={{
                background: '#141922',
                border: '1px solid #262e3b',
                borderRadius: 10,
                fontSize: 12
              }}
              labelStyle={{ color: '#8a94a6' }}
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
