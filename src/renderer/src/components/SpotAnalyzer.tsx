import { useCallback, useState } from 'react'
import { computeIcmEquities } from '../lib/icm'
import { handIdToCombos } from '../lib/cards'
import { buildCallingRange, computeEquityMC, computeIcmScenarios } from '../lib/equity'
import type { EquityResult, IcmScenarios } from '../lib/equity'
import { solveNash, computeIcmDeltas } from '../lib/nashSolver'
import type { NashResult } from '../lib/nashSolver'
import {
  cachedPairCount,
  precomputeAllEquities,
  TOTAL_PAIR_COUNT,
} from '../lib/equityTable'
import {
  getHandEvTableData, getHandEvChartData, getRangeCorrelationData,
} from '../lib/chartData'
import type { HandEvTableEntry, HandEvPoint, RangeCorrelationPoint } from '../lib/chartData'
import { availablePositions, ALL_HAND_IDS } from '../data/pushFoldData'
import type { ActionType, HandId, Position } from '../data/pushFoldData'
import { HandEvTable, HandEvTableLegend } from './HandEvTable'
import { HandEvChart } from './HandEvChart'
import { RangeCorrelationChart } from './RangeCorrelationChart'

// ─── Typen ────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  handId: HandId
  nashResult: NashResult
  equity: EquityResult | null
  icm: IcmScenarios | null
  payouts: number[]
  stacks: number[]
}

type PlayerCount = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
type ResultTab = 'analyse' | 'evtable' | 'evchart' | 'range'

// ─── Hand-Grid (kompakt, für Hand-Auswahl) ────────────────────────────────────

const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const

function getHandId(row: number, col: number): HandId {
  if (row === col) return RANKS[row] + RANKS[row]
  if (row < col)  return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

interface GridProps {
  selected: HandId | null
  onSelect: (id: HandId) => void
  nashResult: NashResult | null
}

function MiniHandGrid({ selected, onSelect, nashResult }: GridProps): JSX.Element {
  function bg(id: HandId): string {
    if (id === selected) return 'ring-2 ring-white bg-accent'
    if (!nashResult) return 'bg-slate-800 hover:bg-slate-700'
    const entry = nashResult.pushRange.get(id)
    if (!entry) return 'bg-slate-800 hover:bg-slate-700'
    if (entry.ev > 1.0)  return 'bg-green-700 hover:bg-green-600'
    if (entry.ev > 0)    return 'bg-green-900 hover:bg-green-800'
    if (entry.ev > -1.0) return 'bg-yellow-900 hover:bg-yellow-800'
    return 'bg-slate-800 hover:bg-slate-700'
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse select-none" style={{ fontSize: 8 }}>
        <thead>
          <tr>
            <th className="w-5 h-5" />
            {RANKS.map(r => <th key={r} className="w-8 h-5 text-center text-muted font-medium" style={{ fontSize: 8 }}>{r}</th>)}
          </tr>
        </thead>
        <tbody>
          {RANKS.map((_, i) => (
            <tr key={i}>
              <td className="w-5 text-center text-muted font-medium" style={{ fontSize: 8 }}>{RANKS[i]}</td>
              {RANKS.map((_, j) => {
                const id = getHandId(i, j)
                return (
                  <td
                    key={j}
                    onClick={() => onSelect(id)}
                    title={id}
                    className={`w-8 h-7 text-center cursor-pointer rounded-[2px] transition-colors ${bg(id)}`}
                    style={{ padding: '1px' }}
                  >
                    <span className="text-white/80 leading-none" style={{ fontSize: 7 }}>{id}</span>
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

// ─── Precompute-Banner ────────────────────────────────────────────────────────

interface PrecomputeBannerProps { onStart: () => void; pct: number; running: boolean }

function PrecomputeBanner({ onStart, pct, running }: PrecomputeBannerProps): JSX.Element {
  return (
    <div className="rounded-lg border border-white/10 px-4 py-3 flex items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-text">Equity-Tabelle vorberechnen</p>
        <p className="text-xs text-muted mt-0.5">
          Einmalige Vorberechnung aller Hand-vs-Hand-Equities (~{Math.ceil((TOTAL_PAIR_COUNT - Math.round(pct * TOTAL_PAIR_COUNT)) * 8 / 1000)} s). Danach instantane Nash-Ranges und Charts.
        </p>
        {running && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden w-full">
              <div className="h-full bg-accent transition-all rounded-full" style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
            <p className="text-xs text-muted mt-1 tabnum">{Math.round(pct * 100)} %</p>
          </div>
        )}
      </div>
      {!running && (
        <button className="btn-ghost text-xs shrink-0" onClick={onStart}>
          Jetzt vorberechnen
        </button>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

const selectCls = 'bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent'
const inputCls  = 'bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text tabnum focus:outline-none focus:ring-1 focus:ring-accent w-full'

const RESULT_TABS: { key: ResultTab; label: string }[] = [
  { key: 'analyse',  label: 'Analyse' },
  { key: 'evtable',  label: 'EV-Tabelle' },
  { key: 'evchart',  label: 'Hand EV Chart' },
  { key: 'range',    label: 'Range-Korrelation' },
]

export function SpotAnalyzer(): JSX.Element {
  // Situation
  const [players,      setPlayers]      = useState<PlayerCount>(2)
  const [position,     setPosition]     = useState<Position>('SB')
  const [stackBb,      setStackBb]      = useState(10)
  const [stackInput,   setStackInput]   = useState('10')
  const [bbSize,       setBbSize]       = useState(200)
  const [ante,         setAnte]         = useState(0)
  const [paidPlaces,   setPaidPlaces]   = useState(2)
  const [stacks,       setStacks]       = useState<number[]>([2000, 2000])
  const [payoutInputs, setPayoutInputs] = useState<string[]>(['65', '35'])

  // Hand
  const [heroHand, setHeroHand] = useState<HandId | null>(null)

  // Analyse
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<AnalysisResult | null>(null)
  const [nashReady, setNashReady] = useState<NashResult | null>(null)
  const [resultTab, setResultTab] = useState<ResultTab>('analyse')

  // Chart-Daten (werden nach handleAnalyze asynchron befüllt)
  const [evTableData,  setEvTableData]  = useState<HandEvTableEntry[] | null>(null)
  const [evChartData,  setEvChartData]  = useState<HandEvPoint[] | null>(null)
  const [rangeData,    setRangeData]    = useState<RangeCorrelationPoint[] | null>(null)
  const [nashPoint,    setNashPoint]    = useState<{ callPct: number; pushPct: number } | null>(null)
  const [chartsLoading, setChartsLoading] = useState(false)

  // Precompute
  const [precompPct,     setPrecompPct]     = useState(cachedPairCount() / TOTAL_PAIR_COUNT)
  const [precompRunning, setPrecompRunning] = useState(false)

  const positions = availablePositions(players)

  function handlePlayersChange(n: PlayerCount): void {
    setPlayers(n)
    setStacks(Array.from({ length: n }, () => Math.round(stackBb * bbSize)))
    const pos = availablePositions(n)
    if (!pos.includes(position)) setPosition(pos[0])
  }

  function handleStackBbChange(val: number): void {
    setStackBb(val)
    setStackInput(String(val))
    const updated = [...stacks]
    updated[0] = Math.round(val * bbSize)
    setStacks(updated)
  }

  async function handlePrecompute(): Promise<void> {
    setPrecompRunning(true)
    await precomputeAllEquities(p => setPrecompPct(p.pct), 30)
    setPrecompPct(1)
    setPrecompRunning(false)
  }

  const [nashLoading, setNashLoading] = useState(false)

  const handleLoadNash = useCallback(() => {
    setNashLoading(true)
    setNashReady(null)
    // Chart-Daten invalidieren wenn neue Situation geladen wird
    setEvTableData(null); setEvChartData(null); setRangeData(null); setNashPoint(null)
    const heroStackChips = Math.round(stackBb * bbSize)
    const fullStacks = [heroStackChips, ...stacks.slice(1, players)]
    const payouts = payoutInputs.slice(0, paidPlaces).map(p => parseFloat(p) || 0)
    setTimeout(() => {
      const r = solveNash({ stacks: fullStacks, payouts, bbSize, ante })
      setNashReady(r)
      setNashLoading(false)
    }, 0)
  }, [stackBb, bbSize, stacks, players, payoutInputs, paidPlaces, ante])

  function handleAnalyze(): void {
    if (!heroHand) return
    setLoading(true)
    setResult(null)
    setEvTableData(null); setEvChartData(null); setRangeData(null); setNashPoint(null)

    setTimeout(() => {
      const payouts = payoutInputs.slice(0, paidPlaces).map(p => parseFloat(p) || 0)
      const heroStackChips = Math.round(stackBb * bbSize)
      const fullStacks = [heroStackChips, ...stacks.slice(1, players)]
      const callerIdx = 1

      // ── Nash-Solver ──────────────────────────────────────────────────────
      const nashResult = solveNash({ stacks: fullStacks, payouts, bbSize, ante, callerIdx })
      setNashReady(nashResult)

      // ── MC-Equity + ICM-Szenarien ────────────────────────────────────────
      const heroCombos = handIdToCombos(heroHand)
      let equityResult: EquityResult | null = null
      let icmResult: IcmScenarios | null = null

      if (heroCombos.length > 0) {
        const heroCards = heroCombos[0]
        const syntheticSpot = {
          players, position, stackBb, action: 'call' as ActionType,
          hands: Object.fromEntries(
            ALL_HAND_IDS.map(id => {
              const r = nashResult.callRange.get(id)
              return [id, r && r.ev > 0 ? { ev: r.ev, freq: null } : null]
            })
          ),
        }
        const range = buildCallingRange(syntheticSpot, heroCards)
        if (range.length > 0) equityResult = computeEquityMC(heroCards, range, 2000)
        if (fullStacks.every(s => s > 0)) {
          icmResult = computeIcmScenarios(fullStacks, payouts, bbSize, ante, callerIdx, computeIcmEquities)
        }
      }

      setResult({ handId: heroHand, nashResult, equity: equityResult, icm: icmResult, payouts, stacks: fullStacks })
      setLoading(false)

      // ── EV-Tabelle (synchron — nur Map-Lookups, O(169)) ──────────────────
      setEvTableData(getHandEvTableData(nashResult))

      // ── Hand EV Chart + Range-Korrelation (asynchron — Equity-Lookups) ───
      setChartsLoading(true)
      const nCall = [...nashResult.callRange.values()].filter(r => r.ev > 0).length
      const nPush = [...nashResult.pushRange.values()].filter(r => r.ev > 0).length
      const nashCallPctVal = Math.round(nCall / 169 * 100)
      const nashPushPctVal = Math.round(nPush / 169 * 100)

      setTimeout(() => {
        const deltas = computeIcmDeltas(fullStacks, payouts, 0, callerIdx, bbSize, ante)
        const evChart = getHandEvChartData(heroHand, deltas)
        setEvChartData(evChart)
        const corrResult = getRangeCorrelationData(deltas, nashCallPctVal, nashPushPctVal)
        setRangeData(corrResult.points)
        setNashPoint(corrResult.nashPoint)
        setChartsLoading(false)
      }, 0)
    }, 0)
  }

  // ── UI-Hilfsfunktionen ──────────────────────────────────────────────────────

  const totalPayout = payoutInputs.slice(0, paidPlaces).reduce((s, p) => s + (parseFloat(p) || 0), 0)

  function fmtEq(v: number): string {
    if (totalPayout > 0) return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    return v.toLocaleString('de-DE')
  }

  function fmtDelta(v: number): string {
    const abs = fmtEq(Math.abs(v))
    return v >= 0 ? `+${abs}` : `-${abs}`
  }

  const selectedNash = result ? result.nashResult.pushRange.get(result.handId) : null

  const tabCls = (key: ResultTab) =>
    resultTab === key
      ? 'border-b-2 border-accent pb-2 pt-2.5 px-4 text-xs font-semibold text-text'
      : 'border-b-2 border-transparent pb-2 pt-2.5 px-4 text-xs text-muted hover:text-text transition-colors'

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-6">
      {/* ── Equity-Tabelle vorberechnen ────────────────────────────────────── */}
      {precompPct < 0.99 && (
        <PrecomputeBanner onStart={handlePrecompute} pct={precompPct} running={precompRunning} />
      )}

      {/* ── Situation ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Spieler</label>
          <select className={selectCls} value={players} onChange={e => handlePlayersChange(Number(e.target.value) as PlayerCount)}>
            {([2,3,4,5,6,7,8,9] as PlayerCount[]).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Position</label>
          <select className={selectCls} value={position} onChange={e => setPosition(e.target.value as Position)}>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Stack (BB)</label>
          <div className="flex items-center gap-2">
            <input type="range" min={2} max={25} step={0.5} value={stackBb}
              onChange={e => handleStackBbChange(parseFloat(e.target.value))}
              className="w-28 accent-accent" />
            <input type="number" min={2} max={25} step={0.5} value={stackInput}
              onChange={e => { setStackInput(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) handleStackBbChange(n) }}
              className="bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm text-text tabnum focus:outline-none focus:ring-1 focus:ring-accent w-16" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Big Blind</label>
          <input type="number" min={1} className={`${selectCls} w-24`} value={bbSize}
            onChange={e => setBbSize(parseInt(e.target.value,10)||100)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Ante</label>
          <input type="number" min={0} className={`${selectCls} w-24`} value={ante}
            onChange={e => setAnte(parseInt(e.target.value,10)||0)} />
        </div>
      </div>

      {/* Stacks */}
      <div>
        <p className="text-sm font-medium text-muted mb-2">Stacks aller Spieler (Index 0 = Hero)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Array.from({ length: players }, (_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label className="text-xs text-muted">{i === 0 ? 'Hero' : `Sp. ${i+1}`}</label>
              <input type="number" min={1} className={`${inputCls} ${i===0?'ring-1 ring-accent/50':''}`}
                value={stacks[i] ?? Math.round(stackBb*bbSize)}
                onChange={e => { const u=[...stacks]; u[i]=parseInt(e.target.value,10)||0; setStacks(u) }} />
            </div>
          ))}
        </div>
      </div>

      {/* Auszahlungen */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Bezahlte Plätze</label>
          <select className={selectCls} value={paidPlaces} onChange={e => setPaidPlaces(Number(e.target.value))}>
            {Array.from({ length: players-1 }, (_,i) => i+1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {Array.from({ length: paidPlaces }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-xs text-muted">Platz {i+1}</label>
            <input type="number" min={0} className={`${inputCls} w-20`}
              value={payoutInputs[i] ?? ''}
              onChange={e => { const u=[...payoutInputs]; u[i]=e.target.value; setPayoutInputs(u) }} />
          </div>
        ))}
        <button className="btn-ghost text-xs self-end mb-0.5 disabled:opacity-50"
          onClick={handleLoadNash} disabled={nashLoading}>
          {nashLoading ? 'Berechne…' : 'Nash-Ranges laden'}
        </button>
      </div>

      {/* Hand-Auswahl */}
      <div>
        <p className="text-sm font-medium text-muted mb-1">
          Hand auswählen
          {heroHand && <span className="ml-2 text-text font-semibold tabnum">{heroHand}</span>}
        </p>
        <p className="text-xs text-muted mb-3">
          Farbe = Nash-Push-EV (grün = pushen, gelb = grenzwertig, grau = folden).
          Nach „Analysieren" zeigt die EV-Tabelle alle 169 Hände mit konkreten Werten.
        </p>
        <MiniHandGrid selected={heroHand} onSelect={setHeroHand} nashResult={nashReady} />
      </div>

      <button
        className="btn-primary self-start disabled:opacity-50"
        onClick={handleAnalyze}
        disabled={!heroHand || loading}
      >
        {loading ? 'Berechne Nash + Equity…' : 'Analysieren'}
      </button>

      {/* ── Ergebnis ────────────────────────────────────────────────────────── */}
      {result && (
        <div className="flex flex-col gap-0 border-t border-white/10 pt-5">
          {/* Sub-Tab-Leiste */}
          <div className="flex gap-1 border-b border-white/10 mb-5">
            {RESULT_TABS.map(t => (
              <button key={t.key} className={tabCls(t.key)} onClick={() => setResultTab(t.key)}>
                {t.label}
                {t.key === 'evchart' && chartsLoading && (
                  <span className="ml-1 h-2 w-2 inline-block rounded-full bg-accent/60 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: Analyse ────────────────────────────────────────────────── */}
          {resultTab === 'analyse' && (
            <div className="flex flex-col gap-5">
              {/* Header */}
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-2xl font-bold tabnum text-text">{result.handId}</span>
                <span className="text-sm text-muted">{players}-handed · {position} · {stackBb} BB</span>
                {selectedNash && (
                  <>
                    <span className={`text-lg font-bold ${selectedNash.ev > 0 ? 'text-profit' : 'text-loss'}`}>
                      {selectedNash.ev > 0 ? 'PUSH ✓' : 'FOLD'}
                    </span>
                    <span className="tabnum text-sm text-muted">
                      Nash-EV:{' '}
                      <span className={selectedNash.ev >= 0 ? 'text-profit' : 'text-loss'}>
                        {selectedNash.ev >= 0 ? '+' : ''}{selectedNash.ev.toFixed(3)}
                      </span>
                    </span>
                    <span className="tabnum text-sm text-muted">
                      Equity vs Call-Range: <span className="text-text">{(selectedNash.equity * 100).toFixed(1)} %</span>
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-muted">
                Konvergenz nach <span className="text-text tabnum">{result.nashResult.iterations}</span> Iterationen
                {result.nashResult.converged ? ' ✓' : ' (max. erreicht)'}.{' '}
                Push: <span className="text-text tabnum">{[...result.nashResult.pushRange.values()].filter(r=>r.ev>0).length}</span> Hände ·
                Call: <span className="text-text tabnum">{[...result.nashResult.callRange.values()].filter(r=>r.ev>0).length}</span> Hände.
              </p>

              {/* MC-Equity */}
              {result.equity && (
                <div className="rounded-lg border border-white/10 p-4 flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted">
                    Equity vs Nash-Calling-Range (MC · {result.equity.iterations.toLocaleString('de-DE')} Iterationen)
                  </p>
                  <div className="flex flex-wrap gap-6 items-center">
                    <span className="text-2xl font-bold tabnum text-text">
                      {(result.equity.equity * 100).toFixed(1)} %
                    </span>
                    <span className="text-xs text-muted">±{(result.equity.stdDev * 196).toFixed(1)} % (95%-KI)</span>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden">
                    <div className="bg-profit" style={{ width: `${result.equity.equity * 100}%` }} />
                    <div className="bg-loss flex-1" />
                  </div>
                  <div className="flex justify-between text-xs text-muted tabnum">
                    <span>Hero {(result.equity.equity * 100).toFixed(1)} %</span>
                    <span>Villain {((1 - result.equity.equity) * 100).toFixed(1)} %</span>
                  </div>
                </div>
              )}

              {/* ICM-Szenarien */}
              {result.icm && (
                <div className="rounded-lg border border-white/10 p-4 flex flex-col gap-3">
                  <p className="text-xs font-medium text-muted">ICM-Equity-Szenarien (Malmuth-Harville)</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-1.5 px-2 text-xs text-muted font-medium">Szenario</th>
                        <th className="text-right py-1.5 px-2 text-xs text-muted font-medium">ICM-Equity</th>
                        <th className="text-right py-1.5 px-2 text-xs text-muted font-medium">Δ vs Fold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Fold', val: result.icm.fold, key: 'fold' },
                        { label: 'Push — alle folden', val: result.icm.pushWinBlinds, key: 'blinds' },
                        { label: 'Push — gecallt & gewonnen', val: result.icm.pushCallWin, key: 'win' },
                        { label: 'Push — gecallt & verloren', val: result.icm.pushCallLose, key: 'lose' },
                      ].map(row => {
                        const delta = row.val - result.icm!.fold
                        return (
                          <tr key={row.key} className="border-b border-white/5">
                            <td className="py-2 px-2 text-text text-sm">{row.label}</td>
                            <td className="py-2 px-2 text-right tabnum text-text">{fmtEq(row.val)}</td>
                            <td className={`py-2 px-2 text-right tabnum ${row.key==='fold'?'text-muted':delta>=0?'text-profit':'text-loss'}`}>
                              {row.key==='fold' ? '—' : fmtDelta(delta)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {result.equity && selectedNash && (
                    <div className="rounded-lg bg-white/[0.03] px-3 py-2.5 flex items-center gap-3">
                      <span className="text-xs text-muted">ICM-EV (Push vs Fold):</span>
                      {(() => {
                        const { fold, pushWinBlinds, pushCallWin, pushCallLose } = result.icm!
                        const callRangeSize = [...result.nashResult.callRange.values()].filter(r=>r.ev>0).length
                        const pCall = Math.min(1, callRangeSize / 169)
                        const eq = selectedNash.equity
                        const ev = (1-pCall)*(pushWinBlinds-fold) + pCall*eq*(pushCallWin-fold) + pCall*(1-eq)*(pushCallLose-fold)
                        return <span className={`text-sm font-semibold tabnum ${ev>=0?'text-profit':'text-loss'}`}>{fmtDelta(ev)}</span>
                      })()}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted">
                Nash-Ranges via iterativer Best-Response (ICM-adjustiert). Equity via Monte Carlo gegen Nash-Calling-Range.
                Die anderen Tabs zeigen alle 169 EVs, Sensitivitäts-Chart und Range-Korrelationskurve.
              </p>
            </div>
          )}

          {/* ── Tab: EV-Tabelle ──────────────────────────────────────────────── */}
          {resultTab === 'evtable' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  ICM-adjustierter Push-EV für alle 169 Hände in dieser Situation.
                  Ausgewählte Hand: <span className="text-text font-semibold">{result.handId}</span>
                </p>
                <HandEvTableLegend />
              </div>
              {evTableData ? (
                <HandEvTable data={evTableData} selected={result.handId} onSelect={hand => {
                  // Hand in MiniGrid synchronisieren
                  setHeroHand(hand)
                }} />
              ) : (
                <div className="h-24 flex items-center justify-center text-xs text-muted">Wird berechnet…</div>
              )}
              <p className="text-xs text-muted">
                Positive Werte (grün) = Push profitabel. Negative Werte (rot) = Fold besser.
                EV in Payout-Einheit (Δ vs Fold = 0).
              </p>
            </div>
          )}

          {/* ── Tab: Hand EV Chart ───────────────────────────────────────────── */}
          {resultTab === 'evchart' && (
            <div className="flex flex-col gap-3">
              {chartsLoading ? (
                <div className="h-32 flex flex-col items-center justify-center gap-2 text-xs text-muted">
                  <span className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  Berechne Equity-Sensitivität…
                  {precompPct < 0.99 && (
                    <span className="text-xs text-muted/60">Tipp: Equity-Tabelle vorberechnen für sofortige Charts.</span>
                  )}
                </div>
              ) : evChartData ? (
                <HandEvChart
                  data={evChartData}
                  handId={result.handId}
                  nashCallPct={nashPoint?.callPct ?? 50}
                />
              ) : (
                <div className="h-24 flex items-center justify-center text-xs text-muted">Keine Daten</div>
              )}
            </div>
          )}

          {/* ── Tab: Range-Korrelation ───────────────────────────────────────── */}
          {resultTab === 'range' && (
            <div className="flex flex-col gap-3">
              {chartsLoading ? (
                <div className="h-32 flex flex-col items-center justify-center gap-2 text-xs text-muted">
                  <span className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  Berechne Range-Korrelationskurve ({(169 * 21).toLocaleString('de-DE')} Equity-Lookups)…
                </div>
              ) : rangeData && nashPoint ? (
                <RangeCorrelationChart data={rangeData} nashPoint={nashPoint} />
              ) : (
                <div className="h-24 flex items-center justify-center text-xs text-muted">Keine Daten</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
