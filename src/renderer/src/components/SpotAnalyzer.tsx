import { useCallback, useState } from 'react'
import { computeIcmEquities } from '../lib/icm'
import { handIdToCombos } from '../lib/cards'
import { buildCallingRange, computeEquityMC, computeIcmScenarios } from '../lib/equity'
import type { EquityResult, IcmScenarios } from '../lib/equity'
import { solveNash, computeIcmDeltas } from '../lib/nashSolver'
import type { NashResult, NashHandResult } from '../lib/nashSolver'
import { solveMultiwaySpotAsync } from '../lib/multiwaySolverClient'
import type { MultiwaySolveResult } from '../lib/multiwaySolver'
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
import { PokerTable } from './PokerTable'

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
type ResultTab   = 'analyse' | 'evtable' | 'evchart' | 'range'

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const RESULT_TABS: { key: ResultTab; label: string }[] = [
  { key: 'analyse',  label: 'Analyse' },
  { key: 'evtable',  label: 'EV-Tabelle' },
  { key: 'evchart',  label: 'Hand EV Chart' },
  { key: 'range',    label: 'Range-Kurve' },
]

const inputCls = 'bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white tabnum focus:outline-none focus:ring-1 focus:ring-accent/60 transition-colors hover:border-white/20'
const selectCls = inputCls + ' cursor-pointer'

/**
 * Standard-Blind-/Ante-Struktur: die beiden letzten Sitze posten SB/BB, alle posten Ante.
 * Bei HU postet Sitz 0 (Hero) den SB. Werte in Chips. Vom Nutzer pro Sitz überschreibbar.
 */
function defaultPosts(players: number, bbSize: number, ante: number): number[] {
  const posts = Array.from({ length: players }, () => ante)
  const sbSeat = players - 2
  const bbSeat = players - 1
  if (sbSeat >= 0) posts[sbSeat] += Math.round(bbSize * 0.5)
  if (bbSeat >= 0) posts[bbSeat] += bbSize
  return posts
}

/** Adaptiert ein MultiwaySolveResult auf die NashResult-Form für Grid/Tabelle. */
function adaptMultiway(res: MultiwaySolveResult): NashResult {
  const toNash = (m: Map<HandId, { ev: number; freq: number }>): Map<HandId, NashHandResult> => {
    const out = new Map<HandId, NashHandResult>()
    for (const [id, r] of m) out.set(id, { handId: id, ev: r.ev, freq: r.freq, equity: 0 })
    return out
  }
  const firstCall = [...res.callRanges.values()][0]
  return {
    pushRange: toNash(res.pushRange),
    callRange: firstCall ? toNash(firstCall) : new Map(),
    converged: res.converged,
    iterations: res.iterations,
  }
}

// ─── Precompute-Banner ────────────────────────────────────────────────────────

function PrecomputeBanner({ onStart, pct, running }: {
  onStart: () => void; pct: number; running: boolean
}): JSX.Element {
  const remaining = Math.ceil((TOTAL_PAIR_COUNT - Math.round(pct * TOTAL_PAIR_COUNT)) * 8 / 1000)
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center gap-4">
      <div className="h-8 w-8 shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v5l3 3" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="8" r="6.5" stroke="#f59e0b" strokeWidth="1.2"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-200/80">Equity-Tabelle vorberechnen</p>
        <p className="text-xs text-amber-200/50 mt-0.5">
          {running
            ? `Berechnung läuft… ${Math.round(pct * 100)} %`
            : `Einmalig ~${remaining} s — danach instantane Nash-Ranges und Charts`}
        </p>
        {running && (
          <div className="mt-2 h-1 rounded-full bg-amber-500/15 overflow-hidden w-full">
            <div className="h-full bg-amber-500/70 transition-all rounded-full"
                 style={{ width: `${Math.round(pct * 100)}%` }} />
          </div>
        )}
      </div>
      {!running && (
        <button className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                onClick={onStart}>
          Jetzt starten
        </button>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

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
  // Posts (Blind+Ante) je Sitz; null = automatische Standard-Struktur.
  const [postsOverride, setPostsOverride] = useState<number[] | null>(null)

  // Hand
  const [heroHand, setHeroHand] = useState<HandId | null>(null)

  // Nash + Analyse
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<AnalysisResult | null>(null)
  const [nashReady, setNashReady] = useState<NashResult | null>(null)
  const [nashLoading, setNashLoading] = useState(false)
  const [resultTab,   setResultTab]   = useState<ResultTab>('analyse')

  // Chart-Daten
  const [evTableData,   setEvTableData]   = useState<HandEvTableEntry[] | null>(null)
  const [evChartData,   setEvChartData]   = useState<HandEvPoint[] | null>(null)
  const [rangeData,     setRangeData]     = useState<RangeCorrelationPoint[] | null>(null)
  const [nashPoint,     setNashPoint]     = useState<{ callPct: number; pushPct: number } | null>(null)
  const [chartsLoading, setChartsLoading] = useState(false)

  // Precompute
  const [precompPct,     setPrecompPct]     = useState(cachedPairCount() / TOTAL_PAIR_COUNT)
  const [precompRunning, setPrecompRunning] = useState(false)

  const positions = availablePositions(players)
  // Effektive Posts: Nutzer-Override oder Standard-Struktur.
  const posts = postsOverride ?? defaultPosts(players, bbSize, ante)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function handlePlayersChange(n: PlayerCount): void {
    setPlayers(n)
    const newStacks = Array.from({ length: n }, (_, i) => stacks[i] ?? Math.round(stackBb * bbSize))
    setStacks(newStacks)
    const pos = availablePositions(n)
    if (!pos.includes(position)) setPosition(pos[0])
    setPostsOverride(null)  // Standard-Posts für neue Spielerzahl
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

  function clearCharts(): void {
    setEvTableData(null); setEvChartData(null); setRangeData(null); setNashPoint(null)
  }

  const handleLoadNash = useCallback(() => {
    setNashLoading(true)
    setNashReady(null)
    clearCharts()
    const heroChips  = Math.round(stackBb * bbSize)
    const fullStacks = [heroChips, ...stacks.slice(1, players)]
    const payouts    = payoutInputs.slice(0, paidPlaces).map(p => parseFloat(p) || 0)

    if (players === 2) {
      // HU: schneller Pfad im Main Thread (warmer Equity-Cache).
      setTimeout(() => {
        const r = solveNash({ stacks: fullStacks, payouts, bbSize, ante })
        setNashReady(r)
        setNashLoading(false)
      }, 0)
    } else {
      // Multiway: rechenintensiv → im Web Worker (UI bleibt flüssig).
      const active = Array.from({ length: players }, (_, i) => i)
      solveMultiwaySpotAsync(active, { stacks: fullStacks, payouts, posts, evIterations: 800, maxIterations: 8, damping: 0.5 })
        .then(res => { setNashReady(adaptMultiway(res)); setNashLoading(false) })
        .catch(err => { console.error('Multiway-Solver-Fehler:', err); setNashLoading(false) })
    }
  }, [stackBb, bbSize, stacks, players, payoutInputs, paidPlaces, ante, posts])

  function handleAnalyze(): void {
    if (!heroHand) return
    setLoading(true)
    setResult(null)
    clearCharts()

    setTimeout(() => {
      const payouts    = payoutInputs.slice(0, paidPlaces).map(p => parseFloat(p) || 0)
      const heroChips  = Math.round(stackBb * bbSize)
      const fullStacks = [heroChips, ...stacks.slice(1, players)]
      const callerIdx  = 1

      const nashResult = solveNash({ stacks: fullStacks, payouts, bbSize, ante, callerIdx })
      setNashReady(nashResult)

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
      setEvTableData(getHandEvTableData(nashResult))

      const nCall = [...nashResult.callRange.values()].filter(r => r.ev > 0).length
      const nPush = [...nashResult.pushRange.values()].filter(r => r.ev > 0).length
      const nashCallPctVal = Math.round(nCall / 169 * 100)
      const nashPushPctVal = Math.round(nPush / 169 * 100)

      setChartsLoading(true)
      setTimeout(() => {
        const deltas = computeIcmDeltas(fullStacks, payouts, 0, callerIdx, bbSize, ante)
        setEvChartData(getHandEvChartData(heroHand, deltas))
        const corr = getRangeCorrelationData(deltas, nashCallPctVal, nashPushPctVal)
        setRangeData(corr.points)
        setNashPoint(corr.nashPoint)
        setChartsLoading(false)
      }, 0)
    }, 0)
  }

  // ── Format ──────────────────────────────────────────────────────────────────

  const totalPayout = payoutInputs.slice(0, paidPlaces).reduce((s, p) => s + (parseFloat(p) || 0), 0)

  function fmtEq(v: number): string {
    if (totalPayout > 0) return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    return v.toLocaleString('de-DE', { maximumFractionDigits: 4 })
  }
  function fmtDelta(v: number): string {
    const a = fmtEq(Math.abs(v))
    return v >= 0 ? `+${a}` : `-${a}`
  }

  const selectedNash = result ? result.nashResult.pushRange.get(result.handId) : null

  const tabCls = (k: ResultTab) =>
    k === resultTab
      ? 'border-b-2 border-accent text-white font-semibold pb-2 pt-2.5 px-4 text-xs'
      : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200 pb-2 pt-2.5 px-4 text-xs transition-colors'

  return (
    <div className="flex flex-col gap-4">
      {/* ── Precompute-Hinweis ───────────────────────────────────────────── */}
      {precompPct < 0.99 && (
        <PrecomputeBanner onStart={handlePrecompute} pct={precompPct} running={precompRunning} />
      )}

      {/* ── Top Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-end px-1">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Spieler</label>
          <select className={selectCls} value={players}
            onChange={e => handlePlayersChange(Number(e.target.value) as PlayerCount)}>
            {([2,3,4,5,6,7,8,9] as PlayerCount[]).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Position</label>
          <select className={selectCls} value={position}
            onChange={e => setPosition(e.target.value as Position)}>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Stack (BB)</label>
          <div className="flex items-center gap-2">
            <input type="range" min={2} max={25} step={0.5} value={stackBb}
              onChange={e => handleStackBbChange(parseFloat(e.target.value))}
              className="w-24 accent-accent cursor-pointer" />
            <input type="number" min={2} max={25} step={0.5} value={stackInput}
              onChange={e => { setStackInput(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) handleStackBbChange(n) }}
              className={`${inputCls} w-14`} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">BB-Größe</label>
          <input type="number" min={1} className={`${inputCls} w-20`} value={bbSize}
            onChange={e => { setBbSize(parseInt(e.target.value, 10) || 100); setPostsOverride(null) }} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Ante</label>
          <input type="number" min={0} className={`${inputCls} w-20`} value={ante}
            onChange={e => { setAnte(parseInt(e.target.value, 10) || 0); setPostsOverride(null) }} />
        </div>
      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-5 items-start">

        {/* ── Linke Spalte: Tisch + Stacks + Payouts + Buttons ────────────── */}
        <div className="flex flex-col gap-4 min-w-0">

          {/* Poker-Tisch */}
          <div className="rounded-2xl overflow-hidden border border-white/8 bg-slate-950/60 p-4 shadow-2xl">
            <PokerTable
              players={players}
              heroPosition={position}
              heroHand={heroHand}
              stacks={stacks}
              bbSize={bbSize}
              nashResult={nashReady}
            />
          </div>

          {/* Stacks */}
          <div className="rounded-xl border border-white/8 bg-slate-900/50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">
              Stacks — Index 0 = Hero
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {Array.from({ length: players }, (_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500">
                    {i === 0 ? <span className="text-accent font-semibold">Hero</span> : `Sp. ${i + 1}`}
                  </label>
                  <input type="number" min={1}
                    className={`${inputCls} ${i === 0 ? 'border-accent/30' : ''} w-full`}
                    value={stacks[i] ?? Math.round(stackBb * bbSize)}
                    onChange={e => { const u = [...stacks]; u[i] = parseInt(e.target.value, 10) || 0; setStacks(u) }} />
                </div>
              ))}
            </div>
          </div>

          {/* Posts (Blind + Ante) je Sitz — multiway-relevant */}
          <div className="rounded-xl border border-white/8 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Posts (Blind + Ante) — Chips je Sitz
              </p>
              {postsOverride && (
                <button className="text-[10px] text-accent hover:underline" onClick={() => setPostsOverride(null)}>
                  Standard
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {Array.from({ length: players }, (_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500">
                    {i === 0 ? <span className="text-accent font-semibold">Hero</span> : `Sp. ${i + 1}`}
                  </label>
                  <input type="number" min={0}
                    className={`${inputCls} w-full`}
                    value={posts[i] ?? 0}
                    onChange={e => { const u = [...posts]; u[i] = parseInt(e.target.value, 10) || 0; setPostsOverride(u) }} />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">
              Standard: die letzten zwei Sitze posten SB/BB, alle posten Ante. Stacks gelten vor dem Posten.
            </p>
          </div>

          {/* Auszahlungen + Aktions-Buttons */}
          <div className="rounded-xl border border-white/8 bg-slate-900/50 p-3 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Bezahlte Plätze</label>
              <select className={selectCls} value={paidPlaces}
                onChange={e => setPaidPlaces(Number(e.target.value))}>
                {Array.from({ length: players - 1 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {Array.from({ length: paidPlaces }, (_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500">Platz {i + 1}</label>
                <input type="number" min={0} className={`${inputCls} w-16`}
                  value={payoutInputs[i] ?? ''}
                  onChange={e => { const u = [...payoutInputs]; u[i] = e.target.value; setPayoutInputs(u) }} />
              </div>
            ))}

            <div className="flex-1" />

            {/* Buttons */}
            <button
              className="px-3 py-1.5 text-xs rounded-lg border border-white/15 text-slate-300 hover:border-white/30 hover:text-white transition-all disabled:opacity-40"
              onClick={handleLoadNash}
              disabled={nashLoading}
            >
              {nashLoading
                ? <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                    Berechne…
                  </span>
                : 'Nash-Ranges laden'}
            </button>

            <button
              className="px-4 py-1.5 text-xs rounded-lg font-semibold bg-accent text-slate-950 hover:bg-accent/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleAnalyze}
              disabled={!heroHand || loading}
            >
              {loading
                ? <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                    Analysieren…
                  </span>
                : 'Analysieren'}
            </button>
          </div>

          {!heroHand && (
            <p className="text-xs text-slate-500 text-center -mt-1">
              Hand im Grid auswählen um zu analysieren
            </p>
          )}
        </div>

        {/* ── Rechte Spalte: Hand-Grid (immer sichtbar) ────────────────────── */}
        <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Hand-Auswahl
                {heroHand && (
                  <span className="ml-2 text-accent font-mono">{heroHand}</span>
                )}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {nashReady
                  ? 'Farbe = ICM-adjustierter Nash-EV · Klicken zum Auswählen'
                  : 'Nash-Ranges laden für EV-Farben · Klicken zum Auswählen'}
              </p>
            </div>
            {evTableData && <HandEvTableLegend />}
          </div>

          {/* Grid — nach Nash: HandEvTable, vorher: einfaches Farb-Grid */}
          {evTableData ? (
            <HandEvTable
              data={evTableData}
              selected={heroHand}
              onSelect={setHeroHand}
            />
          ) : (
            <SimpleHandGrid
              selected={heroHand}
              onSelect={setHeroHand}
              nashResult={nashReady}
            />
          )}
        </div>
      </div>

      {/* ── Ergebnis-Bereich ─────────────────────────────────────────────── */}
      {result && (
        <div className="rounded-2xl border border-white/8 bg-slate-900/60 overflow-hidden shadow-xl">
          {/* Result-Header */}
          <div className="px-5 py-4 border-b border-white/8 flex flex-wrap items-center gap-4 bg-slate-900/40">
            <span className="text-xl font-bold font-mono text-white">{result.handId}</span>
            <span className="text-xs text-slate-400">{players}-handed · {position} · {stackBb} BB</span>

            {selectedNash && (
              <>
                <div className={[
                  'px-3 py-1 rounded-full text-sm font-bold tracking-wide',
                  selectedNash.ev > 0
                    ? 'bg-[#3ddc97]/15 text-[#3ddc97] border border-[#3ddc97]/25'
                    : 'bg-[#f0686d]/15 text-[#f0686d] border border-[#f0686d]/25',
                ].join(' ')}>
                  {selectedNash.ev > 0 ? 'PUSH ✓' : 'FOLD'}
                </div>
                <span className="text-xs text-slate-400 tabnum">
                  EV: <span className={selectedNash.ev >= 0 ? 'text-[#3ddc97]' : 'text-[#f0686d]'}>
                    {selectedNash.ev >= 0 ? '+' : ''}{selectedNash.ev.toFixed(4)}
                  </span>
                </span>
                <span className="text-xs text-slate-400 tabnum">
                  Equity: <span className="text-slate-200">{(selectedNash.equity * 100).toFixed(1)} %</span>
                </span>
                <span className="text-xs text-slate-500 tabnum">
                  Konvergenz: {result.nashResult.iterations} Iter.
                  {result.nashResult.converged ? ' ✓' : ''}
                </span>
              </>
            )}
          </div>

          {/* Sub-Tabs */}
          <div className="flex gap-0 border-b border-white/8 px-4 bg-slate-950/30">
            {RESULT_TABS.map(t => (
              <button key={t.key} className={tabCls(t.key)} onClick={() => setResultTab(t.key)}>
                {t.label}
                {(t.key === 'evchart' || t.key === 'range') && chartsLoading && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Tab-Inhalt */}
          <div className="p-5">
            {/* ── Analyse ──────────────────────────────────────────────── */}
            {resultTab === 'analyse' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* MC-Equity */}
                {result.equity && (
                  <div className="rounded-xl border border-white/8 bg-slate-800/40 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-3">
                      Equity vs Nash-Calling-Range
                    </p>
                    <div className="flex items-baseline gap-3 mb-3">
                      <span className="text-3xl font-bold tabnum text-white">
                        {(result.equity.equity * 100).toFixed(1)} %
                      </span>
                      <span className="text-xs text-slate-500">
                        ±{(result.equity.stdDev * 196).toFixed(1)} % (95%-KI)
                      </span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-[#f0686d]/30">
                      <div className="bg-[#3ddc97] rounded-full transition-all"
                           style={{ width: `${result.equity.equity * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 tabnum mt-1.5">
                      <span>Hero {(result.equity.equity * 100).toFixed(1)} %</span>
                      <span>Villain {((1 - result.equity.equity) * 100).toFixed(1)} %</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2">
                      MC · {result.equity.iterations.toLocaleString('de-DE')} Iterationen
                    </p>
                  </div>
                )}

                {/* ICM-Szenarien */}
                {result.icm && (
                  <div className="rounded-xl border border-white/8 bg-slate-800/40 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-3">
                      ICM-Szenarien (Malmuth-Harville)
                    </p>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Fold',                      val: result.icm.fold,           key: 'fold' },
                        { label: 'Push — alle folden',        val: result.icm.pushWinBlinds,  key: 'blinds' },
                        { label: 'Push — gecallt & gewonnen', val: result.icm.pushCallWin,    key: 'win' },
                        { label: 'Push — gecallt & verloren', val: result.icm.pushCallLose,   key: 'lose' },
                      ].map(row => {
                        const delta = row.val - result.icm!.fold
                        return (
                          <div key={row.key}
                               className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                            <span className="text-xs text-slate-300">{row.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs tabnum text-slate-200">{fmtEq(row.val)}</span>
                              <span className={[
                                'text-xs tabnum w-16 text-right',
                                row.key === 'fold' ? 'text-slate-500'
                                  : delta >= 0 ? 'text-[#3ddc97]' : 'text-[#f0686d]',
                              ].join(' ')}>
                                {row.key === 'fold' ? '—' : fmtDelta(delta)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Gewichteter Push-EV */}
                    {result.equity && selectedNash && (() => {
                      const { fold, pushWinBlinds, pushCallWin, pushCallLose } = result.icm!
                      const pCall = Math.min(1, [...result.nashResult.callRange.values()].filter(r=>r.ev>0).length / 169)
                      const eq    = selectedNash.equity
                      const ev    = (1-pCall)*(pushWinBlinds-fold) + pCall*eq*(pushCallWin-fold) + pCall*(1-eq)*(pushCallLose-fold)
                      return (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                          <span className="text-[10px] text-slate-500">Gewichteter Push-EV</span>
                          <span className={`text-sm font-bold tabnum ${ev>=0?'text-[#3ddc97]':'text-[#f0686d]'}`}>
                            {fmtDelta(ev)}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Info-Fußzeile */}
                <div className="md:col-span-2">
                  <p className="text-[10px] text-slate-600">
                    Push: <span className="tabnum text-slate-400">{[...result.nashResult.pushRange.values()].filter(r=>r.ev>0).length}</span> Hände ·
                    Call: <span className="tabnum text-slate-400">{[...result.nashResult.callRange.values()].filter(r=>r.ev>0).length}</span> Hände ·
                    ABR-Nash-Solver (ICM-adjustiert) · Equity via Monte Carlo
                  </p>
                </div>
              </div>
            )}

            {/* ── EV-Tabelle ────────────────────────────────────────────── */}
            {resultTab === 'evtable' && (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] text-slate-500">
                  ICM-adjustierter Push-EV aller 169 Hände · gewählte Hand:
                  <span className="text-accent font-mono ml-1">{result.handId}</span>
                </p>
                {evTableData
                  ? <HandEvTable data={evTableData} selected={result.handId} onSelect={setHeroHand} />
                  : <LoadingPlaceholder />}
              </div>
            )}

            {/* ── Hand EV Chart ──────────────────────────────────────────── */}
            {resultTab === 'evchart' && (
              chartsLoading
                ? <ChartLoading msg="Berechne Equity-Sensitivität…" />
                : evChartData
                  ? <HandEvChart data={evChartData} handId={result.handId} nashCallPct={nashPoint?.callPct ?? 50} />
                  : <LoadingPlaceholder />
            )}

            {/* ── Range-Korrelation ──────────────────────────────────────── */}
            {resultTab === 'range' && (
              chartsLoading
                ? <ChartLoading msg={`Berechne Range-Kurve (${(169 * 21).toLocaleString('de-DE')} Lookups)…`} />
                : rangeData && nashPoint
                  ? <RangeCorrelationChart data={rangeData} nashPoint={nashPoint} />
                  : <LoadingPlaceholder />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hilfs-Render-Komponenten ─────────────────────────────────────────────────

const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const

function getHandId(row: number, col: number): HandId {
  if (row === col) return RANKS[row] + RANKS[row]
  if (row < col)  return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

function SimpleHandGrid({ selected, onSelect, nashResult }: {
  selected: HandId | null
  onSelect: (id: HandId) => void
  nashResult: NashResult | null
}): JSX.Element {
  function bg(id: HandId): string {
    if (id === selected) return 'ring-1 ring-white/80 bg-accent/80'
    if (!nashResult) return 'bg-slate-800/60 hover:bg-slate-700/60'
    const e = nashResult.pushRange.get(id)
    if (!e) return 'bg-slate-800/60 hover:bg-slate-700/60'
    if (e.ev > 1.0) return 'bg-[#3ddc97]/70 hover:bg-[#3ddc97]/80'
    if (e.ev > 0)   return 'bg-[#3ddc97]/30 hover:bg-[#3ddc97]/40'
    if (e.ev > -1)  return 'bg-amber-900/40 hover:bg-amber-900/50'
    return 'bg-slate-800/60 hover:bg-slate-700/60'
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse select-none" style={{ fontSize: 8 }}>
        <thead>
          <tr>
            <th className="w-5 h-5" />
            {RANKS.map(r => (
              <th key={r} className="w-9 h-5 text-center text-slate-500 font-mono font-normal" style={{ fontSize: 8 }}>{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RANKS.map((_, i) => (
            <tr key={i}>
              <td className="w-5 text-center text-slate-500 font-mono" style={{ fontSize: 8 }}>{RANKS[i]}</td>
              {RANKS.map((_, j) => {
                const id = getHandId(i, j)
                return (
                  <td key={j}
                    onClick={() => onSelect(id)}
                    title={id}
                    className={`w-9 h-8 text-center cursor-pointer rounded-[2px] transition-colors ${bg(id)}`}
                    style={{ padding: '1px' }}
                  >
                    <span className="text-white/70 leading-none font-mono" style={{ fontSize: 7 }}>{id}</span>
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

function LoadingPlaceholder(): JSX.Element {
  return (
    <div className="h-20 flex items-center justify-center text-xs text-slate-500">
      Keine Daten verfügbar
    </div>
  )
}

function ChartLoading({ msg }: { msg: string }): JSX.Element {
  return (
    <div className="h-32 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
      <span className="h-4 w-4 rounded-full border-2 border-accent/60 border-t-transparent animate-spin" />
      {msg}
    </div>
  )
}
