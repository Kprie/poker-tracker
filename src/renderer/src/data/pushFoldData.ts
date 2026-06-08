export type HandId = string
export type Position = 'BTN' | 'CO' | 'HJ' | 'UTG+1' | 'UTG' | 'SB' | 'BB'
export type ActionType = 'push' | 'call' | 'overcall'

export interface HandEntry {
  /** EV-Differenz zur Fold-Line in BB. Positiv = Aktion besser als Fold. */
  ev: number | null
  /** Nash-Frequenz in % für Mixed Strategies. null = Pure Strategy. */
  freq: number | null
}

export interface PushFoldSpot {
  players: number
  position: Position
  stackBb: number
  action: ActionType
  hands: Record<HandId, HandEntry | null>
}

// ─── Kanonische Hand-IDs ─────────────────────────────────────────────────────

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

/** Kanonische Hand-ID aus 13×13-Grid-Koordinaten (0 = A … 12 = 2). */
export function getHandId(row: number, col: number): HandId {
  if (row === col) return RANKS[row] + RANKS[row]
  if (row < col) return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

export const ALL_HAND_IDS: HandId[] = (() => {
  const ids: HandId[] = []
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      if (i === j) ids.push(RANKS[i] + RANKS[i])
      else if (i < j) ids.push(RANKS[i] + RANKS[j] + 's')
      else ids.push(RANKS[j] + RANKS[i] + 'o')
    }
  }
  return ids
})()

// ─── Handstärke-Modell ───────────────────────────────────────────────────────
// Gibt 0–1 zurück. Höchster Wert: AA = 1.0. Niedrigster: 32o ≈ 0.12.

export function handStrength(id: HandId): number {
  const isPair = id.length === 2
  const hi = RANKS.indexOf(id[0] as typeof RANKS[number])
  const lo = isPair ? hi : RANKS.indexOf(id[1] as typeof RANKS[number])
  const isSuited = id.endsWith('s')

  const hv = (12 - hi) / 12  // A=1.0, 2=0.0
  const lv = (12 - lo) / 12

  if (isPair) {
    return 0.60 + hv * 0.40   // 22=0.60, AA=1.00
  }

  const gap = lo - hi
  const connBonus = Math.max(0, (4 - gap) / 4) * 0.04

  if (isSuited) {
    return Math.min(0.99, hv * 0.52 + lv * 0.28 + 0.07 + connBonus)
  }
  return Math.min(0.99, hv * 0.57 + lv * 0.25 + connBonus)
}

// ─── Nash-Thresholds ──────────────────────────────────────────────────────────
// Stärke-Schwellenwert (0–1), ab dem eine Hand profitabel ist.
// Kalibriert gegen bekannte ICM Nash-Equilibrium-Daten.
// Je größer der Stack, desto höher der Threshold (engere Range).

function nashThreshold(players: number, position: Position, stackBb: number, action: ActionType): number | null {

  // ── 2-Handed ────────────────────────────────────────────────────────────────
  if (players === 2) {
    if (position === 'SB' && action === 'push') {
      // HU SB push: 3BB≈84%, 5BB≈66%, 7BB≈53%, 10BB≈42%, 15BB≈28%, 20BB≈20%
      if (stackBb <= 3)  return 0.22
      if (stackBb <= 5)  return 0.38
      if (stackBb <= 7)  return 0.48
      if (stackBb <= 10) return 0.56
      if (stackBb <= 15) return 0.66
      return 0.73
    }
    if (position === 'BB' && action === 'call') {
      // HU BB call vs SB push: 5BB≈67%, 7BB≈55%, 10BB≈44%, 15BB≈33%
      if (stackBb <= 5)  return 0.35
      if (stackBb <= 7)  return 0.46
      if (stackBb <= 10) return 0.55
      return 0.63
    }
  }

  // ── 3-Handed ────────────────────────────────────────────────────────────────
  if (players === 3) {
    if (position === 'BTN' && action === 'push') {
      // 3-handed BTN: 5BB≈68%, 8BB≈50%, 12BB≈36%
      if (stackBb <= 5)  return 0.35
      if (stackBb <= 8)  return 0.50
      return 0.62
    }
    if (position === 'SB' && action === 'push') {
      // 3-handed SB: 5BB≈60%, 7BB≈46%, 10BB≈36%, 15BB≈24%
      if (stackBb <= 5)  return 0.41
      if (stackBb <= 7)  return 0.53
      if (stackBb <= 10) return 0.62
      return 0.72
    }
    if (position === 'BB' && action === 'call') {
      // 3-handed BB call vs BTN push: 7BB≈38%, 10BB≈30%
      if (stackBb <= 7)  return 0.62
      return 0.68
    }
    if (position === 'BB' && action === 'call') {
      // 3-handed BB call vs SB push (slightly tighter)
      if (stackBb <= 7)  return 0.64
      return 0.70
    }
  }

  // ── 4-Handed ────────────────────────────────────────────────────────────────
  if (players === 4) {
    if (position === 'BTN' && action === 'push') {
      // 4-handed BTN: 5BB≈64%, 8BB≈49%, 12BB≈36%
      if (stackBb <= 5)  return 0.38
      if (stackBb <= 8)  return 0.51
      return 0.63
    }
    if (position === 'CO' && action === 'push') {
      // 4-handed CO (UTG): 5BB≈57%, 8BB≈43%, 12BB≈32%
      if (stackBb <= 5)  return 0.44
      if (stackBb <= 8)  return 0.55
      return 0.67
    }
    if (position === 'SB' && action === 'push') {
      // 4-handed SB: 5BB≈50%, 8BB≈37%, 12BB≈27%
      if (stackBb <= 5)  return 0.50
      if (stackBb <= 8)  return 0.61
      return 0.71
    }
    if (position === 'BB' && action === 'call') {
      if (stackBb <= 7)  return 0.62
      return 0.68
    }
  }

  // ── 5-Handed ────────────────────────────────────────────────────────────────
  if (players === 5) {
    if (position === 'BTN' && action === 'push') {
      if (stackBb <= 5)  return 0.40
      if (stackBb <= 8)  return 0.53
      return 0.65
    }
    if (position === 'CO' && action === 'push') {
      if (stackBb <= 5)  return 0.46
      if (stackBb <= 8)  return 0.57
      return 0.69
    }
    if (position === 'HJ' && action === 'push') {
      // HJ = UTG in 5-handed
      if (stackBb <= 5)  return 0.52
      if (stackBb <= 8)  return 0.63
      return 0.73
    }
    if (position === 'SB' && action === 'push') {
      if (stackBb <= 5)  return 0.54
      if (stackBb <= 8)  return 0.65
      return 0.74
    }
    if (position === 'BB' && action === 'call') {
      if (stackBb <= 7)  return 0.64
      return 0.70
    }
  }

  // ── 6-Handed ────────────────────────────────────────────────────────────────
  if (players === 6) {
    if (position === 'BTN' && action === 'push') {
      // 6-max BTN: 5BB≈60%, 8BB≈45%, 12BB≈33%
      if (stackBb <= 5)  return 0.41
      if (stackBb <= 8)  return 0.54
      return 0.66
    }
    if (position === 'CO' && action === 'push') {
      if (stackBb <= 5)  return 0.47
      if (stackBb <= 8)  return 0.58
      return 0.70
    }
    if (position === 'HJ' && action === 'push') {
      if (stackBb <= 5)  return 0.53
      if (stackBb <= 8)  return 0.63
      return 0.73
    }
    if (position === 'UTG' && action === 'push') {
      // UTG 6-max: 5BB≈42%, 8BB≈31%, 12BB≈22%
      if (stackBb <= 5)  return 0.57
      if (stackBb <= 8)  return 0.67
      return 0.76
    }
    if (position === 'SB' && action === 'push') {
      if (stackBb <= 5)  return 0.61
      if (stackBb <= 8)  return 0.70
      return 0.78
    }
    if (position === 'BB' && action === 'call') {
      if (stackBb <= 7)  return 0.65
      return 0.71
    }
  }

  return null
}

// ─── EV & Frequenz aus Stärke ────────────────────────────────────────────────

function computeEv(strength: number, threshold: number, stackBb: number): number {
  const margin = strength - threshold
  const scale = stackBb * 0.38
  return Math.max(-3.0, Math.min(5.0, margin * scale))
}

function computeFreq(ev: number): number | null {
  if (Math.abs(ev) >= 0.30) return null
  const freq = Math.round(50 + ev * (50 / 0.30))
  return Math.max(5, Math.min(95, freq))
}

// ─── Spot-Generator ──────────────────────────────────────────────────────────

function buildSpot(players: number, position: Position, stackBb: number, action: ActionType): PushFoldSpot {
  const threshold = nashThreshold(players, position, stackBb, action)
  const hands: Record<HandId, HandEntry | null> = {}

  for (const id of ALL_HAND_IDS) {
    if (threshold === null) {
      hands[id] = null
    } else {
      const s = handStrength(id)
      const ev = computeEv(s, threshold, stackBb)
      hands[id] = { ev, freq: computeFreq(ev) }
    }
  }

  return { players, position, stackBb, action, hands }
}

// ─── Spot-Datenbank ──────────────────────────────────────────────────────────

const BB_DEPTHS_STANDARD = [3, 5, 7, 8, 10, 12, 15, 20] as const
const BB_DEPTHS_SHORT     = [5, 8, 12] as const
const BB_DEPTHS_CALL      = [5, 7, 10, 15] as const

export const PUSH_FOLD_SPOTS: PushFoldSpot[] = [
  // ── 2-Handed ──────────────────────────────────────────────────────────────
  ...BB_DEPTHS_STANDARD.map(bb => buildSpot(2, 'SB', bb, 'push')),
  ...BB_DEPTHS_CALL.map(bb => buildSpot(2, 'BB', bb, 'call')),

  // ── 3-Handed ──────────────────────────────────────────────────────────────
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(3, 'BTN', bb, 'push')),
  buildSpot(3, 'BTN', 10, 'push'),
  buildSpot(3, 'BTN', 15, 'push'),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(3, 'SB', bb, 'push')),
  buildSpot(3, 'SB', 7, 'push'),
  buildSpot(3, 'SB', 10, 'push'),
  buildSpot(3, 'SB', 15, 'push'),
  buildSpot(3, 'BB', 7, 'call'),
  buildSpot(3, 'BB', 10, 'call'),

  // ── 4-Handed ──────────────────────────────────────────────────────────────
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(4, 'BTN', bb, 'push')),
  buildSpot(4, 'BTN', 10, 'push'),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(4, 'CO', bb, 'push')),
  buildSpot(4, 'CO', 10, 'push'),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(4, 'SB', bb, 'push')),
  buildSpot(4, 'BB', 7, 'call'),
  buildSpot(4, 'BB', 10, 'call'),

  // ── 5-Handed ──────────────────────────────────────────────────────────────
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(5, 'BTN', bb, 'push')),
  buildSpot(5, 'BTN', 10, 'push'),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(5, 'CO', bb, 'push')),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(5, 'HJ', bb, 'push')),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(5, 'SB', bb, 'push')),
  buildSpot(5, 'BB', 7, 'call'),
  buildSpot(5, 'BB', 10, 'call'),

  // ── 6-Handed ──────────────────────────────────────────────────────────────
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(6, 'BTN', bb, 'push')),
  buildSpot(6, 'BTN', 10, 'push'),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(6, 'CO', bb, 'push')),
  buildSpot(6, 'CO', 10, 'push'),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(6, 'HJ', bb, 'push')),
  buildSpot(6, 'HJ', 10, 'push'),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(6, 'UTG', bb, 'push')),
  buildSpot(6, 'UTG', 10, 'push'),
  ...BB_DEPTHS_SHORT.map(bb => buildSpot(6, 'SB', bb, 'push')),
  buildSpot(6, 'BB', 7, 'call'),
  buildSpot(6, 'BB', 10, 'call'),
]

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function findSpot(
  players: number,
  position: Position,
  stackBb: number,
  action: ActionType,
): { spot: PushFoldSpot; exact: boolean } | null {
  const candidates = PUSH_FOLD_SPOTS.filter(
    s => s.players === players && s.position === position && s.action === action,
  )
  if (candidates.length === 0) return null

  const exact = candidates.find(s => s.stackBb === stackBb)
  if (exact) return { spot: exact, exact: true }

  const nearest = candidates.reduce((best, s) =>
    Math.abs(s.stackBb - stackBb) < Math.abs(best.stackBb - stackBb) ? s : best,
  )
  return { spot: nearest, exact: false }
}

// ─── Verfügbare Positionen pro Spieleranzahl ──────────────────────────────────

export function availablePositions(players: number): Position[] {
  if (players === 2) return ['SB', 'BB']
  if (players === 3) return ['BTN', 'SB', 'BB']
  if (players <= 6)  return ['BTN', 'CO', 'HJ', 'UTG', 'SB', 'BB']
  return ['BTN', 'CO', 'HJ', 'UTG+1', 'UTG', 'SB', 'BB']
}
