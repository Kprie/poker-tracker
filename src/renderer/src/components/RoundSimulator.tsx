import { useState } from 'react'
import type { Card } from '../lib/cards'
import { handIdToCombos } from '../lib/cards'
import { computeIcmEquities } from '../lib/icm'
import { computeExactEquity, bestHandScore, handRankName } from '../lib/exactEquity'
import type { ExactEquityResult } from '../lib/exactEquity'
import { computeEquityMC, computeIcmScenarios, weightedPushEv } from '../lib/equity'
import type { RangeCombo } from '../lib/equity'
import { defaultPosts } from '../lib/nashSolver'
import { CardPicker, cardLabel, cardColorClass } from './CardPicker'
import { ALL_HAND_IDS, handStrength } from '../data/pushFoldData'
import { inputCls, selectCls } from '../lib/formStyles'
import { fmtEquity, fmtEquityDelta } from '../lib/format'
import { useToolContext, useHandContext, useSpotStore } from '../lib/spotStore'

// ─── Typen ────────────────────────────────────────────────────────────────────

type SlotKey = 'h0' | 'h1' | 'b0' | 'b1' | 'b2' | 'b3' | 'b4' | 'v0' | 'v1'
type VillainMode = 'cards' | 'range'
type BoardStage = 'Preflop' | 'Flop' | 'Turn' | 'River' | 'Ungültig'

interface SimResult {
  heroHandName: string
  villainHandName: string | null  // null im Range-Modus
  board: Card[]
  stage: BoardStage
  // Equity
  exactEquity: ExactEquityResult | null   // nur bei spezifischen Karten
  rangeEquity: { hero: number; stdDev: number; iterations: number } | null
  pCall: number   // 0–1: Wahrscheinlichkeit dass Villain callt
  // ICM (nur Preflop)
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
  b0: 'Flop 1', b1: 'Flop 2', b2: 'Flop 3', b3: 'Turn', b4: 'River',
  v0: 'Villain 1', v1: 'Villain 2',
}

function slotGroup(s: SlotKey): 'hero' | 'board' | 'villain' {
  if (s.startsWith('h')) return 'hero'
  if (s.startsWith('b')) return 'board'
  return 'villain'
}

function boardStage(boardLen: number): BoardStage {
  if (boardLen === 0) return 'Preflop'
  if (boardLen === 3) return 'Flop'
  if (boardLen === 4) return 'Turn'
  if (boardLen === 5) return 'River'
  return 'Ungültig'
}

/** Baut eine Villain-Range aus den stärksten `widthPct`% aller Hände (nach Handstärke). */
function buildVillainRange(widthPct: number, blocked: Card[]): RangeCombo[] {
  const blockSet = new Set(blocked)
  const sorted = [...ALL_HAND_IDS].sort((a, b) => handStrength(b) - handStrength(a))
  const n = Math.round(sorted.length * widthPct / 100)
  const result: RangeCombo[] = []
  for (const id of sorted.slice(0, n)) {
    for (const [c1, c2] of handIdToCombos(id)) {
      if (!blockSet.has(c1) && !blockSet.has(c2)) {
        result.push({ cards: [c1, c2], weight: 1.0 })
      }
    }
  }
  return result
}

// ─── Karten-Slot ──────────────────────────────────────────────────────────────

function CardSlot({ card, label, active, onClick, clearable, onClear }: {
  card: Card | null; label: string; active: boolean
  onClick: () => void; clearable?: boolean; onClear?: () => void
}): JSX.Element {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        title={label}
        className={[
          'h-10 w-8 rounded border text-center transition-all font-mono flex flex-col items-center justify-center',
          active  ? 'border-accent ring-1 ring-accent bg-accent/10'
          : card !== null ? 'border-white/20 bg-neutral-800 hover:border-white/40'
          : 'border-dashed border-white/20 bg-neutral-900/50 hover:border-white/40',
        ].join(' ')}
        style={{ fontSize: 11 }}
      >
        {card !== null ? (
          <span className={cardColorClass(card)}>{cardLabel(card)}</span>
        ) : (
          <span className="text-neutral-600 text-xs">+</span>
        )}
      </button>
      {clearable && card !== null && onClear && (
        <button
          onClick={onClear}
          className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-neutral-700 border border-white/20 text-neutral-400 hover:text-white hover:bg-neutral-600 flex items-center justify-center"
          style={{ fontSize: 8 }}
          title={`${label} entfernen`}
        >
          ×
        </button>
      )}
    </div>
  )
}

// ─── ICM-Szenarien-Tabelle (nur Preflop) ─────────────────────────────────────

function IcmTable({ result }: { result: SimResult }): JSX.Element | null {
  if (result.stage !== 'Preflop') return null

  const { fold, pushWinBlinds, pushCallWin, pushCallLose, pCall } = result
  const totalPayout = result.payouts.reduce((a, b) => a + b, 0)

  // Equity für gewichteten EV:
  const heroEq = result.exactEquity
    ? result.exactEquity.win + result.exactEquity.tie * 0.5
    : result.rangeEquity?.hero ?? 0.5

  const evPush = weightedPushEv({ fold, pushWinBlinds, pushCallWin, pushCallLose }, pCall, heroEq)

  const rows = [
    { label: 'Fold',                       val: fold },
    { label: 'Push — alle folden',         val: pushWinBlinds },
    { label: 'Push — gecallt & gewonnen',  val: pushCallWin },
    { label: 'Push — gecallt & verloren',  val: pushCallLose },
  ]

  return (
    <div className="rounded-lg border border-white/10 p-4 flex flex-col gap-3">
      <p className="text-xs font-medium text-muted">ICM-Equity-Szenarien (Malmuth-Harville · Preflop)</p>
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
                <td className="py-2 px-2 text-right tabnum text-text">{fmtEquity(row.val, totalPayout)}</td>
                <td className={`py-2 px-2 text-right tabnum ${i === 0 ? 'text-muted' : delta >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {i === 0 ? '—' : fmtEquityDelta(delta, totalPayout)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Gewichteter Push-EV */}
      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5 flex items-center justify-between">
        <div>
          <span className="text-xs text-muted">Gewichteter Push-EV</span>
          <span className="text-xs text-muted ml-2">
            (P(Call) = {(pCall * 100).toFixed(0)} % · Equity = {(heroEq * 100).toFixed(1)} %)
          </span>
        </div>
        <span className={`text-sm font-semibold tabnum ${evPush >= 0 ? 'text-profit' : 'text-loss'}`}>
          {fmtEquityDelta(evPush, totalPayout)}
        </span>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function RoundSimulator(): JSX.Element {
  // Karten-State
  const [heroCardsLocal,  setHeroCardsLocal]  = useState<[Card | null, Card | null]>([null, null])
  const [boardCardsLocal, setBoardCardsLocal] = useState<(Card | null)[]>([null, null, null, null, null])
  const [villainCards, setVillainCards] = useState<[Card | null, Card | null]>([null, null])
  const [activeSlot,   setActiveSlot]   = useState<SlotKey | null>('h0')

  // Villain-Modus
  const [villainMode,     setVillainMode]     = useState<VillainMode>('cards')
  const [rangeWidthPct,   setRangeWidthPct]   = useState(30)

  // Situation
  const [players,      setPlayers]      = useState(2)
  const [bbSize,       setBbSize]       = useState(200)
  const [ante,         setAnte]         = useState(0)
  const [stacks,       setStacks]       = useState<number[]>([2000, 2000])
  const [paidPlaces,   setPaidPlaces]   = useState(2)
  const [payoutInputs, setPayoutInputs] = useState<string[]>(['65', '35'])

  // Ergebnis
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<SimResult | null>(null)

  // Eingabemodus + aufgelöster Turnier-Kontext (geteilt oder lokal).
  const inputMode = useSpotStore((s) => s.mode)

  // Setzt die Spieleranzahl und passt die Stacks entsprechend an (wie der lokale Select-onChange).
  function handlePlayersChange(n: number): void {
    setPlayers(n)
    setStacks((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? 1000))
  }

  const ctx = useToolContext({
    players,
    stacks,
    payoutInputs,
    bbSize,
    ante,
    setPlayers: handlePlayersChange,
    setStacks,
    setPayoutInputs,
    setBbSize,
    setAnte,
  })

  // Im geteilten Modus bestimmt die Länge der Auszahlungen die bezahlten Plätze.
  const paidPlacesResolved = inputMode === 'shared' ? ctx.payoutInputs.length : paidPlaces

  // Hero-Karten + Board aus dem aufgelösten Hand-Kontext (geteilt oder lokal).
  // Re-Export unter den ursprünglichen Namen, sodass die Karten-Handler unverändert bleiben.
  const hctx = useHandContext({
    heroCards: heroCardsLocal,
    board: boardCardsLocal,
    setHeroCards: setHeroCardsLocal,
    setBoard: setBoardCardsLocal,
  })
  const heroCards = hctx.heroCards
  const boardCards = hctx.board
  const setHeroCards = hctx.setHeroCards
  const setBoardCards = hctx.setBoard

  // ── Karten-Verwaltung ─────────────────────────────────────────────────────

  function allUsedCards(): Card[] {
    return [
      ...heroCards.filter((c): c is Card => c !== null),
      ...boardCards.filter((c): c is Card => c !== null),
      ...(villainMode === 'cards' ? villainCards.filter((c): c is Card => c !== null) : []),
    ]
  }

  function blockedFor(slot: SlotKey): Card[] {
    const group = slotGroup(slot)
    const all = allUsedCards()
    return all.filter(c => {
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

  /**
   * Karte in Slot setzen/entfernen.
   * Verbesserung gegenüber Vorgänger: Karten können jederzeit ersetzt werden,
   * nicht nur wenn der Slot leer ist.
   */
  function handleToggle(c: Card): void {
    if (activeSlot === null) return
    const group = slotGroup(activeSlot)

    if (group === 'hero') {
      const next: [Card | null, Card | null] = [...heroCards]
      const idx = activeSlot === 'h0' ? 0 : 1
      const other = 1 - idx

      if (next[idx] === c)      { next[idx] = null }          // Deselect
      else if (next[other] === c) { next[other] = null }       // In anderem Slot deselect
      else {
        next[idx] = c
        if (idx === 0 && next[1] === null) setActiveSlot('h1')
      }
      setHeroCards(next)

    } else if (group === 'board') {
      const next: (Card | null)[] = [...boardCards]
      const idx = parseInt(activeSlot[1])

      // Karte in anderem Slot vorhanden → dort entfernen
      const existing = next.indexOf(c)
      if (existing !== -1) {
        next[existing] = null
      } else {
        next[idx] = c
        const nextFree = next.findIndex((x, i) => x === null && i > idx)
        if (nextFree !== -1) setActiveSlot(`b${nextFree}` as SlotKey)
      }
      setBoardCards(next)

    } else {
      // villain
      const next: [Card | null, Card | null] = [...villainCards]
      const idx = activeSlot === 'v0' ? 0 : 1
      const other = 1 - idx

      if (next[idx] === c)       { next[idx] = null }
      else if (next[other] === c) { next[other] = null }
      else {
        next[idx] = c
        if (idx === 0 && next[1] === null) setActiveSlot('v1')
      }
      setVillainCards(next)
    }
  }

  function clearAll(): void {
    setHeroCards([null, null])
    setBoardCards([null, null, null, null, null])
    setVillainCards([null, null])
    setActiveSlot('h0')
    setResult(null)
  }

  function clearCard(slot: SlotKey): void {
    const group = slotGroup(slot)
    if (group === 'hero') {
      const idx = slot === 'h0' ? 0 : 1
      const next: [Card | null, Card | null] = [...heroCards]; next[idx] = null
      setHeroCards(next)
    } else if (group === 'board') {
      const idx = parseInt(slot[1])
      const next: (Card | null)[] = [...boardCards]; next[idx] = null
      setBoardCards(next)
    } else {
      const idx = slot === 'v0' ? 0 : 1
      const next: [Card | null, Card | null] = [...villainCards]; next[idx] = null
      setVillainCards(next)
    }
  }

  // ── Analyse ──────────────────────────────────────────────────────────────

  function handleAnalyze(): void {
    if (heroCards[0] === null || heroCards[1] === null) return
    const heroC = heroCards as [Card, Card]
    const board  = boardCards.filter((c): c is Card => c !== null)
    const stage  = boardStage(board.length)

    if (stage === 'Ungültig') return  // 1 oder 2 Karten

    if (villainMode === 'cards' && (villainCards[0] === null || villainCards[1] === null)) return

    setLoading(true)
    setResult(null)

    setTimeout(() => {
      const payouts    = ctx.payoutInputs.slice(0, paidPlacesResolved).map(p => parseFloat(p) || 0)
      const fullStacks = ctx.stacks.slice(0, ctx.players)
      const n          = fullStacks.length
      const callerIdx  = 1

      // ── Equity ────────────────────────────────────────────────────────
      let exactEquity: ExactEquityResult | null = null
      let rangeEquity: SimResult['rangeEquity'] = null
      let pCall = 0

      if (villainMode === 'cards') {
        const vilC = villainCards as [Card, Card]
        exactEquity = computeExactEquity(heroC, vilC, board)
        pCall = 1.0   // Villain hat konkrete Karten → call ist gesichert

      } else {
        const blocked = [...heroC, ...board]
        const range = buildVillainRange(rangeWidthPct, blocked)
        if (range.length > 0) {
          const mc = computeEquityMC(heroC, range, 3000)
          rangeEquity = { hero: mc.equity, stdDev: mc.stdDev, iterations: mc.iterations }
          // pCall = Anteil der Range an allen verfügbaren Villain-Combos.
          // Verfügbar = C(52 − 2 Hero − Board, 2); preflop = C(50,2) = 1225.
          const remaining = 52 - 2 - board.length
          const availCombos = (remaining * (remaining - 1)) / 2
          pCall = Math.min(1, range.length / availCombos)
        }
      }

      // ── Hand-Namen ────────────────────────────────────────────────────
      const heroScore    = bestHandScore([heroC[0], heroC[1], ...board])
      const villainScore = villainMode === 'cards'
        ? bestHandScore([...(villainCards as [Card, Card]), ...board])
        : -1

      // ── ICM-Szenarien (nur Preflop) — gemeinsames chip-erhaltendes Modell ──
      // Identische Quelle wie SpotAnalyzer (computeIcmScenarios). Posts aus der
      // Standard-Struktur (SB/BB auf den letzten zwei Sitzen, alle Ante).
      const posts = defaultPosts(n, ctx.bbSize, ctx.ante)
      const allAlive = fullStacks.length === n && fullStacks.every(s => s > 0)
      const sc = allAlive
        ? computeIcmScenarios(fullStacks, payouts, posts, callerIdx, computeIcmEquities)
        : (() => {
            const f = computeIcmEquities(fullStacks, payouts)[0]
            return { fold: f, pushWinBlinds: f, pushCallWin: f, pushCallLose: f }
          })()
      const { fold, pushWinBlinds, pushCallWin, pushCallLose } = sc

      setResult({
        heroHandName:    heroScore >= 0 ? handRankName(heroScore) : '—',
        villainHandName: villainScore >= 0 ? handRankName(villainScore) : null,
        board,
        stage,
        exactEquity,
        rangeEquity,
        pCall,
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

  // ── Ableitungen ──────────────────────────────────────────────────────────

  const heroOk    = heroCards[0] !== null && heroCards[1] !== null
  const villainOk = villainMode === 'range'
    ? rangeWidthPct > 0
    : villainCards[0] !== null && villainCards[1] !== null
  const board     = boardCards.filter((c): c is Card => c !== null)
  const stage     = boardStage(board.length)
  const invalidBoard = stage === 'Ungültig'
  const canAnalyze = heroOk && villainOk && !invalidBoard && !loading

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-6">

      {inputMode === 'single' && (
      <>
      {/* ── Situation ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Spieler</label>
          <select className={selectCls} value={players}
            onChange={e => {
              const n = Number(e.target.value)
              setPlayers(n)
              setStacks(prev => Array.from({ length: n }, (_, i) => prev[i] ?? 1000))
            }}>
            {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Big Blind</label>
          <input type="number" min={1} className={`${selectCls} w-24`} value={bbSize}
            onChange={e => setBbSize(parseInt(e.target.value, 10) || 100)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Ante</label>
          <input type="number" min={0} className={`${selectCls} w-24`} value={ante}
            onChange={e => setAnte(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Bezahlte Plätze</label>
          <select className={selectCls} value={paidPlaces}
            onChange={e => setPaidPlaces(Number(e.target.value))}>
            {Array.from({ length: players - 1 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
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
              <label className="text-xs text-muted">{i === 0 ? 'Hero' : `Gegner ${i}`}</label>
              <input type="number" min={1}
                className={`${inputCls} ${i === 0 ? 'ring-1 ring-accent/50' : ''}`}
                value={stacks[i] ?? 1000}
                onChange={e => { const u = [...stacks]; u[i] = parseInt(e.target.value, 10) || 0; setStacks(u) }} />
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* ── Karten-Eingabe ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted">
            Karten — Slot anklicken, dann Karte im Picker wählen
          </p>
          <button
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors border border-white/10 rounded-lg px-2.5 py-1 hover:border-white/20"
            onClick={clearAll}
          >
            Alle zurücksetzen
          </button>
        </div>

        {/* Slot-Gruppen */}
        <div className="flex flex-wrap gap-6 items-start">

          {/* Hero */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted font-medium">Hero-Hand</p>
            <div className="flex gap-1.5">
              {(['h0', 'h1'] as SlotKey[]).map((slot, i) => (
                <CardSlot key={slot}
                  card={heroCards[i]}
                  label={SLOT_LABELS[slot]}
                  active={activeSlot === slot}
                  onClick={() => setActiveSlot(slot)}
                  clearable onClear={() => clearCard(slot)}
                />
              ))}
            </div>
          </div>

          {/* Board */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted font-medium">Board</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                invalidBoard
                  ? 'bg-red-900/40 text-red-400'
                  : stage !== 'Preflop'
                    ? 'bg-white/8 text-neutral-400'
                    : 'text-neutral-600'
              }`}>
                {stage === 'Ungültig' ? '⚠ Unvollständig' : stage}
              </span>
            </div>
            <div className="flex gap-1.5">
              {(['b0', 'b1', 'b2', 'b3', 'b4'] as SlotKey[]).map((slot, i) => (
                <CardSlot key={slot}
                  card={boardCards[i]}
                  label={SLOT_LABELS[slot]}
                  active={activeSlot === slot}
                  onClick={() => setActiveSlot(slot)}
                  clearable onClear={() => clearCard(slot)}
                />
              ))}
            </div>
            {invalidBoard && (
              <p className="text-xs text-red-400/70">
                Board muss 0, 3, 4 oder 5 Karten haben (Preflop / Flop / Turn / River).
              </p>
            )}
          </div>

          {/* Villain */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted font-medium">Villain</p>
              {/* Modus-Toggle */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  className={`text-[10px] px-2 py-0.5 transition-colors ${villainMode === 'cards' ? 'bg-accent/20 text-accent' : 'text-neutral-500 hover:text-neutral-300'}`}
                  onClick={() => setVillainMode('cards')}
                >
                  Karten
                </button>
                <button
                  className={`text-[10px] px-2 py-0.5 transition-colors ${villainMode === 'range' ? 'bg-accent/20 text-accent' : 'text-neutral-500 hover:text-neutral-300'}`}
                  onClick={() => setVillainMode('range')}
                >
                  Range
                </button>
              </div>
            </div>

            {villainMode === 'cards' ? (
              <div className="flex flex-col gap-1">
                <div className="flex gap-1.5">
                  {(['v0', 'v1'] as SlotKey[]).map((slot, i) => (
                    <CardSlot key={slot}
                      card={villainCards[i]}
                      label={SLOT_LABELS[slot]}
                      active={activeSlot === slot}
                      onClick={() => setActiveSlot(slot)}
                      clearable onClear={() => clearCard(slot)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 min-w-[180px]">
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={5} max={100} step={5}
                    value={rangeWidthPct}
                    onChange={e => setRangeWidthPct(Number(e.target.value))}
                    className="flex-1 accent-accent cursor-pointer"
                  />
                  <span className="text-sm tabnum text-text w-10 text-right font-semibold">{rangeWidthPct} %</span>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Stärkste {rangeWidthPct} % aller Hände · ca. {Math.round(1326 * rangeWidthPct / 100)} Kombos
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card Picker */}
        {activeSlot !== null && (villainMode === 'cards' || slotGroup(activeSlot) !== 'villain') && (
          <div className="rounded-lg border border-white/10 p-3 bg-black/20">
            <p className="text-xs text-muted mb-2">
              Karte für <span className="text-text font-medium">{SLOT_LABELS[activeSlot]}</span>
              {' '}— Klick auf belegte Karte ersetzt sie
            </p>
            <CardPicker
              selected={selectedFor(activeSlot)}
              blocked={blockedFor(activeSlot)}
              onToggle={handleToggle}
              maxSelect={slotGroup(activeSlot) === 'board' ? 5 : 2}
            />
          </div>
        )}
      </div>

      {/* ── Analysieren ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
        >
          {loading
            ? <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Berechne…
              </span>
            : 'Analysieren'}
        </button>
        {!heroOk && <p className="text-xs text-loss">Hero-Hand unvollständig</p>}
        {heroOk && !villainOk && <p className="text-xs text-muted">Villain-Hand oder Range eingeben</p>}
        {invalidBoard && <p className="text-xs text-loss">Board unvollständig (1 oder 2 Karten)</p>}
      </div>

      {/* ── Ergebnis ──────────────────────────────────────────────────────────── */}
      {result && (
        <div className="flex flex-col gap-5 border-t border-white/10 pt-5">

          {/* Karten-Header */}
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-muted uppercase tracking-wider">Hero</p>
              <div className="flex gap-1.5">
                {[heroCards[0], heroCards[1]].filter((c): c is Card => c !== null).map(c => (
                  <span key={c} className={`font-mono font-bold text-base ${cardColorClass(c)}`}>{cardLabel(c)}</span>
                ))}
              </div>
              {result.heroHandName !== '—' && (
                <p className="text-xs text-accent font-medium">{result.heroHandName}</p>
              )}
            </div>

            {result.board.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-[10px] text-muted uppercase tracking-wider">Board ({result.stage})</p>
                <div className="flex gap-1.5">
                  {result.board.map(c => (
                    <span key={c} className={`font-mono font-bold text-base ${cardColorClass(c)}`}>{cardLabel(c)}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-muted uppercase tracking-wider">
                Villain {villainMode === 'range' ? `(Top ${rangeWidthPct} % Range)` : ''}
              </p>
              {villainMode === 'cards' ? (
                <>
                  <div className="flex gap-1.5">
                    {[villainCards[0], villainCards[1]].filter((c): c is Card => c !== null).map(c => (
                      <span key={c} className={`font-mono font-bold text-base ${cardColorClass(c)}`}>{cardLabel(c)}</span>
                    ))}
                  </div>
                  {result.villainHandName && (
                    <p className="text-xs text-muted font-medium">{result.villainHandName}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted font-medium">
                  ~{Math.round(result.pCall * ((52 - 2 - result.board.length) * (52 - 3 - result.board.length)) / 2)} Kombos
                </p>
              )}
            </div>
          </div>

          {/* Equity-Balken */}
          <div className="rounded-lg border border-white/10 p-4 flex flex-col gap-3">
            <p className="text-xs font-medium text-muted">
              {result.exactEquity?.isExact
                ? `Equity (exakt · ${result.exactEquity.sampleCount.toLocaleString('de-DE')} Boards)`
                : result.rangeEquity
                  ? `Equity vs Range (MC · ${result.rangeEquity.iterations.toLocaleString('de-DE')} Iter. · SE < ${(Math.sqrt(result.rangeEquity.hero*(1-result.rangeEquity.hero)/result.rangeEquity.iterations)*196*100).toFixed(1)} %)`
                  : 'Equity'}
            </p>

            {result.exactEquity ? (
              <>
                <div className="flex flex-wrap gap-6 items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted">Hero gewinnt</span>
                    <span className="text-3xl font-bold tabnum text-profit">
                      {(result.exactEquity.win * 100).toFixed(1)} %
                    </span>
                  </div>
                  {result.exactEquity.tie > 0.001 && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted">Unentschieden</span>
                      <span className="text-xl font-bold tabnum text-muted">
                        {(result.exactEquity.tie * 100).toFixed(1)} %
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted">Villain gewinnt</span>
                    <span className="text-3xl font-bold tabnum text-loss">
                      {(result.exactEquity.lose * 100).toFixed(1)} %
                    </span>
                  </div>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-loss/30">
                  <div className="bg-profit transition-all" style={{ width: `${result.exactEquity.win * 100}%` }} />
                  {result.exactEquity.tie > 0.001 && (
                    <div className="bg-yellow-600 transition-all" style={{ width: `${result.exactEquity.tie * 100}%` }} />
                  )}
                </div>
                <div className="flex justify-between text-xs text-muted tabnum">
                  <span>Hero {(result.exactEquity.win * 100).toFixed(1)} %</span>
                  {result.exactEquity.tie > 0.001 && (
                    <span>Split {(result.exactEquity.tie * 100).toFixed(1)} %</span>
                  )}
                  <span>Villain {(result.exactEquity.lose * 100).toFixed(1)} %</span>
                </div>
              </>
            ) : result.rangeEquity ? (
              <>
                <div className="flex flex-wrap gap-6 items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted">Hero vs Range</span>
                    <span className="text-3xl font-bold tabnum text-profit">
                      {(result.rangeEquity.hero * 100).toFixed(1)} %
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    ±{(result.rangeEquity.stdDev * 196 * 100).toFixed(1)} % (95%-KI)
                  </span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-loss/30">
                  <div className="bg-profit transition-all" style={{ width: `${result.rangeEquity.hero * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted tabnum">
                  <span>Hero {(result.rangeEquity.hero * 100).toFixed(1)} %</span>
                  <span>Range {((1 - result.rangeEquity.hero) * 100).toFixed(1)} %</span>
                </div>
              </>
            ) : null}
          </div>

          {/* Outs (nur Turn/River, nur bei spezifischen Karten) */}
          {result.exactEquity && result.exactEquity.outs.length > 0 && (
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-xs font-medium text-muted mb-2">
                Outs für Hero: <span className="text-text tabnum">{result.exactEquity.outs.length}</span> Karte{result.exactEquity.outs.length !== 1 ? 'n' : ''}
                <span className="ml-2 text-muted/50">({(result.exactEquity.outs.length * 2.13).toFixed(1)} % pro Karte, Approx.)</span>
              </p>
              <div className="flex flex-wrap gap-1">
                {result.exactEquity.outs.map(c => (
                  <span key={c} className={`font-mono text-xs px-1.5 py-0.5 rounded bg-neutral-800 ${cardColorClass(c)}`}>
                    {cardLabel(c)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ICM-Szenarien (nur Preflop) */}
          <IcmTable result={result} />

          {result.stage !== 'Preflop' && (
            <p className="text-xs text-muted/50">
              ICM-Szenarien werden nur Preflop angezeigt (Push/Fold-Modell).
            </p>
          )}
        </div>
      )}
    </div>
  )
}
