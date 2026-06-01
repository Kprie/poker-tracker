import { useState } from 'react'
import type { Card } from '../lib/cards'
import { cardRank, cardSuit } from '../lib/cards'
import { computeIcmEquities } from '../lib/icm'
import { computeExactEquity, bestHandScore, handRankName } from '../lib/exactEquity'
import type { ExactEquityResult } from '../lib/exactEquity'
import { CardPicker, cardLabel, cardColorClass } from './CardPicker'

// ─── Typen ────────────────────────────────────────────────────────────────────

type SlotKey = 'h0' | 'h1' | 'b0' | 'b1' | 'b2' | 'b3' | 'b4' | 'v0' | 'v1'

interface SimResult {
  equity: ExactEquityResult
  heroHandName: string
  villainHandName: string
  fold: number
  pushWinBlinds: number
  pushCallWin: number
  pushCallLose: number
  payouts: number[]
  stacks: number[]
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const SLOT_LABELS: Record<SlotKey, string> = {
  h0: 'Hero 1', h1: 'Hero 2',
  b0: 'Board 1', b1: 'Board 2', b2: 'Board 3', b3: 'Board 4', b4: 'Board 5',
  v0: 'Villain 1', v1: 'Villain 2',
}

function slotGroup(s: SlotKey): 'hero' | 'board' | 'villain' {
  if (s.startsWith('h')) return 'hero'
  if (s.startsWith('b')) return 'board'
  return 'villain'
}

const selectCls = 'bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent'
const inputCls  = 'bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text tabnum focus:outline-none focus:ring-1 focus:ring-accent w-full'

// ─── Karten-Slot ──────────────────────────────────────────────────────────────

function CardSlot({ card, label, active, onClick }: {
  card: Card | null; label: string; active: boolean; onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      className={[
        'h-10 w-8 rounded border text-center leading-none transition-all font-mono flex flex-col items-center justify-center',
        active  ? 'border-accent ring-1 ring-accent bg-accent/10'
        : card !== null ? 'border-white/20 bg-slate-800 hover:border-white/40'
        : 'border-dashed border-white/20 bg-slate-900/50 hover:border-white/40',
      ].join(' ')}
      style={{ fontSize: 11 }}
    >
      {card !== null ? (
        <span className={cardColorClass(card)}>
          {cardLabel(card)}
        </span>
      ) : (
        <span className="text-slate-600 text-xs">+</span>
      )}
    </button>
  )
}

// ─── ICM-Szenarien-Tabelle ────────────────────────────────────────────────────

function IcmTable({ result }: { result: SimResult }): JSX.Element {
  const { fold, pushWinBlinds, pushCallWin, pushCallLose, equity, payouts } = result
  const totalPayout = payouts.reduce((a, b) => a + b, 0)
  const pCall = equity.win + equity.lose + equity.tie > 0
    ? Math.min(1, result.stacks.length > 1 ? 0.5 : 0)   // vereinfacht; nutze equity
    : 0

  const evPush =
    (1 - pCall) * (pushWinBlinds - fold) +
    pCall * equity.win * (pushCallWin - fold) +
    pCall * (equity.lose + equity.tie * 0.5) * (pushCallLose - fold)

  function fmt(v: number): string {
    if (totalPayout > 0)
      return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    return v.toLocaleString('de-DE', { maximumFractionDigits: 4 })
  }

  const rows = [
    { label: 'Fold (aktueller Stack)', val: fold },
    { label: 'Push — alle folden', val: pushWinBlinds },
    { label: 'Push — gecallt & gewonnen', val: pushCallWin },
    { label: 'Push — gecallt & verloren', val: pushCallLose },
  ]

  return (
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
          {rows.map((row, i) => {
            const delta = row.val - fold
            return (
              <tr key={i} className="border-b border-white/5">
                <td className="py-2 px-2 text-text text-sm">{row.label}</td>
                <td className="py-2 px-2 text-right tabnum text-text">{fmt(row.val)}</td>
                <td className={`py-2 px-2 text-right tabnum ${i === 0 ? 'text-muted' : delta >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {i === 0 ? '—' : `${delta >= 0 ? '+' : ''}${fmt(delta)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5 flex items-center gap-3">
        <span className="text-xs text-muted">Gewichteter Push-EV:</span>
        <span className={`text-sm font-semibold tabnum ${evPush >= 0 ? 'text-profit' : 'text-loss'}`}>
          {evPush >= 0 ? '+' : ''}{fmt(evPush)}
        </span>
        <span className="text-xs text-muted">(vereinfacht — ohne konkrete Call-Frequenz)</span>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function RoundSimulator(): JSX.Element {
  // Karten-State
  const [heroCards,    setHeroCards]    = useState<[Card | null, Card | null]>([null, null])
  const [boardCards,   setBoardCards]   = useState<[Card | null, Card | null, Card | null, Card | null, Card | null]>([null, null, null, null, null])
  const [villainCards, setVillainCards] = useState<[Card | null, Card | null]>([null, null])
  const [activeSlot,   setActiveSlot]   = useState<SlotKey | null>('h0')

  // Situation
  const [players,      setPlayers]      = useState(2)
  const [bbSize,       setBbSize]       = useState(200)
  const [ante,         setAnte]         = useState(0)
  const [stacks,       setStacks]       = useState<number[]>([2000, 2000])
  const [paidPlaces,   setPaidPlaces]   = useState(2)
  const [payoutInputs, setPayoutInputs] = useState<string[]>(['65', '35'])

  // Ergebnis
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<SimResult | null>(null)

  // ── Karten-Verwaltung ───────────────────────────────────────────────────────

  function allCards(): Card[] {
    return [
      ...heroCards.filter((c): c is Card => c !== null),
      ...boardCards.filter((c): c is Card => c !== null),
      ...villainCards.filter((c): c is Card => c !== null),
    ]
  }

  function blockedFor(slot: SlotKey): Card[] {
    const group = slotGroup(slot)
    return allCards().filter(c => {
      const inHero    = heroCards.includes(c)
      const inBoard   = boardCards.includes(c)
      const inVillain = villainCards.includes(c)
      if (group === 'hero')    return inBoard || inVillain
      if (group === 'board')   return inHero  || inVillain
      if (group === 'villain') return inHero  || inBoard
      return false
    })
  }

  function selectedFor(slot: SlotKey): Card[] {
    const group = slotGroup(slot)
    if (group === 'hero')    return heroCards.filter((c): c is Card => c !== null)
    if (group === 'board')   return boardCards.filter((c): c is Card => c !== null)
    return villainCards.filter((c): c is Card => c !== null)
  }

  function handleToggle(c: Card): void {
    if (activeSlot === null) return
    const group = slotGroup(activeSlot)

    if (group === 'hero') {
      const next: [Card | null, Card | null] = [...heroCards]
      if (next[0] === c || next[1] === c) {
        // Deselect
        if (next[0] === c) next[0] = null
        else next[1] = null
      } else {
        const idx = activeSlot === 'h0' ? 0 : 1
        if (next[idx] !== null) return  // Slot belegt → erst deselect
        next[idx] = c
        // Auto-Advance zum nächsten freien Slot
        if (idx === 0 && next[1] === null) setActiveSlot('h1')
      }
      setHeroCards(next)

    } else if (group === 'board') {
      const next: [Card | null, Card | null, Card | null, Card | null, Card | null] = [...boardCards]
      const idx = parseInt(activeSlot[1])
      if (next[idx] === c) {
        next[idx] = null
      } else {
        if (next[idx] !== null) return
        next[idx] = c
        // Auto-Advance
        const nextFree = next.findIndex((x, i) => x === null && i > idx)
        if (nextFree !== -1) setActiveSlot(`b${nextFree}` as SlotKey)
      }
      setBoardCards(next)

    } else {
      const next: [Card | null, Card | null] = [...villainCards]
      const idx = activeSlot === 'v0' ? 0 : 1
      if (next[0] === c || next[1] === c) {
        if (next[idx] === c) next[idx] = null
      } else {
        if (next[idx] !== null) return
        next[idx] = c
        if (idx === 0 && next[1] === null) setActiveSlot('v1')
      }
      setVillainCards(next)
    }
  }

  // ── Spieler-Anzahl-Änderung ─────────────────────────────────────────────────

  function handlePlayersChange(n: number): void {
    setPlayers(n)
    setStacks(prev => {
      const next = Array.from({ length: n }, (_, i) => prev[i] ?? Math.round(stacks[0] || 2000))
      return next
    })
  }

  // ── Analyse ─────────────────────────────────────────────────────────────────

  function handleAnalyze(): void {
    if (heroCards[0] === null || heroCards[1] === null) return
    if (villainCards[0] === null || villainCards[1] === null) return

    setLoading(true)
    setResult(null)

    setTimeout(() => {
      const hero    = heroCards as [Card, Card]
      const villain = villainCards as [Card, Card]
      const board   = boardCards.filter((c): c is Card => c !== null)
      const payouts = payoutInputs.slice(0, paidPlaces).map(p => parseFloat(p) || 0)
      const fullStacks = stacks.slice(0, players)

      const equity = computeExactEquity(hero, villain, board)

      // Hand-Namen
      const heroScore    = bestHandScore([hero[0], hero[1], ...board])
      const villainScore = bestHandScore([villain[0], villain[1], ...board])

      // ICM-Szenarien (Push-Analyse für Preflop)
      const n = fullStacks.length
      const pot = Math.round(bbSize * 1.5) + ante * n
      const heroIdx = 0, callerIdx = 1
      const baseEq = computeIcmEquities(fullStacks, payouts)
      const fold   = baseEq[heroIdx]

      const eff = Math.min(fullStacks[heroIdx] ?? 0, fullStacks[callerIdx] ?? 0)

      const sWinPot = [...fullStacks]; sWinPot[heroIdx] += pot
      const pushWinBlinds = computeIcmEquities(sWinPot, payouts)[heroIdx]

      const sWinCall = [...fullStacks]
      sWinCall[heroIdx] = (fullStacks[heroIdx] ?? 0) + eff + pot
      sWinCall[callerIdx] = Math.max(0, (fullStacks[callerIdx] ?? 0) - eff)
      const pushCallWin = computeIcmEquities(sWinCall, payouts)[heroIdx]

      const sLoseCall = [...fullStacks]
      sLoseCall[callerIdx] = (fullStacks[callerIdx] ?? 0) + eff + pot
      sLoseCall[heroIdx] = Math.max(0, (fullStacks[heroIdx] ?? 0) - eff)
      const pushCallLose = computeIcmEquities(sLoseCall, payouts)[heroIdx]

      setResult({
        equity,
        heroHandName:    heroScore >= 0 ? handRankName(heroScore) : '—',
        villainHandName: villainScore >= 0 ? handRankName(villainScore) : '—',
        fold,
        pushWinBlinds,
        pushCallWin,
        pushCallLose,
        payouts,
        stacks: fullStacks,
      })
      setLoading(false)
    }, 0)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const heroOk    = heroCards[0] !== null && heroCards[1] !== null
  const villainOk = villainCards[0] !== null && villainCards[1] !== null
  const board     = boardCards.filter((c): c is Card => c !== null)

  const boardStage = board.length === 0 ? 'Preflop'
    : board.length === 3 ? 'Flop'
    : board.length === 4 ? 'Turn'
    : board.length === 5 ? 'River' : 'Unvollständig'

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-6">

      {/* ── Situation ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Spieler</label>
          <select className={selectCls} value={players} onChange={e => handlePlayersChange(Number(e.target.value))}>
            {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Big Blind</label>
          <input type="number" min={1} className={`${selectCls} w-24`} value={bbSize} onChange={e => setBbSize(parseInt(e.target.value, 10) || 100)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Ante</label>
          <input type="number" min={0} className={`${selectCls} w-24`} value={ante} onChange={e => setAnte(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Bezahlte Plätze</label>
          <select className={selectCls} value={paidPlaces} onChange={e => setPaidPlaces(Number(e.target.value))}>
            {Array.from({ length: players - 1 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {Array.from({ length: paidPlaces }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-xs text-muted">Platz {i + 1}</label>
            <input type="number" min={0} className={`${inputCls} w-20`}
              value={payoutInputs[i] ?? ''}
              onChange={e => { const u = [...payoutInputs]; u[i] = e.target.value; setPayoutInputs(u) }} />
          </div>
        ))}
      </div>

      {/* Stacks */}
      <div>
        <p className="text-sm font-medium text-muted mb-2">Stacks (Index 0 = Hero)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Array.from({ length: players }, (_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label className="text-xs text-muted">{i === 0 ? 'Hero' : `Sp. ${i + 1}`}</label>
              <input type="number" min={1} className={`${inputCls} ${i === 0 ? 'ring-1 ring-accent/50' : ''}`}
                value={stacks[i] ?? 1000}
                onChange={e => { const u = [...stacks]; u[i] = parseInt(e.target.value, 10) || 0; setStacks(u) }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Karten-Eingabe ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted">
          Karten eingeben
          <span className="ml-2 text-xs font-normal text-muted/60">— Slot anklicken, dann Karte im Picker wählen</span>
        </p>

        {/* Slots */}
        <div className="flex flex-wrap gap-4 items-start">
          {/* Hero */}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted">Hero-Hand</p>
            <div className="flex gap-1">
              {(['h0', 'h1'] as SlotKey[]).map(slot => (
                <CardSlot key={slot} card={slot === 'h0' ? heroCards[0] : heroCards[1]}
                  label={SLOT_LABELS[slot]} active={activeSlot === slot}
                  onClick={() => setActiveSlot(slot)} />
              ))}
            </div>
          </div>

          {/* Board */}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted">Board <span className="text-muted/60">({boardStage})</span></p>
            <div className="flex gap-1">
              {(['b0', 'b1', 'b2', 'b3', 'b4'] as SlotKey[]).map((slot, i) => (
                <CardSlot key={slot} card={boardCards[i]}
                  label={SLOT_LABELS[slot]} active={activeSlot === slot}
                  onClick={() => setActiveSlot(slot)} />
              ))}
            </div>
          </div>

          {/* Villain */}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted">Villain-Hand</p>
            <div className="flex gap-1">
              {(['v0', 'v1'] as SlotKey[]).map(slot => (
                <CardSlot key={slot} card={slot === 'v0' ? villainCards[0] : villainCards[1]}
                  label={SLOT_LABELS[slot]} active={activeSlot === slot}
                  onClick={() => setActiveSlot(slot)} />
              ))}
            </div>
            {!villainOk && (
              <p className="text-xs text-muted/50 mt-0.5">Erforderlich für Analyse</p>
            )}
          </div>
        </div>

        {/* Card Picker */}
        {activeSlot !== null && (
          <div className="rounded-lg border border-white/10 p-3 bg-black/20">
            <p className="text-xs text-muted mb-2">
              Wähle Karte für: <span className="text-text font-medium">{SLOT_LABELS[activeSlot]}</span>
            </p>
            <CardPicker
              selected={activeSlot ? selectedFor(activeSlot) : []}
              blocked={activeSlot ? blockedFor(activeSlot) : []}
              onToggle={handleToggle}
              maxSelect={slotGroup(activeSlot) === 'board' ? 5 : 2}
            />
          </div>
        )}
      </div>

      {/* ── Analysieren ─────────────────────────────────────────────────────── */}
      <button
        className="btn-primary self-start disabled:opacity-50"
        onClick={handleAnalyze}
        disabled={!heroOk || !villainOk || loading}
      >
        {loading ? 'Berechne…' : 'Analysieren'}
      </button>
      {!heroOk    && <p className="text-xs text-loss -mt-4">Hero-Hand unvollständig</p>}
      {heroOk && !villainOk && <p className="text-xs text-muted -mt-4">Villain-Hand eingeben für Equity-Berechnung</p>}

      {/* ── Ergebnis ────────────────────────────────────────────────────────── */}
      {result && (
        <div className="flex flex-col gap-5 border-t border-white/10 pt-5">

          {/* Karten-Zusammenfassung + Hand-Namen */}
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted">Hero-Hand</p>
              <div className="flex gap-1">
                {[heroCards[0], heroCards[1]].filter((c): c is Card => c !== null).map(c => (
                  <span key={c} className={`font-mono font-bold text-sm ${cardColorClass(c)}`}>{cardLabel(c)}</span>
                ))}
              </div>
              {result.heroHandName !== '—' && (
                <p className="text-xs text-accent font-medium">{result.heroHandName}</p>
              )}
            </div>
            {board.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted">Board ({boardStage})</p>
                <div className="flex gap-1">
                  {board.map(c => (
                    <span key={c} className={`font-mono font-bold text-sm ${cardColorClass(c)}`}>{cardLabel(c)}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted">Villain-Hand</p>
              <div className="flex gap-1">
                {[villainCards[0], villainCards[1]].filter((c): c is Card => c !== null).map(c => (
                  <span key={c} className={`font-mono font-bold text-sm ${cardColorClass(c)}`}>{cardLabel(c)}</span>
                ))}
              </div>
              {result.villainHandName !== '—' && (
                <p className="text-xs text-muted font-medium">{result.villainHandName}</p>
              )}
            </div>
          </div>

          {/* Equity-Balken */}
          <div className="rounded-lg border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted flex-1">
                Equity
                {result.equity.isExact
                  ? ` — exakt (${result.equity.sampleCount.toLocaleString('de-DE')} Boards)`
                  : ` — Monte Carlo (${result.equity.sampleCount.toLocaleString('de-DE')} Iterationen, SE < 0.4 %)`}
              </p>
            </div>

            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex flex-col">
                <span className="text-xs text-muted">Hero gewinnt</span>
                <span className="text-2xl font-bold tabnum text-profit">{(result.equity.win * 100).toFixed(1)} %</span>
              </div>
              {result.equity.tie > 0.001 && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted">Unentschieden</span>
                  <span className="text-xl font-bold tabnum text-muted">{(result.equity.tie * 100).toFixed(1)} %</span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs text-muted">Villain gewinnt</span>
                <span className="text-2xl font-bold tabnum text-loss">{(result.equity.lose * 100).toFixed(1)} %</span>
              </div>
            </div>

            {/* Equity-Balken */}
            <div className="flex h-3 rounded-full overflow-hidden">
              <div className="bg-profit transition-all" style={{ width: `${result.equity.win * 100}%` }} />
              {result.equity.tie > 0.001 && (
                <div className="bg-yellow-700 transition-all" style={{ width: `${result.equity.tie * 100}%` }} />
              )}
              <div className="bg-loss flex-1" />
            </div>
            <div className="flex justify-between text-xs text-muted tabnum">
              <span>Hero {(result.equity.win * 100).toFixed(1)} %</span>
              <span>Villain {(result.equity.lose * 100).toFixed(1)} %</span>
            </div>
          </div>

          {/* Outs (nur Turn/River mit bekanntem Board) */}
          {result.equity.outs.length > 0 && (
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-xs font-medium text-muted mb-2">
                Outs für Hero: <span className="text-text tabnum">{result.equity.outs.length}</span> Karte{result.equity.outs.length !== 1 ? 'n' : ''}
              </p>
              <div className="flex flex-wrap gap-1">
                {result.equity.outs.map(c => (
                  <span key={c} className={`font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 ${cardColorClass(c)}`}>
                    {cardLabel(c)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ICM-Szenarien */}
          <IcmTable result={result} />

          <p className="text-xs text-muted">
            Equity: {result.equity.isExact ? 'Vollständige Enumeration aller möglichen Boards — mathematisch exakt.' : 'Monte Carlo-Schätzung — mathematisch bestimmte Wahrscheinlichkeiten, kein historischer Datensatz.'}
          </p>
        </div>
      )}
    </div>
  )
}
