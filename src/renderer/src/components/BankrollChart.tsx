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
  height?: number
}

const MONO = "'Geist Mono Variable', ui-monospace, monospace"

/** Bankroll area chart only — header/headline live in the hosting panel. */
export function BankrollChart({ data, height = 260 }: Props): JSX.Element {
  const last = data.length ? data[data.length - 1].cumulative : 0
  const color = last >= 0 ? '#3ddc97' : '#ff6b6b'

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="br" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="index"
            stroke="rgba(255,255,255,0.25)"
            tick={{ fontSize: 11, fill: '#8b95a8', fontFamily: MONO }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgba(255,255,255,0.25)"
            tick={{ fontSize: 11, fill: '#8b95a8', fontFamily: MONO }}
            tickLine={false}
            axisLine={false}
            width={62}
            tickFormatter={(v) => money(v)}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(16,20,28,0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              fontSize: 12,
              boxShadow: '0 16px 40px -16px rgba(0,0,0,0.8)'
            }}
            labelStyle={{ color: '#8b95a8' }}
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
