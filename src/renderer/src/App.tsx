import { useEffect, useMemo } from 'react'
import { Toolbar } from './components/Toolbar'
import { StatCards } from './components/StatCards'
import { PlayStyle } from './components/PlayStyle'
import { BankrollChart } from './components/BankrollChart'
import { Breakdown } from './components/Breakdown'
import { TournamentTable } from './components/TournamentTable'
import { useStore } from './store'
import {
  applyFilters,
  bankrollSeries,
  byBuyIn,
  byHour,
  bySpeed,
  byWeekday,
  computeKpis,
  computePlayStyle,
  withResults
} from './lib/analytics'

function EmptyState(): JSX.Element {
  const scanPokerStars = useStore((s) => s.scanPokerStars)
  const importGGPoker = useStore((s) => s.importGGPoker)
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="max-w-md">
        <div className="text-5xl mb-4">♠ ♥ ♦ ♣</div>
        <h2 className="text-lg font-semibold">Noch keine Daten</h2>
        <p className="text-sm text-muted mt-2">
          Lies deine PokerStars-Tournament-Summaries ein oder lade einen GGPoker
          PokerCraft-Export (.zip oder .txt) hoch, um Statistiken zu sehen.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6">
          <button className="btn-ghost" onClick={scanPokerStars}>
            PokerStars einlesen
          </button>
          <button className="btn-primary" onClick={importGGPoker}>
            PokerCraft hochladen
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast(): JSX.Element | null {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return (
    <div
      className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-sm shadow-lg ${
        toast.kind === 'ok'
          ? 'bg-surface border-profit/40 text-profit'
          : 'bg-surface border-loss/40 text-loss'
      }`}
    >
      {toast.msg}
    </div>
  )
}

export default function App(): JSX.Element {
  const { loading, tournaments, filters } = useStore()
  const init = useStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  const filtered = useMemo(() => applyFilters(tournaments, filters), [tournaments, filters])
  const resultRows = useMemo(() => withResults(filtered), [filtered])
  const kpis = useMemo(() => computeKpis(filtered), [filtered])
  const playStyle = useMemo(() => computePlayStyle(filtered), [filtered])
  const bankroll = useMemo(() => bankrollSeries(resultRows), [resultRows])
  const breakdowns = useMemo(
    () => ({
      buyIn: byBuyIn(resultRows),
      speed: bySpeed(resultRows),
      weekday: byWeekday(resultRows),
      hour: byHour(resultRows)
    }),
    [resultRows]
  )

  return (
    <div className="min-h-full">
      <Toolbar />
      <main className="px-6 py-5 flex flex-col gap-5">
        {loading ? (
          <div className="py-24 text-center text-muted">Lädt…</div>
        ) : tournaments.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <StatCards k={kpis} />
            <PlayStyle s={playStyle} />
            <BankrollChart data={bankroll} />
            <Breakdown
              byBuyIn={breakdowns.buyIn}
              bySpeed={breakdowns.speed}
              byWeekday={breakdowns.weekday}
              byHour={breakdowns.hour}
            />
            <TournamentTable rows={filtered} />
          </>
        )}
      </main>
      <Toast />
    </div>
  )
}
