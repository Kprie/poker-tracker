import type { ActionType, HandEntry, HandId } from '../data/pushFoldData'
import { ALL_HAND_IDS, RANKS, getHandId } from '../data/pushFoldData'

interface Props {
  data: Record<HandId, HandEntry | null>
  action?: ActionType
}

function cellBg(entry: HandEntry | null | undefined): string {
  if (entry == null) return 'bg-slate-900 opacity-40'
  if (entry.ev === null) return 'bg-slate-900 opacity-40'
  if (entry.ev > 1.0) return 'bg-green-700'
  if (entry.ev >= 0)  return 'bg-green-900'
  if (entry.ev >= -1.0) return 'bg-yellow-900'
  return 'bg-slate-800'
}

function tooltip(id: HandId, entry: HandEntry | null | undefined): string {
  if (entry == null || entry.ev === null) return `${id} — keine Daten`
  const evStr = entry.ev >= 0 ? `+${entry.ev.toFixed(2)} BB` : `${entry.ev.toFixed(2)} BB`
  if (entry.freq !== null) return `${id}: ${evStr} — ${entry.freq} % pushen (Mixed Strategy)`
  if (entry.ev > 0) return `${id}: ${evStr} — immer pushen`
  return `${id}: ${evStr} — fold`
}

export function HandGrid({ data }: Props): JSX.Element {
  // Sicherstellen, dass ALL_HAND_IDS alle 169 enthält
  void ALL_HAND_IDS

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse" style={{ fontSize: 10 }}>
        <thead>
          <tr>
            <th className="w-6 h-6" />
            {RANKS.map(r => (
              <th key={r} className="w-9 h-6 text-center text-muted font-medium" style={{ fontSize: 10 }}>
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RANKS.map((rowRank, i) => (
            <tr key={rowRank}>
              <td className="w-6 text-center text-muted font-medium pr-1" style={{ fontSize: 10 }}>
                {rowRank}
              </td>
              {RANKS.map((_, j) => {
                const id = getHandId(i, j)
                const entry = data[id]
                const bg = cellBg(entry)
                const tip = tooltip(id, entry)
                const isNull = entry == null || entry.ev === null
                return (
                  <td
                    key={j}
                    title={tip}
                    className={`w-9 h-8 text-center cursor-default select-none rounded-[2px] ${bg} ${isNull ? '' : 'hover:ring-1 hover:ring-white/30'}`}
                    style={{ padding: '1px' }}
                  >
                    {!isNull && (
                      <div className="flex flex-col items-center justify-center h-full leading-none gap-px">
                        <span className="text-white/90 font-medium" style={{ fontSize: 9 }}>{id}</span>
                        {entry.freq !== null && (
                          <span className="text-white/50" style={{ fontSize: 7 }}>{entry.freq}%</span>
                        )}
                      </div>
                    )}
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

// ─── Legende ──────────────────────────────────────────────────────────────────

export function HandGridLegend(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted mt-3">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-green-700" /> Klar profitabel (&gt;&nbsp;+1&nbsp;BB)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-green-900" /> Marginal (0–1&nbsp;BB)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-yellow-900" /> Leicht negativ (−1–0&nbsp;BB)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-slate-800" /> Klar negativ (&lt;&nbsp;−1&nbsp;BB)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-slate-900 opacity-40" /> Keine Daten
      </span>
      <span className="text-muted/70">· Zahl in Zelle = Mixed Strategy (N&nbsp;% spielen)</span>
    </div>
  )
}
