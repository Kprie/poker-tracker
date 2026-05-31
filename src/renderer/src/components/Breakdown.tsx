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
import {
  axisTick,
  CHART_GREEN,
  CHART_RED,
  chartGrid,
  tooltipContentStyle,
  tooltipItemStyle
} from '../lib/chartTheme'

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
            <CartesianGrid strokeDasharray="2 4" stroke={chartGrid} vertical={false} />
            <XAxis dataKey="key" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v) => (metric === 'roi' ? pct(v) : money(v))}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={tooltipContentStyle}
              labelStyle={{ color: '#ededee', fontWeight: 600, marginBottom: 2 }}
              itemStyle={tooltipItemStyle}
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
                <Cell key={d.key} fill={d[metric] >= 0 ? CHART_GREEN : CHART_RED} />
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
