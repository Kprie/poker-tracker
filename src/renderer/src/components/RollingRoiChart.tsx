import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { Tournament } from '../../../shared/types'
import { rollingRoiSeries, type RollingRoiPoint } from '../lib/analytics'
import { pct } from '../lib/format'
import { Section } from './Section'
import {
  axisTick,
  CHART_GREEN,
  CHART_RED,
  chartGrid,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle
} from '../lib/chartTheme'

const WINDOWS = [20, 50, 100] as const
type WindowSize = (typeof WINDOWS)[number]

interface Props {
  rows: Tournament[]
}

export function RollingRoiChart({ rows }: Props): JSX.Element {
  const [win, setWin] = useState<WindowSize>(20)

  const data = useMemo(() => rollingRoiSeries(rows, win), [rows, win])
  const visible = data

  return (
    <Section title="Rolling ROI" aside={`Fenster: ${win} Turniere`}>
      <div className="card p-5">
        <div className="mb-4 flex gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWin(w)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                win === w
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted hover:text-text'
              }`}
            >
              {w}
            </button>
          ))}
        </div>

        {rows.length < win ? (
          <p className="py-10 text-center text-sm text-muted">
            Mindestens {win} gewertete Turniere benötigt ({rows.length} vorhanden).
          </p>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visible} margin={{ top: 6, right: 6, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={chartGrid} vertical={false} />
                <XAxis
                  dataKey="index"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.ceil(visible.length / 8) - 1)}
                />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  tickFormatter={(v) => pct(v)}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => [pct(value), `ROI (letzte ${win})`]}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as RollingRoiPoint | undefined
                    return p ? `Turnier #${p.index} · ${p.date}` : ''
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="roi"
                  stroke={CHART_GREEN}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: CHART_GREEN }}
                />
                <ReferenceLine
                  y={visible.length ? visible[visible.length - 1].roi : 0}
                  stroke={
                    visible.length && visible[visible.length - 1].roi >= 0 ? CHART_GREEN : CHART_RED
                  }
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Section>
  )
}
