import type { Tournament, TournamentSpeed } from '../../shared/types'

// GGPoker / PokerCraft "Tournament Summary" export format. Confirmed against
// real samples: PokerCraft exports a ZIP containing one .txt per tournament,
// e.g.:
//
//   Tournament #271437255, Daily Hyper $1, Hold'em No Limit
//   Buy-in: $0.92+$0.08
//   1974 Players
//   Total Prize Pool: $1,816.08
//   Tournament started 2026/03/21 17:45:00
//   1262th : Hero, $0
//   You finished the tournament in 1262th place.
//   You received a total of $0.
//
// Payouts may be denominated in T$ (tournament dollars / tickets) instead of
// cash; we treat T$ 1:1 with the buy-in currency for profit tracking.

function detectSpeed(name: string): TournamentSpeed {
  const n = name.toLowerCase()
  if (n.includes('hyper')) return 'hyper'
  if (n.includes('turbo')) return 'turbo'
  return 'unknown'
}

function num(s: string | undefined | null): number {
  if (s == null) return 0
  const cleaned = String(s).replace(/[^0-9.\-]/g, '')
  return parseFloat(cleaned) || 0
}

function detectCurrency(text: string): string {
  if (text.includes('€')) return 'EUR'
  if (text.includes('£')) return 'GBP'
  return 'USD'
}

function toIso(date: string, time: string): string {
  const d = date.replace(/\//g, '-')
  return `${d}T${time || '00:00:00'}`
}

/**
 * Parse the text content of one or more GGPoker tournament summaries.
 * Splits on the "Tournament #" header so both single files and concatenated
 * content are handled.
 */
export function parseGGPokerSummaries(content: string): Tournament[] {
  const text = content.replace(/^﻿/, '')
  const headerRe = /^Tournament #\d+,/gm
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = headerRe.exec(text)) !== null) indices.push(m.index)
  if (indices.length === 0) return []

  const out: Tournament[] = []
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : text.length
    const t = parseBlock(text.slice(start, end))
    if (t) out.push(t)
  }
  return out
}

function parseBlock(block: string): Tournament | null {
  const header = block.match(/^Tournament #(\d+),\s*(.*)$/m)
  if (!header) return null
  const tournamentId = header[1]

  // Header rest: "<name>, <game type>". Game type is the last comma-segment.
  const restParts = header[2].split(',').map((s) => s.trim())
  const gameType = restParts.length > 1 ? restParts[restParts.length - 1] : 'Unknown'
  const name = (restParts.length > 1 ? restParts.slice(0, -1).join(', ') : restParts[0]) || `#${tournamentId}`

  // Buy-in: "$0.92+$0.08" (prize+fee) or "$0.25" (single).
  let buyIn = 0
  let fee = 0
  let currency = detectCurrency(block)
  const buyInLine = block.match(/Buy-?in:\s*(.+)/i)
  if (buyInLine) {
    const line = buyInLine[1]
    if (/freeroll/i.test(line)) {
      buyIn = 0
      fee = 0
    } else {
      const parts = [...line.matchAll(/[$€£₹]\s*([\d,]+(?:\.\d+)?)/g)].map((mm) => num(mm[1]))
      if (parts.length === 1) {
        buyIn = parts[0]
      } else if (parts.length >= 2) {
        fee = parts[parts.length - 1]
        buyIn = parts.slice(0, -1).reduce((a, b) => a + b, 0)
      }
    }
    currency = detectCurrency(line) || currency
  }

  // Field size: "1974 Players"
  const fieldMatch = block.match(/^\s*([\d,]+)\s+Players\b/im)
  const fieldSize = fieldMatch ? num(fieldMatch[1]) : null

  // Start: "Tournament started 2026/03/21 17:45:00"
  const startMatch = block.match(/Tournament started\s+(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/)
  const startDate = startMatch ? toIso(startMatch[1], startMatch[2]) : new Date(0).toISOString()

  // Finish place: "You finished the tournament in 1262th place."
  let finishPlace: number | null = null
  const placeMatch = block.match(/finished the tournament in\s+(\d+)(?:st|nd|rd|th)\s+place/i)
  if (placeMatch) finishPlace = parseInt(placeMatch[1], 10)

  // Payout: prefer "You received a total of $X." / "T$X.". Fallback to hero line.
  let payout = 0
  const receivedMatch = block.match(/received a total of\s+T?[$€£₹]\s*([\d,]+(?:\.\d+)?)/i)
  if (receivedMatch) {
    payout = num(receivedMatch[1])
  } else {
    const heroLine = block.match(/\d+(?:st|nd|rd|th)\s*:\s*Hero,\s*T?[$€£₹]\s*([\d,]+(?:\.\d+)?)/i)
    if (heroLine) payout = num(heroLine[1])
  }

  // Bounty / KO winnings, if itemized.
  let bounty = 0
  const bountyMatch = block.match(/bount(?:y|ies)[^$€£₹\n]*T?[$€£₹]\s*([\d,]+(?:\.\d+)?)/i)
  if (bountyMatch) bounty = num(bountyMatch[1])

  const rebuys = num(block.match(/(\d+)\s+rebuy/i)?.[1]) || 0
  const addons = num(block.match(/(\d+)\s+add-?on/i)?.[1]) || 0
  const reEntries = num(block.match(/re-?enter(?:ed)?\D*(\d+)\s+time/i)?.[1]) || 0

  const entriesCount = 1 + rebuys + addons + reEntries
  const totalCost = (buyIn + fee) * entriesCount

  return {
    id: `ggpoker:${tournamentId}`,
    source: 'ggpoker',
    tournamentId,
    name,
    gameType,
    speed: detectSpeed(name),
    currency,
    buyIn,
    fee,
    totalCost,
    startDate,
    fieldSize: fieldSize && fieldSize > 0 ? fieldSize : null,
    finishPlace,
    payout,
    bounty,
    reEntries,
    rebuys,
    addons,
    profit: payout - totalCost,
    resultKnown: true
  }
}
