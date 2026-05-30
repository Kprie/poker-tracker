import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { GroupStat } from '../lib/analytics'
import { money, pct } from '../lib/format'

interface ChartProps {
  title: string
  data: GroupStat[]
  /** which metric to plot as bars */
  metric: 'profit' | 'roi'
  hint?: string
}

function GroupBarChart({ title, data, metric, hint }: ChartProps): JSX.Element {
  return (
    <div className="card p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a313c" vertical={false} />
            <XAxis
              dataKey="key"
              stroke="#8b95a5"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2a313c' }}
              interval={0}
            />
            <YAxis
              stroke="#8b95a5"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v) => (metric === 'roi' ? pct(v) : money(v))}
            />
            <Tooltip
              cursor={{ fill: '#ffffff08' }}
              contentStyle={{
                background: '#161b22',
                border: '1px solid #2a313c',
                borderRadius: 10,
                fontSize: 12
              }}
              labelStyle={{ color: '#8b95a5' }}
              formatter={(value: number) => [
                metric === 'roi' ? pct(value) : money(value),
                metric === 'roi' ? 'ROI' : 'Profit'
              ]}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as GroupStat | undefined
                return p ? `${label} · ${p.count} Turniere · ITM ${pct(p.itmRate)}` : String(label)
              }}
            />
            <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.key} fill={d[metric] >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface Props {
  byBuyIn: GroupStat[]
  bySpeed: GroupStat[]
  byWeekday: GroupStat[]
  byHour: GroupStat[]
}

export function Breakdown({ byBuyIn, bySpeed, byWeekday, byHour }: Props): JSX.Element {
  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-3">Spieltendenzen</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <GroupBarChart title="ROI nach Buy-in-Stufe" data={byBuyIn} metric="roi" hint="ergebnisbasiert" />
        <GroupBarChart title="Profit nach Speed" data={bySpeed} metric="profit" />
        <GroupBarChart title="Profit nach Wochentag" data={byWeekday} metric="profit" />
        <GroupBarChart title="Profit nach Uhrzeit" data={byHour} metric="profit" hint="Startstunde" />
      </div>
    </div>
  )
}
