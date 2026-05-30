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
import { Panel } from './Panel'

const MONO = "'Geist Mono Variable', ui-monospace, monospace"

interface ChartProps {
  title: string
  data: GroupStat[]
  metric: 'profit' | 'roi'
  hint?: string
}

function GroupBarChart({ title, data, metric, hint }: ChartProps): JSX.Element {
  return (
    <div className="tile p-4">
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
              stroke="rgba(255,255,255,0.25)"
              tick={{ fontSize: 11, fill: '#8b95a8', fontFamily: MONO }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              stroke="rgba(255,255,255,0.25)"
              tick={{ fontSize: 11, fill: '#8b95a8', fontFamily: MONO }}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v) => (metric === 'roi' ? pct(v) : money(v))}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: 'rgba(16,20,28,0.92)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                fontSize: 12,
                boxShadow: '0 16px 40px -16px rgba(0,0,0,0.8)'
              }}
              labelStyle={{ color: '#8b95a8' }}
              formatter={(value: number) => [
                metric === 'roi' ? pct(value) : money(value),
                metric === 'roi' ? 'ROI' : 'Profit'
              ]}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as GroupStat | undefined
                return p ? `${label} · ${p.count} Turniere · ITM ${pct(p.itmRate)}` : String(label)
              }}
            />
            <Bar dataKey={metric} radius={[6, 6, 2, 2]} maxBarSize={64}>
              {data.map((d) => (
                <Cell key={d.key} fill={d[metric] >= 0 ? '#3ddc97' : '#ff6b6b'} />
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
    <Panel title="Spieltendenzen" aside="ergebnisbasiert">
      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
        <GroupBarChart title="ROI nach Buy-in-Stufe" data={byBuyIn} metric="roi" />
        <GroupBarChart title="Profit nach Speed" data={bySpeed} metric="profit" />
        <GroupBarChart title="Profit nach Wochentag" data={byWeekday} metric="profit" />
        <GroupBarChart title="Profit nach Uhrzeit" data={byHour} metric="profit" hint="Startstunde" />
      </div>
    </Panel>
  )
}
