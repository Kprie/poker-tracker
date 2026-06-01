import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  CHART_GREEN, CHART_RED, axisTick, chartGrid,
  tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle,
} from '../lib/chartTheme'
import type { HandEvPoint } from '../lib/chartData'
import type { HandId } from '../data/pushFoldData'

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
}): JSX.Element | null {
  if (!active || !payload?.length) return null
  const ev = payload[0].value
  return (
    <div style={tooltipContentStyle} className="px-3 py-2">
      <p style={tooltipLabelStyle}>Call-Range {label} %</p>
      <p style={tooltipItemStyle} className={ev >= 0 ? 'text-profit' : 'text-loss'}>
        EV {ev >= 0 ? '+' : ''}{ev.toFixed(4)}
      </p>
    </div>
  )
}

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  data: HandEvPoint[]
  handId: HandId
  /** Nash Call Range Breite in % (für Referenzlinie). */
  nashCallPct: number
}

export function HandEvChart({ data, handId, nashCallPct }: Props): JSX.Element {
  const breakeven = data.find((p, i) => {
    const next = data[i + 1]
    return next && ((p.ev >= 0 && next.ev < 0) || (p.ev < 0 && next.ev >= 0))
  })

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-3 text-xs text-muted">
        <span>
          <span className="font-semibold text-text">{handId}</span>
          {' '}— Push-EV in Abhängigkeit der Villain Call-Range-Breite
        </span>
        {breakeven && (
          <span>
            Break-Even bei ca. <span className="tabnum text-text">{breakeven.width} %</span> Call-Range
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />

          <XAxis
            dataKey="width"
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={v => `${v}%`}
            label={{ value: 'Villain Call Range', position: 'insideBottom', offset: -12, ...axisTick }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={v => v.toFixed(3)}
            width={52}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Break-Even-Linie */}
          <ReferenceLine
            y={0}
            stroke="rgba(255,255,255,0.25)"
            strokeDasharray="5 4"
            label={{ value: 'Break Even', position: 'right', fill: 'rgba(255,255,255,0.4)', fontSize: 9 }}
          />

          {/* Nash-Gleichgewicht: aktuelle Villain Call-Range */}
          <ReferenceLine
            x={nashCallPct}
            stroke="#f59e0b"
            strokeDasharray="5 4"
            label={{ value: `Nash ${nashCallPct.toFixed(0)}%`, position: 'top', fill: '#f59e0b', fontSize: 9 }}
          />

          <Line
            type="monotone"
            dataKey="ev"
            stroke={CHART_GREEN}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: CHART_GREEN }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted mt-1">
        Links (0 %): Alle folden → EV = Pot-Gewinn. Rechts (100 %): Immer gecallt → EV = equity × Gewinn + (1−equity) × Verlust.
        Gelbe Linie = Nash-Gleichgewicht dieser Situation.
      </p>
    </div>
  )
}
