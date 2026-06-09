import { useState } from 'react'
import type { Card } from '../lib/cards'
import { multiwayEquityBoard } from '../lib/multiwayEquity'
import { handClassDistribution, CATEGORY_NAMES } from '../lib/handClass'
import { detectDraws, drawLabels } from '../lib/draws'
import { CardPicker, cardLabel, cardColorClass } from './CardPicker'
import { useHandContext } from '../lib/spotStore'

// ─── Equity-Labor: Multiway-Equity + Handklassen + Draws ──────────────────────

type Slot = { kind: 'hand'; h: number; c: 0 | 1 } | { kind: 'board'; i: number }

interface HandReport {
  equity: number
  topClasses: { name: string; pct: number }[]
  draws: string[]
}

const MAX_HANDS = 4

function CardBtn({ card, active, onClick }: { card: Card | null; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={[
        'h-10 w-8 rounded border text-center font-mono flex items-center justify-center transition-all',
        active ? 'border-accent ring-1 ring-accent bg-accent/10'
        : card !== null ? 'border-white/20 bg-slate-800'
        : 'border-dashed border-white/20 bg-slate-900/50',
      ].join(' ')}
      style={{ fontSize: 11 }}
    >
      {card !== null ? <span className={cardColorClass(card)}>{cardLabel(card)}</span> : <span className="text-slate-600">+</span>}
    </button>
  )
}

export function EquityLab(): JSX.Element {
  const [numHands, setNumHands] = useState(2)
  const [hands, setHands] = useState<(Card | null)[][]>(
    Array.from({ length: MAX_HANDS }, () => [null, null]),
  )
  const [board, setBoard] = useState<(Card | null)[]>([null, null, null, null, null])
  const [active, setActive] = useState<Slot>({ kind: 'hand', h: 0, c: 0 })
  const [reports, setReports] = useState<HandReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Hand 1 (= Hero) und Board kommen aus dem aufgelösten Hand-Kontext (geteilt oder lokal);
  // Hände 2–4 bleiben immer lokal.
  const hctx = useHandContext({
    heroCards: [hands[0][0] ?? null, hands[0][1] ?? null],
    board,
    setHeroCards: (cards) => setHands(prev => { const n = prev.map(r => [...r]); n[0] = [cards[0], cards[1]]; return n }),
    setBoard,
  })
  const getHand = (h: number): (Card | null)[] => (h === 0 ? hctx.heroCards : hands[h])
  const boardR = hctx.board

  const usedCards = (): Card[] => {
    const out: Card[] = []
    for (let h = 0; h < numHands; h++) for (const c of getHand(h)) if (c !== null) out.push(c)
    for (const c of boardR) if (c !== null) out.push(c)
    return out
  }

  function currentCard(): Card | null {
    return active.kind === 'hand' ? getHand(active.h)[active.c] : boardR[active.i]
  }

  function setSlot(card: Card | null): void {
    if (active.kind === 'hand') {
      if (active.h === 0) {
        // Hand 1 läuft über den (ggf. geteilten) Hero-Kontext.
        const pair: [Card | null, Card | null] = [hctx.heroCards[0], hctx.heroCards[1]]
        pair[active.c] = card
        hctx.setHeroCards(pair)
      } else {
        const next = hands.map(row => [...row])
        next[active.h][active.c] = card
        setHands(next)
      }
    } else {
      const next = [...boardR]
      next[active.i] = card
      hctx.setBoard(next)
    }
  }

  function handleToggle(c: Card): void {
    if (currentCard() === c) { setSlot(null); return }
    setSlot(c)
    // Nächsten freien Slot ansteuern
    if (active.kind === 'hand') {
      if (active.c === 0) setActive({ kind: 'hand', h: active.h, c: 1 })
      else if (active.h + 1 < numHands) setActive({ kind: 'hand', h: active.h + 1, c: 0 })
      else setActive({ kind: 'board', i: 0 })
    } else if (active.i < 4) {
      setActive({ kind: 'board', i: active.i + 1 })
    }
  }

  function compute(): void {
    setError(null)
    const complete: [Card, Card][] = []
    for (let h = 0; h < numHands; h++) {
      const [a, b] = getHand(h)
      if (a === null || b === null) { setError(`Hand ${h + 1} unvollständig.`); return }
      complete.push([a, b])
    }
    const boardCards = boardR.filter((c): c is Card => c !== null)
    if (![0, 3, 4, 5].includes(boardCards.length)) { setError('Board muss 0, 3, 4 oder 5 Karten haben.'); return }

    setLoading(true)
    setTimeout(() => {
      const eq = multiwayEquityBoard(complete, boardCards, 8000)
      const reps: HandReport[] = complete.map((hand, i) => {
        // Hole-Cards der übrigen Hände als Dead Cards blocken (sonst verzerrt der Runout).
        const dead = complete.filter((_, j) => j !== i).flat()
        const dist = handClassDistribution(hand, boardCards, 8000, dead)
        const topClasses = dist.dist
          .map((pct, k) => ({ name: CATEGORY_NAMES[k], pct }))
          .filter(x => x.pct > 0.005)
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 3)
        const draws = boardCards.length === 3 || boardCards.length === 4
          ? drawLabels(detectDraws(hand, boardCards))
          : []
        return { equity: eq[i], topClasses, draws }
      })
      setReports(reps)
      setLoading(false)
    }, 0)
  }

  function reset(): void {
    setHands(Array.from({ length: MAX_HANDS }, () => [null, null]))
    hctx.setHeroCards([null, null])
    hctx.setBoard([null, null, null, null, null])
    setActive({ kind: 'hand', h: 0, c: 0 })
    setReports(null)
    setError(null)
  }

  const blocked = usedCards().filter(c => c !== currentCard())

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Anzahl Hände</label>
          <select
            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text"
            value={numHands}
            onChange={e => { setNumHands(Number(e.target.value)); setReports(null) }}
          >
            {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button className="text-xs text-slate-500 hover:text-slate-300 border border-white/10 rounded-lg px-2.5 py-1.5" onClick={reset}>
          Zurücksetzen
        </button>
      </div>

      {/* Hände + Board */}
      <div className="flex flex-wrap gap-6">
        {Array.from({ length: numHands }, (_, h) => (
          <div key={h} className="flex flex-col gap-1.5">
            <p className="text-xs text-muted font-medium">Hand {h + 1}</p>
            <div className="flex gap-1.5">
              {[0, 1].map(c => (
                <CardBtn key={c} card={getHand(h)[c]}
                  active={active.kind === 'hand' && active.h === h && active.c === c}
                  onClick={() => setActive({ kind: 'hand', h, c: c as 0 | 1 })} />
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted font-medium">Board (0/3/4/5)</p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <CardBtn key={i} card={boardR[i]}
                active={active.kind === 'board' && active.i === i}
                onClick={() => setActive({ kind: 'board', i })} />
            ))}
          </div>
        </div>
      </div>

      {/* Picker */}
      <div className="rounded-lg border border-white/10 p-3 bg-black/20">
        <CardPicker selected={currentCard() !== null ? [currentCard() as Card] : []} blocked={blocked} onToggle={handleToggle} maxSelect={1} />
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary disabled:opacity-40" onClick={compute} disabled={loading}>
          {loading ? 'Berechne…' : 'Equity berechnen'}
        </button>
        {error && <span className="text-xs text-loss">{error}</span>}
      </div>

      {/* Ergebnis */}
      {reports && (
        <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
          {reports.map((r, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-text w-16">Hand {i + 1}</span>
                <div className="flex gap-1">
                  {getHand(i).map((c, k) => c !== null && <span key={k} className={`font-mono text-sm ${cardColorClass(c)}`}>{cardLabel(c)}</span>)}
                </div>
                <span className="text-sm font-bold tabnum text-profit ml-auto">{(r.equity * 100).toFixed(1)} %</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${r.equity * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {r.draws.map(d => <span key={d} className="px-1.5 py-0.5 rounded bg-accent/15 text-accent">{d}</span>)}
                {r.topClasses.map(tc => (
                  <span key={tc.name} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-muted">
                    {tc.name} {(tc.pct * 100).toFixed(0)} %
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-600 mt-1">
            Equity = Anteil am Pot bei Showdown · Handklassen = Verteilung der finalen Hand über alle Runouts · modellabhängig.
          </p>
        </div>
      )}
    </div>
  )
}
