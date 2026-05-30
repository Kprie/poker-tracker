import { useState } from 'react'
import type { Tournament } from '../../../shared/types'
import { dateLabel, money } from '../lib/format'

interface Props {
  rows: Tournament[]
}

type SortKey = 'startDate' | 'buyIn' | 'profit' | 'finishPlace' | 'fieldSize'

export function TournamentTable({ rows }: Props): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('startDate')
  const [asc, setAsc] = useState(false)

  const sorted = [...rows].sort((a, b) => {
    const dir = asc ? 1 : -1
    if (sortKey === 'startDate') return a.startDate.localeCompare(b.startDate) * dir
    const av = (a[sortKey] as number | null) ?? -Infinity
    const bv = (b[sortKey] as number | null) ?? -Infinity
    return (av - bv) * dir
  })

  const toggle = (key: SortKey): void => {
    if (key === sortKey) setAsc(!asc)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  const Th = ({ k, label, className }: { k: SortKey; label: string; className?: string }): JSX.Element => (
    <th
      className={`px-3 py-2 font-medium cursor-pointer hover:text-text select-none ${className ?? ''}`}
      onClick={() => toggle(k)}
    >
      {label}
      {sortKey === k && <span className="text-accent">{asc ? ' ▲' : ' ▼'}</span>}
    </th>
  )

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          <span className="h-3.5 w-1 rounded-full bg-accent" />
          Turniere
        </h2>
        <span className="text-xs text-muted">
          <span className="tabnum text-text">{rows.length}</span> Einträge
        </span>
      </div>
      <div className="overflow-auto max-h-[480px]">
        <table className="w-full text-sm">
          <thead className="text-left text-muted bg-surface2 sticky top-0">
            <tr>
              <Th k="startDate" label="Datum" />
              <th className="px-3 py-2 font-medium">Turnier</th>
              <th className="px-3 py-2 font-medium">Quelle</th>
              <Th k="buyIn" label="Buy-in" className="text-right" />
              <Th k="fieldSize" label="Entries" className="text-right" />
              <Th k="finishPlace" label="Finish" className="text-right" />
              <th className="px-3 py-2 font-medium text-right">Payout</th>
              <Th k="profit" label="Profit" className="text-right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} className="border-t border-border/60 hover:bg-surface2/50">
                <td className="px-3 py-2 text-muted whitespace-nowrap">{dateLabel(t.startDate)}</td>
                <td className="px-3 py-2 max-w-[280px] truncate" title={t.name}>
                  {t.name}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs ${
                      t.source === 'pokerstars' ? 'text-ps' : 'text-gg'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        t.source === 'pokerstars' ? 'bg-ps' : 'bg-gg'
                      }`}
                    />
                    {t.source === 'pokerstars' ? 'Stars' : 'GG'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabnum">{money(t.buyIn + t.fee)}</td>
                <td className="px-3 py-2 text-right tabnum text-muted">
                  {t.fieldSize ?? '—'}
                </td>
                <td className="px-3 py-2 text-right tabnum text-muted">
                  {t.finishPlace ?? '—'}
                </td>
                <td className="px-3 py-2 text-right tabnum">
                  {t.resultKnown ? money(t.payout) : <span className="text-muted">—</span>}
                </td>
                <td
                  className={`px-3 py-2 text-right tabnum font-medium ${
                    !t.resultKnown
                      ? 'text-muted'
                      : t.profit > 0
                        ? 'text-profit'
                        : t.profit < 0
                          ? 'text-loss'
                          : 'text-muted'
                  }`}
                >
                  {t.resultKnown ? (
                    money(t.profit)
                  ) : (
                    <span title="Nur Hand-History – Ergebnis unbekannt">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
