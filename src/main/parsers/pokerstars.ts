import type { Tournament, TournamentSpeed } from '../../shared/types'
import { moneyAmounts, parseBuyInSegment, parseMoney, parseTimestamp } from './util'

// Bilingual PokerStars Tournament Summary parser (English + German /
// PokerStars.DE). The hero's result is found from the ranking list. In German
// summaries the hero is located via the "Du hast den N. Platz belegt" line or,
// when only hand histories reveal it, via a supplied hero name hint.

function detectSpeed(name: string): TournamentSpeed {
  const n = name.toLowerCase()
  if (n.includes('hyper')) return 'hyper'
  if (n.includes('turbo')) return 'turbo'
  if (n.includes('regular')) return 'regular'
  return 'unknown'
}

interface Ranking {
  place: number
  name: string
  payout: number
  stillPlaying: boolean
}

/** Parse a single ranking line: "  645: Name [3] (Country), $14,59 (0,05%)". */
function parseRankingLine(line: string): Ranking | null {
  const m = line.match(/^\s*(\d+):\s+(.*)$/)
  if (!m) return null
  const rest = m[2].replace(/\r$/, '').trim()
  if (!rest) return null
  // The country sits in the first parenthesis; the player name precedes it and
  // never contains a parenthesis. Anything after the country is the payout/pct.
  const open = rest.search(/\s*\(/)
  const name = (open >= 0 ? rest.slice(0, open) : rest)
    .replace(/\s*\[\d+\]\s*$/, '')
    .trim()
  if (!name) return null
  const afterCountry = open >= 0 ? rest.slice(rest.indexOf(')', open) + 1) : ''
  const stillPlaying = /spielt noch|still playing/i.test(afterCountry)
  const payout = stillPlaying ? 0 : (moneyAmounts(afterCountry)[0] ?? 0)
  return { place: parseInt(m[1], 10), name, payout, stillPlaying }
}

function collectRankings(block: string): Ranking[] {
  const out: Ranking[] = []
  for (const line of block.split('\n')) {
    const r = parseRankingLine(line)
    if (r) out.push(r)
  }
  return out
}

interface HeroResult {
  finishPlace: number
  payout: number
  entries: number
}

function findHeroResult(
  block: string,
  rankings: Ranking[],
  heroNameHint?: string
): HeroResult | null {
  let heroName = heroNameHint
  if (!heroName) {
    // German: "Du hast den N. Platz belegt" → look up that place's name.
    const de = block.match(/Du hast den (\d+)\. Platz belegt/)
    if (de) heroName = rankings.find((r) => r.place === parseInt(de[1], 10))?.name
    // English: "Dear Hero," salutation.
    if (!heroName) heroName = block.match(/Dear (\S+),/)?.[1]
  }
  if (!heroName) return null

  const lines = rankings.filter((r) => r.name === heroName && !r.stillPlaying)
  if (lines.length === 0) return null
  return {
    finishPlace: Math.min(...lines.map((r) => r.place)),
    payout: lines.reduce((a, r) => a + r.payout, 0),
    entries: lines.length
  }
}

function parseSummaryBlock(block: string, heroNameHint?: string): Tournament | null {
  const idMatch = block.match(/PokerStars (?:Tournament|Turnier) #(\d+),\s*(.*)/)
  if (!idMatch) return null
  const tournamentId = idMatch[1]
  const gameType = (idMatch[2] || '').replace(/\s+(USD|EUR|GBP)\b/i, '').trim() || 'Unknown'

  let buyIn = 0
  let fee = 0
  let currency = 'USD'
  const buyInLine = block.match(/Buy-?in:\s*(.+)/i)
  if (buyInLine) {
    const parsed = parseBuyInSegment(buyInLine[1])
    buyIn = parsed.buyIn
    fee = parsed.fee
    currency = parsed.currency
  }

  const fieldMatch = block.match(/^\s*([\d.,]+)\s+(?:players|Spieler)\b/m)
  const fieldSize = fieldMatch ? Math.round(parseMoney(fieldMatch[1])) : null

  const startLine = block.match(/(?:Turnierbeginn|Tournament started)\s+(.+)/)
  const startDate = startLine ? parseTimestamp(startLine[1]) : new Date(0).toISOString()

  const rankings = collectRankings(block)
  const hero = findHeroResult(block, rankings, heroNameHint)

  const entries = hero?.entries ?? 1
  const totalCost = (buyIn + fee) * entries

  return {
    id: `pokerstars:${tournamentId}`,
    source: 'pokerstars',
    tournamentId,
    name: gameType !== 'Unknown' ? `#${tournamentId} ${gameType}` : `#${tournamentId}`,
    gameType,
    speed: detectSpeed(gameType),
    currency,
    buyIn,
    fee,
    totalCost,
    startDate,
    fieldSize,
    finishPlace: hero?.finishPlace ?? null,
    payout: hero?.payout ?? 0,
    bounty: 0,
    reEntries: hero ? hero.entries - 1 : 0,
    rebuys: 0,
    addons: 0,
    profit: (hero?.payout ?? 0) - totalCost,
    resultKnown: hero != null
  }
}

/**
 * Parse the text of one or more PokerStars tournament summaries.
 * @param heroNameHint hero screen name (e.g. learned from hand histories) used
 *   to locate the hero in the ranking list when the summary has no explicit
 *   "Du hast den N. Platz belegt" line.
 */
export function parsePokerStarsSummaries(content: string, heroNameHint?: string): Tournament[] {
  const text = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const headerRe = /PokerStars (?:Tournament|Turnier) #/g
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = headerRe.exec(text)) !== null) indices.push(m.index)
  if (indices.length === 0) return []

  const out: Tournament[] = []
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : text.length
    const t = parseSummaryBlock(text.slice(start, end), heroNameHint)
    if (t) out.push(t)
  }
  return out
}
