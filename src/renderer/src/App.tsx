import { useEffect, useMemo, useState } from 'react'
import { Toolbar } from './components/Toolbar'
import { Disclaimer } from './components/Disclaimer'
import { KpiTile } from './components/KpiTile'
import { Reveal } from './components/Reveal'
import { PlayStyle } from './components/PlayStyle'
import { BankrollChart } from './components/BankrollChart'
import { Breakdown } from './components/Breakdown'
import { RollingRoiChart } from './components/RollingRoiChart'
import { ItmDepth } from './components/ItmDepth'
import { TournamentTable } from './components/TournamentTable'
import { Upload } from './components/icons'
import { IcmTab } from './components/IcmTab'
import { useStore } from './store'
import { money, pct } from './lib/format'
import {
  applyFilters,
  bankrollSeries,
  byBuyIn,
  byHour,
  bySpeed,
  byWeekday,
  computeItmDepth,
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
        <span className="eyebrow justify-center">Erste Schritte</span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tightest">Noch keine Daten</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          Lies deine PokerStars-Dateien ein oder lade einen GGPoker PokerCraft-Export
          (.zip oder .txt) hoch, um deine Statistiken zu sehen.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2.5">
          <button className="btn-ghost" onClick={scanPokerStars}>
            PokerStars einlesen
          </button>
          <button className="btn-primary" onClick={importGGPoker}>
            <Upload width={15} height={15} />
            PokerCraft hochladen
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
        className={`card px-4 py-3 text-sm backdrop-blur-xl ${
          toast.kind === 'ok' ? 'text-profit' : 'text-loss'
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'icm'>('dashboard')

  useEffect(() => {
    init()
  }, [init])

  const filtered = useMemo(() => applyFilters(tournaments, filters), [tournaments, filters])
  const resultRows = useMemo(() => withResults(filtered), [filtered])
  const kpis = useMemo(() => computeKpis(filtered), [filtered])
  const playStyle = useMemo(() => computePlayStyle(filtered), [filtered])
  const bankroll = useMemo(() => bankrollSeries(resultRows), [resultRows])
  const itmDepth = useMemo(() => computeItmDepth(resultRows), [resultRows])
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

  const tabClass = (tab: 'dashboard' | 'icm'): string =>
    activeTab === tab
      ? 'border-b-2 border-accent pb-2.5 pt-3 px-4 text-sm font-semibold text-text'
      : 'border-b-2 border-transparent pb-2.5 pt-3 px-4 text-sm font-medium text-muted hover:text-text transition-colors'

  return (
    <div className="min-h-[100dvh]">
      <Disclaimer />
      <Toolbar />
      <div className="mx-auto w-full max-w-[1400px] px-6">
        <div className="flex gap-1 border-b border-white/10">
          <button className={tabClass('dashboard')} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={tabClass('icm')} onClick={() => setActiveTab('icm')}>
            ICM-Analyse
          </button>
        </div>
      </div>
      {activeTab === 'icm' ? (
        <main className="mx-auto w-full max-w-[1400px] px-6 pb-20 pt-6">
          <IcmTab />
        </main>
      ) : (
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 pb-20 pt-3">
        {loading ? (
          <div className="py-28 text-center text-muted">Lädt…</div>
        ) : tournaments.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Net profit + bankroll */}
            <Reveal>
              <div className="card p-5 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span className="eyebrow">Netto-Profit</span>
                    <div
                      className={`tabnum mt-2.5 text-[2.6rem] font-semibold leading-none tracking-tightest ${
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
                      <span className="tabnum text-text">{kpis.resultCount}</span> von{' '}
                      <span className="tabnum text-text">{filtered.length}</span> Turnieren gewertet
                    </div>
                  </div>
                  <span className="eyebrow pb-1">Bankroll-Verlauf</span>
                </div>
                <div className="mt-5">
                  <BankrollChart data={bankroll} height={248} />
                </div>
              </div>
            </Reveal>

            {/* KPI cards */}
            <Reveal delay={40}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <KpiTile label="ROI" value={pct(kpis.roi)} tone={roiTone} />
                <KpiTile label="ITM-Quote" value={pct(kpis.itmRate)} sub={`${kpis.itmCount} im Geld`} />
                <KpiTile label="Buy-ins" value={money(kpis.totalCost)} />
                <KpiTile label="Auszahlungen" value={money(kpis.totalPayout)} />
                <KpiTile label="Größter Cash" value={money(kpis.biggestWin)} />
                <KpiTile label="Ø Buy-in" value={money(kpis.avgBuyIn)} />
              </div>
            </Reveal>

            {playStyle.hands > 0 && (
              <Reveal delay={60}>
                <PlayStyle s={playStyle} />
              </Reveal>
            )}

            <Reveal delay={80}>
              <Breakdown
                byBuyIn={breakdowns.buyIn}
                bySpeed={breakdowns.speed}
                byWeekday={breakdowns.weekday}
                byHour={breakdowns.hour}
              />
            </Reveal>

            <Reveal delay={100}>
              <RollingRoiChart rows={resultRows} />
            </Reveal>

            <Reveal delay={120}>
              <ItmDepth data={itmDepth} totalResults={resultRows.length} />
            </Reveal>

            <Reveal delay={140}>
              <TournamentTable rows={filtered} />
            </Reveal>
          </>
        )}
      </main>
      )}
      <Toast />
    </div>
  )
}
