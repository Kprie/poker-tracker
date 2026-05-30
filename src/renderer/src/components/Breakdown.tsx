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
        <h3 className="text-sm font-semibold tracking-tight text-text">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262e3b" vertical={false} />
            <XAxis
              dataKey="key"
              stroke="#8a94a6"
              tick={{ fontSize: 11, fontFamily: "'Geist Mono Variable', ui-monospace, monospace" }}
              tickLine={false}
              axisLine={{ stroke: '#262e3b' }}
              interval={0}
            />
            <YAxis
              stroke="#8a94a6"
              tick={{ fontSize: 11, fontFamily: "'Geist Mono Variable', ui-monospace, monospace" }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v) => (metric === 'roi' ? pct(v) : money(v))}
            />
            <Tooltip
              cursor={{ fill: '#ffffff0a' }}
              contentStyle={{
                background: '#141922',
                border: '1px solid #262e3b',
                borderRadius: 10,
                fontSize: 12
              }}
              labelStyle={{ color: '#8a94a6' }}
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
                <Cell key={d.key} fill={d[metric] >= 0 ? '#34d399' : '#f76d6d'} />
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
      <h2 className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-text mb-3">
        <span className="h-3.5 w-1 rounded-full bg-accent" />
        Spieltendenzen
      </h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <GroupBarChart title="ROI nach Buy-in-Stufe" data={byBuyIn} metric="roi" hint="ergebnisbasiert" />
        <GroupBarChart title="Profit nach Speed" data={bySpeed} metric="profit" />
        <GroupBarChart title="Profit nach Wochentag" data={byWeekday} metric="profit" />
        <GroupBarChart title="Profit nach Uhrzeit" data={byHour} metric="profit" hint="Startstunde" />
      </div>
    </div>
  )
}
