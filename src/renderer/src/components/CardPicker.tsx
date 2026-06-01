import type { Card } from '../lib/cards'
import { RANK_CHARS, cardRank, cardSuit, makeCard } from '../lib/cards'

// ─── Konstanten ───────────────────────────────────────────────────────────────

const SUIT_ORDER  = [3, 2, 1, 0] as const           // ♠ ♥ ♦ ♣ (oben nach unten)
const SUIT_SYMBOL = ['♣', '♦', '♥', '♠'] as const
const SUIT_RED    = [false, true, true, false]        // ♦ und ♥ in Rot

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

export function cardLabel(c: Card): string {
  return RANK_CHARS[cardRank(c)] + SUIT_SYMBOL[cardSuit(c)]
}

export function cardColorClass(c: Card): string {
  return SUIT_RED[cardSuit(c)] ? 'text-red-400' : 'text-slate-200'
}

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  /** Aktuell ausgewählte Karten (werden grün hervorgehoben). */
  selected: Card[]
  /** Von anderen Gruppen belegte Karten (ausgegraut, nicht wählbar). */
  blocked: Card[]
  onToggle: (c: Card) => void
  /** Maximale Anzahl wählbarer Karten (0 = unbegrenzt). */
  maxSelect?: number
}

export function CardPicker({ selected, blocked, onToggle, maxSelect = 0 }: Props): JSX.Element {
  const selSet     = new Set(selected)
  const blockedSet = new Set(blocked)

  return (
    <div className="select-none">
      {/* Rang-Header */}
      <div className="grid mb-0.5" style={{ gridTemplateColumns: 'auto repeat(13, 1fr)', gap: '2px' }}>
        <div className="w-4" />
        {[...RANK_CHARS].reverse().map(r => (
          <div key={r} className="text-center text-muted font-mono leading-none" style={{ fontSize: 9 }}>{r}</div>
        ))}
      </div>

      {/* 4 Reihen (je eine Farbe) × 13 Spalten (Ränge) */}
      {SUIT_ORDER.map(suit => (
        <div key={suit} className="grid mb-0.5" style={{ gridTemplateColumns: 'auto repeat(13, 1fr)', gap: '2px' }}>
          {/* Farb-Label */}
          <div className={`w-4 text-center leading-none font-mono ${SUIT_RED[suit] ? 'text-red-400' : 'text-slate-400'}`} style={{ fontSize: 10 }}>
            {SUIT_SYMBOL[suit]}
          </div>

          {/* 13 Karten */}
          {[...Array(13)].map((_, ri) => {
            const rank = 12 - ri          // A=12 links → 2=0 rechts
            const c    = makeCard(rank, suit)
            const isSel     = selSet.has(c)
            const isBlocked = blockedSet.has(c)
            const atMax     = maxSelect > 0 && selected.length >= maxSelect && !isSel
            const disabled  = isBlocked || atMax

            return (
              <button
                key={c}
                disabled={disabled}
                onClick={() => !disabled && onToggle(c)}
                className={[
                  'rounded-[2px] py-0.5 text-center leading-none transition-colors font-mono',
                  isSel     ? 'bg-accent ring-1 ring-white text-white'
                  : isBlocked ? 'bg-slate-900 cursor-not-allowed opacity-30'
                  : atMax     ? 'bg-slate-800 cursor-not-allowed opacity-40'
                  : 'bg-slate-800 hover:bg-slate-600 cursor-pointer',
                  !isSel && !isBlocked && !atMax ? (SUIT_RED[suit] ? 'text-red-400' : 'text-slate-200') : '',
                ].join(' ')}
                style={{ fontSize: 9 }}
                title={cardLabel(c)}
              >
                {RANK_CHARS[rank]}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
