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
import { Section } from './Section'

const MONO = "'Geist Mono Variable', ui-monospace, monospace"

const tooltipStyle = {
  background: 'rgba(20,20,21,0.96)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 16px 40px -16px rgba(0,0,0,0.8)'
} as const

interface ChartProps {
  title: string
  data: GroupStat[]
  metric: 'profit' | 'roi'
  hint?: string
}

function GroupBarChart({ title, data, metric, hint }: ChartProps): JSX.Element {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-text">{title}</h3>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="key"
              tick={{ fontSize: 11, fill: '#9a9aa1', fontFamily: MONO }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9a9aa1', fontFamily: MONO }}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v) => (metric === 'roi' ? pct(v) : money(v))}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#ededee', fontWeight: 600, marginBottom: 2 }}
              itemStyle={{ color: '#ededee' }}
              formatter={(value: number) => [
                metric === 'roi' ? pct(value) : money(value),
                metric === 'roi' ? 'ROI' : 'Profit'
              ]}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as GroupStat | undefined
                return p ? `${label} · ${p.count} Turniere · ITM ${pct(p.itmRate)}` : String(label)
              }}
            />
            <Bar dataKey={metric} radius={[6, 6, 2, 2]} maxBarSize={60}>
              {data.map((d) => (
                <Cell key={d.key} fill={d[metric] >= 0 ? '#3ddc97' : '#f0686d'} />
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
    <Section title="Spieltendenzen" aside="ergebnisbasiert">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <GroupBarChart title="ROI nach Buy-in-Stufe" data={byBuyIn} metric="roi" />
        <GroupBarChart title="Profit nach Speed" data={bySpeed} metric="profit" />
        <GroupBarChart title="Profit nach Wochentag" data={byWeekday} metric="profit" />
        <GroupBarChart title="Profit nach Uhrzeit" data={byHour} metric="profit" hint="Startstunde" />
      </div>
    </Section>
  )
}
