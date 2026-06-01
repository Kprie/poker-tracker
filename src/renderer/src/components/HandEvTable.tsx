import type { HandEvTableEntry } from '../lib/chartData'
import type { HandId } from '../data/pushFoldData'

// ─── Farb-Encoding ────────────────────────────────────────────────────────────

/**
 * Kontinuierlicher Gradient: grün (positiver EV) → grau (EV≈0) → rot (negativer EV).
 * Intensität skaliert relativ zum größten absoluten EV im Datensatz.
 */
function evToStyle(ev: number, maxAbsEv: number): React.CSSProperties {
  if (maxAbsEv === 0) return { backgroundColor: 'rgba(100,100,110,0.3)' }
  const t = Math.max(-1, Math.min(1, ev / Math.max(maxAbsEv, 0.001)))
  if (t > 0) {
    const a = 0.15 + t * 0.75
    return { backgroundColor: `rgba(61,220,151,${a.toFixed(2)})` }   // CHART_GREEN
  }
  if (t < 0) {
    const a = 0.15 + (-t) * 0.75
    return { backgroundColor: `rgba(240,104,109,${a.toFixed(2)})` }  // CHART_RED
  }
  return { backgroundColor: 'rgba(100,100,110,0.3)' }
}

function evLabel(ev: number): string {
  if (Math.abs(ev) < 0.0005) return '≈0'
  return (ev > 0 ? '+' : '') + ev.toFixed(3)
}

// ─── Konstanten ───────────────────────────────────────────────────────────────

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

function getHandId(row: number, col: number): HandId {
  if (row === col) return RANKS[row] + RANKS[row]
  if (row < col)  return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

// ─── Legende ──────────────────────────────────────────────────────────────────

export function HandEvTableLegend(): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <div className="flex h-2.5 w-20 rounded-full overflow-hidden">
        <div className="flex-1" style={{ background: 'rgba(240,104,109,0.85)' }} />
        <div className="w-px bg-white/10" />
        <div className="flex-1" style={{ background: 'rgba(100,100,110,0.3)' }} />
        <div className="w-px bg-white/10" />
        <div className="flex-1" style={{ background: 'rgba(61,220,151,0.85)' }} />
      </div>
      <span>Rot = Fold · Grau = Grenzfall · Grün = Push</span>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  data: HandEvTableEntry[]
  selected?: HandId | null
  onSelect?: (id: HandId) => void
}

import React from 'react'

export function HandEvTable({ data, selected, onSelect }: Props): JSX.Element {
  // EV-Lookup-Map für O(1)-Zugriff
  const evMap = new Map(data.map(e => [e.handId, e.ev]))

  // Max abs EV für Farbskalierung
  const maxAbsEv = data.reduce((m, e) => Math.max(m, Math.abs(e.ev)), 0)

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse select-none" style={{ fontSize: 9 }}>
        <thead>
          <tr>
            <th className="w-5 h-5" />
            {RANKS.map(r => (
              <th key={r} className="w-11 h-5 text-center text-muted font-mono font-normal" style={{ fontSize: 9 }}>
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RANKS.map((_, i) => (
            <tr key={i}>
              <td className="w-5 text-center text-muted font-mono" style={{ fontSize: 9 }}>
                {RANKS[i]}
              </td>
              {RANKS.map((_, j) => {
                const id  = getHandId(i, j)
                const ev  = evMap.get(id) ?? 0
                const sel = id === selected

                return (
                  <td
                    key={j}
                    onClick={() => onSelect?.(id)}
                    title={`${id}: EV ${evLabel(ev)}`}
                    style={sel ? undefined : evToStyle(ev, maxAbsEv)}
                    className={[
                      'w-11 h-9 text-center rounded-[2px] transition-colors',
                      onSelect ? 'cursor-pointer' : '',
                      sel ? 'ring-2 ring-white bg-accent' : '',
                    ].join(' ')}
                  >
                    <div className="flex flex-col items-center justify-center h-full leading-none gap-px">
                      <span className="text-white/90 font-mono font-medium" style={{ fontSize: 8 }}>{id}</span>
                      <span className="text-white/60 tabnum" style={{ fontSize: 7 }}>{evLabel(ev)}</span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
