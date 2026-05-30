import type { HandStatsAgg, Tournament, TournamentSpeed } from '../../shared/types'

// PokerStars Hand History parser. These files contain every hand the hero
// played, grouped per tournament. They give the buy-in (from the header) and
// the hero's actions (for play-style stats), but NOT payout / finish place —
// those live in the tournament summary and are merged in by tournament id.
//
// Two header variants are supported:
//   PokerStars Hand #<id> Tournament #<tid>, $1.84+$0.16 USD Hold'em No Limit ...
//   PokerStars Game #<id>: Tournament #<tid>, Freeroll Hold'em No Limit ...
// and two timestamp formats (YYYYMMDD HHMMSS and YYYY/MM/DD HH:MM:SS).

const VOLUNTARY = new Set(['calls', 'bets', 'raises'])

export interface HandResult {
  handId: string
  tournamentId: string
  hero: string
  startDate: string
  gameType: string
  currency: string
  buyIn: number
  fee: number
  // per-hand flags (0/1)
  vpip: number
  pfr: number
  threeBetOpp: number
  threeBet: number
  sawFlop: number
  wtsd: number
  wonSd: number
  wonHand: number
  aggActions: number
  callActions: number
}

export function isPokerStarsHandHistory(content: string): boolean {
  return /PokerStars (?:Hand|Game) #\d+/.test(content)
}

function num(s: string | undefined | null): number {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '')) || 0
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseBuyIn(seg: string): { buyIn: number; fee: number; currency: string } {
  if (/freeroll/i.test(seg)) return { buyIn: 0, fee: 0, currency: 'USD' }
  const parts = [...seg.matchAll(/[$€£₹]\s*([\d,]+(?:\.\d+)?)/g)].map((m) => num(m[1]))
  const currency = seg.includes('€') ? 'EUR' : seg.includes('£') ? 'GBP' : 'USD'
  if (parts.length === 0) return { buyIn: 0, fee: 0, currency }
  if (parts.length === 1) return { buyIn: parts[0], fee: 0, currency }
  return { buyIn: parts.slice(0, -1).reduce((a, b) => a + b, 0), fee: parts[parts.length - 1], currency }
}

function parseDate(header: string): string {
  const bracket = header.match(/\[([^\]]+?)\s*ET\]/) || header.match(/\[([^\]]+)\]/)
  const src = bracket ? bracket[1] : header
  const m = src.match(/(\d{4})[/-]?(\d{2})[/-]?(\d{2})\s+(\d{1,2}):?(\d{2}):?(\d{2})/)
  if (!m) return new Date(0).toISOString()
  const [, y, mo, d, h, mi, s] = m
  return `${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}:${s}`
}

/** Index of a street marker, or -1. Case-sensitive (markers are uppercase). */
function markerIndex(block: string, marker: string): number {
  return block.indexOf(marker)
}

function firstPositive(...idx: number[]): number {
  const valid = idx.filter((i) => i >= 0)
  return valid.length ? Math.min(...valid) : -1
}

function section(block: string, start: number, ends: number[]): string {
  if (start < 0) return ''
  const end = firstPositive(...ends)
  return block.slice(start, end >= 0 ? end : block.length)
}

function parseHand(block: string): HandResult | null {
  const header = block.match(/PokerStars (?:Hand|Game) #(\d+):?\s+Tournament #(\d+),\s*(.+?)\s+-\s+Level/)
  if (!header) return null
  const handId = header[1]
  const tournamentId = header[2]
  // Middle chunk is "<buy-in> <CUR> <game type>" or "Freeroll <game type>".
  const mid = header[3].trim()
  const buyInM = mid.match(/^(Freeroll|(?:[$€£₹][\d.,]+(?:\+[$€£₹][\d.,]+)*)\s*[A-Z]{0,3})/)
  const buyInSeg = buyInM ? buyInM[0] : ''
  const gameType = mid.slice(buyInSeg.length).trim() || 'Unknown'
  const { buyIn, fee, currency } = parseBuyIn(buyInSeg)
  const startDate = parseDate(block.slice(0, block.indexOf('\n') >= 0 ? block.indexOf('\n') + 200 : 400))

  const heroMatch = block.match(/Dealt to (\S+) \[/)
  if (!heroMatch) return null // cannot compute hero stats without hole-card line
  const hero = heroMatch[1]

  // Section boundaries.
  const iHole = markerIndex(block, 'HOLE CARDS')
  const iFlop = markerIndex(block, 'FLOP')
  const iTurn = markerIndex(block, 'TURN')
  const iRiver = markerIndex(block, 'RIVER')
  const iShow = markerIndex(block, 'SHOW DOWN')
  const iSummary = markerIndex(block, 'SUMMARY')

  const preflop = section(block, iHole, [iFlop, iShow, iSummary])
  const flop = section(block, iFlop, [iTurn, iShow, iSummary])
  const turn = section(block, iTurn, [iRiver, iShow, iSummary])
  const river = section(block, iRiver, [iShow, iSummary])
  const showdown = section(block, iShow, [iSummary])
  const summary = iSummary >= 0 ? block.slice(iSummary) : ''
  const postflop = flop + turn + river

  // --- Preflop sequence: VPIP / PFR / 3-bet ---
  let vpip = 0
  let pfr = 0
  let threeBetOpp = 0
  let threeBet = 0
  let raisesSeen = 0
  let heroProcessed = false
  let heroFoldedPreflop = false
  for (const line of preflop.split('\n')) {
    const m = line.match(/^\s*([^\s:]+):?\s+(folds|checks|calls|bets|raises|posts)\b/)
    if (!m) continue
    const player = m[1]
    const verb = m[2]
    if (player === hero && !heroProcessed && verb !== 'posts') {
      if (raisesSeen >= 1) threeBetOpp = 1
      if (VOLUNTARY.has(verb)) vpip = 1
      if (verb === 'raises') {
        pfr = 1
        if (raisesSeen >= 1) threeBet = 1
      }
      if (verb === 'folds') heroFoldedPreflop = true
      heroProcessed = true
    }
    if (verb === 'raises') raisesSeen++
  }

  // --- Saw flop --- (hero reached the flop = there was a flop and hero didn't
  // fold preflop; covers all-in players who have no postflop action lines)
  const sawFlop = iFlop >= 0 && !heroFoldedPreflop ? 1 : 0

  // --- Postflop aggression ---
  let aggActions = 0
  let callActions = 0
  const heroActionRe = new RegExp(`^\\s*${esc(hero)}:?\\s+(bets|raises|calls)\\b`, 'gm')
  let am: RegExpExecArray | null
  while ((am = heroActionRe.exec(postflop)) !== null) {
    if (am[1] === 'calls') callActions++
    else aggActions++
  }

  // --- Showdown / wins ---
  const heroShowRe = new RegExp(`^\\s*${esc(hero)}:?\\s+(shows|mucks)\\b`, 'm')
  const wtsd =
    (iShow >= 0 && heroShowRe.test(showdown)) ||
    new RegExp(`${esc(hero)}\\b[^\\n]*\\bshowed\\b`).test(summary)
      ? 1
      : 0
  const heroCollected =
    new RegExp(`${esc(hero)}\\b[^\\n]*\\bcollected\\b`).test(block) ||
    new RegExp(`${esc(hero)}\\b[^\\n]*\\bwon \\(`).test(summary)
  const wonHand = heroCollected ? 1 : 0
  const wonSd = wtsd && wonHand ? 1 : 0

  return {
    handId,
    tournamentId,
    hero,
    startDate,
    gameType,
    currency,
    buyIn,
    fee,
    vpip,
    pfr,
    threeBetOpp,
    threeBet,
    sawFlop,
    wtsd,
    wonSd,
    wonHand,
    aggActions,
    callActions
  }
}

function detectSpeed(name: string): TournamentSpeed {
  const n = name.toLowerCase()
  if (n.includes('hyper')) return 'hyper'
  if (n.includes('turbo')) return 'turbo'
  return 'unknown'
}

/** Parse every hand in a hand-history file into per-hand results. */
export function parsePokerStarsHands(content: string): HandResult[] {
  const text = content.replace(/^﻿/, '')
  const headerRe = /PokerStars (?:Hand|Game) #\d+/g
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = headerRe.exec(text)) !== null) indices.push(m.index)
  if (indices.length === 0) return []

  const hands: HandResult[] = []
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : text.length
    const hand = parseHand(text.slice(start, end))
    if (hand) hands.push(hand)
  }
  return hands
}

/**
 * Aggregate per-hand results into per-tournament Tournament records carrying
 * hero play stats. Hands are de-duplicated by hand id so the same hand counted
 * across multiple files (or re-imports) is not double-counted. Payout/finish
 * are unknown here (resultKnown = false) and get merged in from summaries.
 */
export function aggregateHands(allHands: HandResult[]): Tournament[] {
  // De-duplicate by hand id.
  const uniq = new Map<string, HandResult>()
  for (const h of allHands) if (!uniq.has(h.handId)) uniq.set(h.handId, h)

  // Group by tournament.
  const byTid = new Map<string, HandResult[]>()
  for (const h of uniq.values()) {
    if (!byTid.has(h.tournamentId)) byTid.set(h.tournamentId, [])
    byTid.get(h.tournamentId)!.push(h)
  }

  const out: Tournament[] = []
  for (const [tid, list] of byTid) {
    const first = list[0]
    const agg: HandStatsAgg = {
      hero: first.hero,
      hands: list.length,
      vpip: sum(list, (h) => h.vpip),
      pfr: sum(list, (h) => h.pfr),
      threeBetOpp: sum(list, (h) => h.threeBetOpp),
      threeBet: sum(list, (h) => h.threeBet),
      sawFlop: sum(list, (h) => h.sawFlop),
      wtsd: sum(list, (h) => h.wtsd),
      wonSd: sum(list, (h) => h.wonSd),
      wonHand: sum(list, (h) => h.wonHand),
      aggActions: sum(list, (h) => h.aggActions),
      callActions: sum(list, (h) => h.callActions)
    }
    const startDate = list.map((h) => h.startDate).sort()[0]
    const totalCost = first.buyIn + first.fee
    out.push({
      id: `pokerstars:${tid}`,
      source: 'pokerstars',
      tournamentId: tid,
      name: `#${tid} ${first.gameType}`,
      gameType: first.gameType,
      speed: detectSpeed(first.gameType),
      currency: first.currency,
      buyIn: first.buyIn,
      fee: first.fee,
      totalCost,
      startDate,
      fieldSize: null,
      finishPlace: null,
      payout: 0,
      bounty: 0,
      reEntries: 0,
      rebuys: 0,
      addons: 0,
      profit: 0,
      resultKnown: false,
      handStats: agg
    })
  }
  return out
}

/** Convenience: parse + aggregate a single hand-history file. */
export function parsePokerStarsHandHistory(content: string): Tournament[] {
  return aggregateHands(parsePokerStarsHands(content))
}

function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((a, x) => a + f(x), 0)
}
