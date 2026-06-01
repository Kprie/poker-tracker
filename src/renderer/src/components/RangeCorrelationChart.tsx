import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer,
} from 'recharts'
import {
  CHART_GREEN, axisTick, chartGrid,
  tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle,
} from '../lib/chartTheme'
import type { RangeCorrelationPoint } from '../lib/chartData'

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
}): JSX.Element | null {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipContentStyle} className="px-3 py-2">
      <p style={tooltipLabelStyle}>BB Call Range {label} %</p>
      <p style={tooltipItemStyle}>Hero Push Range {payload[0].value.toFixed(1)} %</p>
    </div>
  )
}

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  data: RangeCorrelationPoint[]
  nashPoint: { callPct: number; pushPct: number }
}

export function RangeCorrelationChart({ data, nashPoint }: Props): JSX.Element {
  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-3 text-xs text-muted">
        <span>
          Range-Korrelation — Nash-Gleichgewicht:
          Villain callt{' '}
          <span className="tabnum text-text font-semibold">{nashPoint.callPct.toFixed(0)} %</span>
          {' '}→ Hero pusht{' '}
          <span className="tabnum text-text font-semibold">{nashPoint.pushPct.toFixed(0)} %</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
          <defs>
            <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={CHART_GREEN} stopOpacity={0.28} />
              <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0.03} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />

          <XAxis
            dataKey="callPct"
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={v => `${v}%`}
            label={{ value: 'BB Call Range', position: 'insideBottom', offset: -12, ...axisTick }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={v => `${v}%`}
            width={36}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Nash-Gleichgewicht: Referenzlinien */}
          <ReferenceLine
            x={nashPoint.callPct}
            stroke="#f59e0b"
            strokeDasharray="5 4"
          />
          <ReferenceLine
            y={nashPoint.pushPct}
            stroke="#f59e0b"
            strokeDasharray="5 4"
          />

          <Area
            type="monotone"
            dataKey="pushPct"
            stroke={CHART_GREEN}
            strokeWidth={2}
            fill="url(#rangeGrad)"
            dot={false}
            activeDot={{ r: 3, fill: CHART_GREEN }}
          />

          {/* Nash-Gleichgewichtspunkt */}
          <ReferenceDot
            x={nashPoint.callPct}
            y={nashPoint.pushPct}
            r={5}
            fill="#f59e0b"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted mt-1">
        Kurve: Hero's optimaler Push-Bereich für jede Villain-Call-Breite.
        Gelber Punkt = Nash-Gleichgewicht (beide Spieler best-respond aufeinander).
        Je enger Villain callt, desto weiter kann Hero pushen.
      </p>
    </div>
  )
}
