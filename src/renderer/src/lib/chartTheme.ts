// Shared Recharts styling so the bankroll and breakdown charts stay in sync.
import type { CSSProperties } from 'react'

export const CHART_MONO = "'Geist Mono Variable', ui-monospace, monospace"

export const CHART_GREEN = '#3ddc97'
export const CHART_RED = '#f0686d'

/** Axis tick styling (mono, muted). */
export const axisTick = { fontSize: 11, fill: '#9a9aa1', fontFamily: CHART_MONO } as const

export const chartGrid = 'rgba(255,255,255,0.06)'

/** Tooltip container look. */
export const tooltipContentStyle: CSSProperties = {
  background: 'rgba(20,20,21,0.96)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 16px 40px -16px rgba(0,0,0,0.8)'
}

/** Muted label above the tooltip value. */
export const tooltipLabelStyle: CSSProperties = { color: '#9a9aa1', marginBottom: 2 }

/** Light, readable value text inside the tooltip. */
export const tooltipItemStyle: CSSProperties = { color: '#ededee', fontWeight: 600 }
