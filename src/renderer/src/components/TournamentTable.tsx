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

  const Th = ({
    k,
    label,
    className
  }: {
    k: SortKey
    label: string
    className?: string
  }): JSX.Element => (
    <th
      className={`cursor-pointer select-none px-4 py-2.5 text-[10px] font-medium uppercase tracking-eyebrow transition-colors duration-200 ease-fluid hover:text-text ${
        sortKey === k ? 'text-text' : ''
      } ${className ?? ''}`}
      onClick={() => toggle(k)}
    >
      {label}
      {sortKey === k && <span className="text-accent">{asc ? ' ↑' : ' ↓'}</span>}
    </th>
  )

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-text">
          <span className="h-3.5 w-1 rounded-full bg-accent" />
          Turniere
        </h2>
        <span className="text-xs text-muted">
          <span className="tabnum text-text">{rows.length}</span> Einträge
        </span>
      </div>
      <div className="card overflow-hidden">
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-surface/95 text-left text-muted backdrop-blur">
              <tr className="border-b border-white/[0.07]">
                <Th k="startDate" label="Datum" />
                <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-eyebrow">Turnier</th>
                <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-eyebrow">Quelle</th>
                <Th k="buyIn" label="Buy-in" className="text-right" />
                <Th k="fieldSize" label="Entries" className="text-right" />
                <Th k="finishPlace" label="Finish" className="text-right" />
                <th className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-eyebrow">
                  Payout
                </th>
                <Th k="profit" label="Profit" className="text-right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-white/[0.04] transition-colors duration-150 ease-fluid hover:bg-white/[0.03]"
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{dateLabel(t.startDate)}</td>
                  <td className="max-w-[280px] truncate px-4 py-2.5" title={t.name}>
                    {t.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] ${
                        t.source === 'pokerstars' ? 'bg-ps/10 text-ps' : 'bg-gg/10 text-gg'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          t.source === 'pokerstars' ? 'bg-ps' : 'bg-gg'
                        }`}
                      />
                      {t.source === 'pokerstars' ? 'Stars' : 'GG'}
                    </span>
                  </td>
                  <td className="tabnum px-4 py-2.5 text-right">{money(t.buyIn + t.fee)}</td>
                  <td className="tabnum px-4 py-2.5 text-right text-muted">{t.fieldSize ?? '—'}</td>
                  <td className="tabnum px-4 py-2.5 text-right text-muted">{t.finishPlace ?? '—'}</td>
                  <td className="tabnum px-4 py-2.5 text-right">
                    {t.resultKnown ? money(t.payout) : <span className="text-muted">—</span>}
                  </td>
                  <td
                    className={`tabnum px-4 py-2.5 text-right font-medium ${
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
    </section>
  )
}
