import type { HandId } from '../data/pushFoldData'
import type { NashResult } from '../lib/nashSolver'

// ─── Typen ────────────────────────────────────────────────────────────────────

interface PlayerSpot {
  label: string        // Position name (BTN, SB, BB, …)
  stack: number        // Chips
  bbSize: number
  isHero: boolean
  hand?: HandId | null
  evPush?: number | null   // Nash EV (hero only, for badge)
}

interface Props {
  players: number
  heroPosition: string
  heroHand: HandId | null
  stacks: number[]
  bbSize: number
  nashResult?: NashResult | null
}

// ─── Clockwise seating order ──────────────────────────────────────────────────

const SEAT_ORDER: Record<number, string[]> = {
  2: ['SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG+1', 'UTG', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO', 'MP'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'MP'],
}

function getPositionLabels(heroPos: string, n: number): string[] {
  const order = SEAT_ORDER[n] ?? SEAT_ORDER[9]
  const idx = order.findIndex(p => p === heroPos)
  if (idx < 0) return [heroPos, ...order.filter(p => p !== heroPos).slice(0, n - 1)]
  return [...order.slice(idx), ...order.slice(0, idx)].slice(0, n)
}

// ─── Ellipse-Koordinaten (clockwise from bottom) ──────────────────────────────

function playerCoord(i: number, n: number): { left: string; top: string } {
  // π/2 = bottom; subtract angle for clockwise on screen (Y-down)
  const angle = Math.PI / 2 - (2 * Math.PI * i) / n
  const rx = 41   // % of container width
  const ry = 34   // % of container height
  const x = 50 + rx * Math.cos(angle)
  const y = 50 + ry * Math.sin(angle)
  return { left: `${x.toFixed(1)}%`, top: `${y.toFixed(1)}%` }
}

// ─── Karten-Anzeige ───────────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_RED = new Set(['h', 'd'])

function parseHandCards(id: HandId): Array<{ rank: string; suit: string; red: boolean }> {
  const isPair   = id.length === 2
  const isSuited = id.endsWith('s')
  const r1 = id[0], r2 = isPair ? id[0] : id[1]
  if (isPair)    return [{ rank: r1, suit: '♠', red: false }, { rank: r2, suit: '♥', red: true }]
  if (isSuited)  return [{ rank: r1, suit: '♠', red: false }, { rank: r2, suit: '♠', red: false }]
  return [{ rank: r1, suit: '♠', red: false }, { rank: r2, suit: '♥', red: true }]
}

function FaceDownCard(): JSX.Element {
  return (
    <div
      className="w-6 h-8 rounded-[3px] border border-white/20 shrink-0"
      style={{
        background: 'repeating-linear-gradient(135deg,#1e3a5f 0px,#1e3a5f 3px,#162b45 3px,#162b45 6px)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
      }}
    />
  )
}

function FaceUpCard({ rank, suit, red }: { rank: string; suit: string; red: boolean }): JSX.Element {
  return (
    <div
      className="w-6 h-8 rounded-[3px] bg-white flex flex-col items-center justify-center shrink-0"
      style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
    >
      <span className="text-[9px] font-bold leading-none" style={{ color: red ? '#dc2626' : '#0f172a' }}>
        {rank}
      </span>
      <span className="text-[8px] leading-none" style={{ color: red ? '#dc2626' : '#0f172a' }}>
        {suit}
      </span>
    </div>
  )
}

// ─── Spieler-Chip ─────────────────────────────────────────────────────────────

function PlayerChip({ spot }: { spot: PlayerSpot }): JSX.Element {
  const stackBb = spot.bbSize > 0 ? spot.stack / spot.bbSize : 0
  const isNashPush = spot.evPush !== null && spot.evPush !== undefined && spot.evPush > 0
  const hasNash    = spot.evPush !== null && spot.evPush !== undefined
  const cards = spot.hand ? parseHandCards(spot.hand) : null

  return (
    <div
      className={[
        'flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl transition-all',
        spot.isHero
          ? 'bg-neutral-800/90 border border-accent/50 ring-1 ring-accent/20 shadow-lg shadow-accent/10'
          : 'bg-neutral-900/80 border border-white/10',
      ].join(' ')}
      style={{ minWidth: 64 }}
    >
      {/* Position badge */}
      <div className={[
        'text-[9px] font-bold tracking-wider uppercase leading-none px-1.5 py-0.5 rounded-full',
        spot.isHero ? 'bg-accent/20 text-accent' : 'bg-white/8 text-neutral-400',
      ].join(' ')}>
        {spot.label}
      </div>

      {/* Cards */}
      <div className="flex gap-0.5">
        {spot.isHero && cards ? (
          cards.map((c, i) => <FaceUpCard key={i} rank={c.rank} suit={c.suit} red={c.red} />)
        ) : (
          [0, 1].map(i => <FaceDownCard key={i} />)
        )}
      </div>

      {/* Stack */}
      <div className="text-[10px] tabnum font-semibold text-neutral-300 leading-none">
        {stackBb.toFixed(1)} <span className="text-neutral-500 font-normal">BB</span>
      </div>

      {/* Nash-Badge (nur für Hero) */}
      {spot.isHero && hasNash && (
        <div className={[
          'text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full leading-none',
          isNashPush
            ? 'bg-[#3ddc97]/15 text-[#3ddc97] border border-[#3ddc97]/30'
            : 'bg-[#f0686d]/15 text-[#f0686d] border border-[#f0686d]/30',
        ].join(' ')}>
          {isNashPush ? 'Push' : 'Fold'}
        </div>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function PokerTable({ players, heroPosition, heroHand, stacks, bbSize, nashResult }: Props): JSX.Element {
  const labels = getPositionLabels(heroPosition, players)

  const heroNashEv = nashResult && heroHand
    ? (nashResult.pushRange.get(heroHand)?.ev ?? null)
    : null

  const spots: PlayerSpot[] = labels.map((label, i) => ({
    label,
    stack:  stacks[i] ?? (stacks[0] ?? bbSize * 10),
    bbSize,
    isHero: i === 0,
    hand:   i === 0 ? heroHand : null,
    evPush: i === 0 ? heroNashEv : null,
  }))

  return (
    // paddingTop: 54% → aspect ratio ≈ 1.85:1 (standard poker oval)
    <div className="relative w-full" style={{ paddingTop: '54%' }}>

      {/* ── Felt & Tisch ─────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 rounded-[50%] overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 55%, #1e6b35 0%, #154d25 55%, #0e3419 100%)',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5), inset 0 0 0 4px rgba(255,255,255,0.04)',
        }}
      >
        {/* Deck-Glow */}
        <div className="absolute inset-[2px] rounded-[50%]"
          style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.3)' }} />

        {/* Rail (Holzrand) */}
        <div
          className="absolute inset-[-1px] rounded-[50%] -z-10"
          style={{
            background: 'linear-gradient(135deg,#5a3a0a 0%,#a06820 30%,#c28830 50%,#a06820 70%,#5a3a0a 100%)',
            padding: 4,
          }}
        />

        {/* Center-Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white/[0.06] text-sm font-bold tracking-[0.3em] uppercase select-none">
            Proker
          </span>
        </div>
      </div>

      {/* ── Rail Outer ────────────────────────────────────────────────────── */}
      <div
        className="absolute rounded-[50%]"
        style={{
          inset: '-5px',
          background: 'linear-gradient(135deg,#5a3a0a 0%,#c28830 40%,#5a3a0a 100%)',
          zIndex: -1,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      />

      {/* ── Spieler-Chips ─────────────────────────────────────────────────── */}
      {spots.map((spot, i) => {
        const { left, top } = playerCoord(i, players)
        return (
          <div
            key={i}
            className="absolute z-10"
            style={{ left, top, transform: 'translate(-50%, -50%)' }}
          >
            <PlayerChip spot={spot} />
          </div>
        )
      })}
    </div>
  )
}
