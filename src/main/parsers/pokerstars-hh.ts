import type { HandStatsAgg, Tournament, TournamentSpeed } from '../../shared/types'
import { parseBuyInSegment, parseTimestamp } from './util'

// Bilingual PokerStars Hand History parser (English + German / PokerStars.DE).
// Hand histories give the buy-in (header) and the hero's actions (play-style
// stats); the hero's finish place is also present when they bust. Payout is not
// in hand histories and is merged in from the tournament summary.

type Verb = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'post'

export interface HandResult {
  handId: string
  tournamentId: string
  hero: string
  startDate: string
  gameType: string
  currency: string
  buyIn: number
  fee: number
  finishPlace: number | null
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
  return /PokerStars (?:Hand|Game) (?:#|Nr\. )\d+/.test(content)
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Classify an action line into a normalized verb (DE + EN), or null. */
function classifyVerb(line: string): Verb | null {
  if (/setzt (?:Small Blind|Big Blind|Ante)/i.test(line) || /\bposts\b/i.test(line)) return 'post'
  if (/\berhöht\b/i.test(line) || /\braises\b/i.test(line)) return 'raise'
  if (/\bgeht mit\b/i.test(line) || /\bcalls\b/i.test(line)) return 'call'
  if (/\bbets\b/i.test(line)) return 'bet'
  if (/\bsetzt\b/i.test(line) && !/setzt aus/i.test(line)) return 'bet'
  if (/\bcheckt\b/i.test(line) || /\bchecks\b/i.test(line)) return 'check'
  if (/\bpasst\b/i.test(line) || /\bfolds\b/i.test(line)) return 'fold'
  return null
}

function makeIsHero(hero: string): (line: string) => boolean {
  const colon = new RegExp(`^\\s*${esc(hero)}\\s*:`)
  const space = new RegExp(`^\\s*${esc(hero)}\\s`)
  return (line: string) => colon.test(line) || space.test(line)
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

/** Index of the first of the given (case-sensitive) markers, or -1. */
function findMarker(block: string, ...markers: string[]): number {
  for (const m of markers) {
    const i = block.indexOf(m)
    if (i >= 0) return i
  }
  return -1
}

function parseHand(block: string): HandResult | null {
  const header = block.match(
    /PokerStars (?:Hand|Game) (?:#|Nr\. )(\d+):?\s+(?:Tournament|Turnier) #(\d+),\s*(.+?)\s+-\s+Level/
  )
  if (!header) return null
  const handId = header[1]
  const tournamentId = header[2]

  // Middle chunk: "<buy-in> <CUR> <game type>" or "Freeroll <game type>".
  const mid = header[3].trim()
  const buyInM = mid.match(/^(Freeroll|(?:[$€£₹][\d.,]+(?:\+[$€£₹][\d.,]+)*)\s*[A-Z]{0,3})/)
  const buyInSeg = buyInM ? buyInM[0] : ''
  const gameType = mid.slice(buyInSeg.length).trim() || 'Unknown'
  const { buyIn, fee, currency } = parseBuyInSegment(buyInSeg)
  const startDate = parseTimestamp(block.slice(0, block.indexOf('\n') + 1 || 400))

  // Hero: English "Dealt to X [", German "X  bekommt: ["
  const heroMatch =
    block.match(/Dealt to (\S+) \[/) || block.match(/^([^\n]+?)\s+bekommt:\s*\[/m)
  if (!heroMatch) return null
  const hero = heroMatch[1].trim()
  const isHero = makeIsHero(hero)

  // Section boundaries (markers are the same English words in DE files, except
  // SHOWDOWN/SHOW DOWN and SUMMARY/ZUSAMMENFASSUNG).
  const iHole = findMarker(block, 'HOLE CARDS')
  const iFlop = findMarker(block, 'FLOP')
  const iTurn = findMarker(block, 'TURN')
  const iRiver = findMarker(block, 'RIVER')
  const iShow = findMarker(block, 'SHOWDOWN', 'SHOW DOWN')
  const iSummary = findMarker(block, 'ZUSAMMENFASSUNG', 'SUMMARY')

  const preflop = section(block, iHole, [iFlop, iShow, iSummary])
  const flop = section(block, iFlop, [iTurn, iShow, iSummary])
  const turn = section(block, iTurn, [iRiver, iShow, iSummary])
  const river = section(block, iRiver, [iShow, iSummary])
  const showdown = section(block, iShow, [iSummary])
  const summary = iSummary >= 0 ? block.slice(iSummary) : ''
  const postflop = flop + turn + river

  // --- Preflop: VPIP / PFR / 3-bet ---
  let vpip = 0
  let pfr = 0
  let threeBetOpp = 0
  let threeBet = 0
  let raisesSeen = 0
  let heroProcessed = false
  let heroFoldedPreflop = false
  // raisesSeen wird am Ende jeder Iteration inkrementiert. Da Hero-Verarbeitung
  // nur bei heroLine=true erfolgt und raisesSeen++ danach kommt, ist bei Heros
  // eigener Raise-Zeile raisesSeen noch der Wert VOR Heros Raise — korrekt.
  for (const line of preflop.split('\n')) {
    const verb = classifyVerb(line)
    if (!verb) continue
    const heroLine = isHero(line)
    if (heroLine && !heroProcessed && verb !== 'post') {
      if (raisesSeen >= 1) threeBetOpp = 1
      if (verb === 'call' || verb === 'bet' || verb === 'raise') vpip = 1
      if (verb === 'raise') {
        pfr = 1
        if (raisesSeen >= 1) threeBet = 1
      }
      if (verb === 'fold') heroFoldedPreflop = true
      heroProcessed = true
    }
    if (verb === 'raise') raisesSeen++
  }

  const sawFlop = iFlop >= 0 && !heroFoldedPreflop ? 1 : 0

  // --- Postflop aggression ---
  let aggActions = 0
  let callActions = 0
  for (const line of postflop.split('\n')) {
    if (!isHero(line)) continue
    const verb = classifyVerb(line)
    if (verb === 'bet' || verb === 'raise') aggActions++
    else if (verb === 'call') callActions++
  }

  // --- Showdown / wins ---
  const showRe = new RegExp(`^\\s*${esc(hero)}\\s*:?\\s*(?:zeigt|shows|mucks)\\b`, 'm')
  const wtsd = iShow >= 0 && showRe.test(showdown) ? 1 : 0
  const wonHand =
    new RegExp(`(?:^|\\n)\\s*${esc(hero)}\\s+(?:gewinnt|collected)\\b`).test(block) ||
    new RegExp(`${esc(hero)}\\b[^\\n]*\\b(?:won|gewinnt) \\(`).test(summary)
      ? 1
      : 0
  const wonSd = wtsd && wonHand ? 1 : 0

  // --- Finish place (hero busts): DE "X beendet das Turnier auf Platz N",
  //     EN "finished the tournament in Nth place" ---
  let finishPlace: number | null = null
  const placeDe = block.match(new RegExp(`${esc(hero)} beendet das Turnier auf Platz (\\d+)`))
  const placeEn = block.match(/finished (?:the tournament )?in (\d+)(?:st|nd|rd|th) place/i)
  if (placeDe) finishPlace = parseInt(placeDe[1], 10)
  else if (placeEn) finishPlace = parseInt(placeEn[1], 10)

  return {
    handId,
    tournamentId,
    hero,
    startDate,
    gameType,
    currency,
    buyIn,
    fee,
    finishPlace,
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
  const text = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const headerRe = /PokerStars (?:Hand|Game) (?:#|Nr\. )\d+/g
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

/** The hero name that appears most often across parsed hands. */
export function dominantHero(hands: HandResult[]): string | null {
  const counts = new Map<string, number>()
  for (const h of hands) counts.set(h.hero, (counts.get(h.hero) ?? 0) + 1)
  let best: string | null = null
  let bestN = 0
  for (const [hero, n] of counts) {
    if (n > bestN) {
      best = hero
      bestN = n
    }
  }
  return best
}

/**
 * Aggregate per-hand results into per-tournament Tournament records carrying
 * hero play stats. Hands are de-duplicated by hand id. Payout is unknown here
 * (resultKnown = false) and gets merged in from summaries.
 */
export function aggregateHands(allHands: HandResult[]): Tournament[] {
  const uniq = new Map<string, HandResult>()
  for (const h of allHands) if (!uniq.has(h.handId)) uniq.set(h.handId, h)

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
    const finishPlace = list.map((h) => h.finishPlace).find((p) => p != null) ?? null
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
      finishPlace,
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
