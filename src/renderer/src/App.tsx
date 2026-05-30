import { useEffect, useMemo } from 'react'
import { Toolbar } from './components/Toolbar'
import { Disclaimer } from './components/Disclaimer'
import { Panel } from './components/Panel'
import { KpiTile } from './components/KpiTile'
import { Reveal } from './components/Reveal'
import { PlayStyle } from './components/PlayStyle'
import { BankrollChart } from './components/BankrollChart'
import { Breakdown } from './components/Breakdown'
import { TournamentTable } from './components/TournamentTable'
import { Upload } from './components/icons'
import { useStore } from './store'
import { money, pct } from './lib/format'
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
    <div className="grid place-items-center py-28 text-center">
      <Reveal className="max-w-md">
        <span className="eyebrow mx-auto">Erste Schritte</span>
        <h2 className="mt-5 text-3xl font-semibold tracking-tightest">Noch keine Daten</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          Lies deine PokerStars-Dateien ein oder lade einen GGPoker PokerCraft-Export
          (.zip oder .txt) hoch, um deine Statistiken zu sehen.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2.5">
          <button className="btn-ghost group" onClick={scanPokerStars}>
            PokerStars einlesen
          </button>
          <button className="btn-primary group" onClick={importGGPoker}>
            PokerCraft hochladen
            <span className="btn-icon">
              <Upload width={15} height={15} />
            </span>
          </button>
        </div>
      </Reveal>
    </div>
  )
}

function Toast(): JSX.Element | null {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return (
    <div className="fixed bottom-6 right-6 z-modal">
      <div
        className={`rounded-2xl bg-white/[0.06] px-4 py-3 text-sm ring-1 backdrop-blur-xl shadow-ambient ${
          toast.kind === 'ok' ? 'text-profit ring-profit/30' : 'text-loss ring-loss/30'
        }`}
      >
        {toast.msg}
      </div>
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

  const profitTone = kpis.profit > 0 ? 'profit' : kpis.profit < 0 ? 'loss' : 'neutral'
  const roiTone = kpis.roi > 0 ? 'profit' : kpis.roi < 0 ? 'loss' : 'neutral'

  return (
    <div className="min-h-[100dvh]">
      <Disclaimer />
      <Toolbar />
      <main className="relative z-[2] mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-6 pb-20 pt-3">
        {loading ? (
          <div className="py-28 text-center text-muted">Lädt…</div>
        ) : tournaments.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Overview — asymmetric bento */}
            <Reveal>
              <section className="grid gap-5 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <Panel bodyClassName="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <span className="eyebrow">Netto-Profit</span>
                        <div
                          className={`tabnum mt-3 text-5xl font-semibold tracking-tightest ${
                            profitTone === 'profit'
                              ? 'text-profit'
                              : profitTone === 'loss'
                                ? 'text-loss'
                                : 'text-text'
                          }`}
                        >
                          {money(kpis.profit)}
                        </div>
                        <div className="mt-2.5 text-sm text-muted">
                          ROI <span className="tabnum text-text">{pct(kpis.roi)}</span> ·{' '}
                          <span className="tabnum text-text">{kpis.resultCount}</span> Turniere mit
                          Ergebnis
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="eyebrow">Bankroll</span>
                        <div className="mt-3 text-xs text-muted">
                          {filtered.length} Turniere · {resultRows.length} gewertet
                        </div>
                      </div>
                    </div>
                    <div className="mt-5">
                      <BankrollChart data={bankroll} height={252} />
                    </div>
                  </Panel>
                </div>

                <div className="lg:col-span-4">
                  <Panel title="Kennzahlen" className="h-full" bodyClassName="p-3 h-full">
                    <div className="grid h-full grid-cols-2 grid-rows-3 gap-2.5">
                      <KpiTile label="ROI" value={pct(kpis.roi)} tone={roiTone} />
                      <KpiTile label="ITM-Quote" value={pct(kpis.itmRate)} sub={`${kpis.itmCount} im Geld`} />
                      <KpiTile label="Buy-ins" value={money(kpis.totalCost)} />
                      <KpiTile label="Auszahlungen" value={money(kpis.totalPayout)} />
                      <KpiTile label="Größter Cash" value={money(kpis.biggestWin)} />
                      <KpiTile label="Ø Buy-in" value={money(kpis.avgBuyIn)} />
                    </div>
                  </Panel>
                </div>
              </section>
            </Reveal>

            {playStyle.hands > 0 && (
              <Reveal delay={60}>
                <PlayStyle s={playStyle} />
              </Reveal>
            )}

            <Reveal delay={90}>
              <Breakdown
                byBuyIn={breakdowns.buyIn}
                bySpeed={breakdowns.speed}
                byWeekday={breakdowns.weekday}
                byHour={breakdowns.hour}
              />
            </Reveal>

            <Reveal delay={120}>
              <TournamentTable rows={filtered} />
            </Reveal>
          </>
        )}
      </main>
      <Toast />
    </div>
  )
}
