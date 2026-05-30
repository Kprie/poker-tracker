import type { Tournament, TournamentSpeed } from '../../shared/types'

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR'
}

function detectCurrency(text: string): string {
  for (const sym of Object.keys(CURRENCY_BY_SYMBOL)) {
    if (text.includes(sym)) return CURRENCY_BY_SYMBOL[sym]
  }
  return 'USD'
}

function detectSpeed(name: string): TournamentSpeed {
  const n = name.toLowerCase()
  if (n.includes('hyper')) return 'hyper'
  if (n.includes('turbo')) return 'turbo'
  return 'regular'
}

/** Parse a number like "1,234.56" -> 1234.56 */
function num(s: string | undefined | null): number {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '')) || 0
}

function toIso(date: string, time: string): string {
  // date like 2012/06/24, time like 13:00:00 -> 2012-06-24T13:00:00
  const d = date.replace(/\//g, '-')
  return `${d}T${time || '00:00:00'}`
}

/**
 * Parse the full text of a PokerStars Tournament Summary file.
 * A file usually contains one tournament, but we split defensively so
 * concatenated summaries also work.
 */
export function parsePokerStarsSummaries(content: string): Tournament[] {
  const text = content.replace(/^﻿/, '') // strip BOM
  const headerRe = /PokerStars Tournament #/g
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = headerRe.exec(text)) !== null) indices.push(m.index)
  if (indices.length === 0) return []

  const blocks: string[] = []
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : text.length
    blocks.push(text.slice(start, end))
  }

  const out: Tournament[] = []
  for (const block of blocks) {
    const t = parseBlock(block)
    if (t) out.push(t)
  }
  return out
}

function parseBlock(block: string): Tournament | null {
  const idMatch = block.match(/PokerStars Tournament #(\d+),?\s*(.*)/)
  if (!idMatch) return null
  const tournamentId = idMatch[1]
  const headerRest = (idMatch[2] || '').trim()

  // Game type sits on the header line after the id, e.g. "No Limit Hold'em".
  const gameType = headerRest.replace(/\s+USD|\s+EUR|\s+GBP/i, '').trim() || 'Unknown'

  // Buy-In line: "Buy-In: $4.60+$0.40 USD" or with a bounty part, or "Freeroll".
  let buyIn = 0
  let fee = 0
  let currency = detectCurrency(block)
  const buyInLine = block.match(/Buy-In:\s*(.+)/)
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

  // Field size: "3840 players"
  const fieldMatch = block.match(/^\s*(\d[\d,]*)\s+players\b/m)
  const fieldSize = fieldMatch ? num(fieldMatch[1]) : null

  // Start date: "Tournament started 2012/06/24 13:00:00 ET"
  const startMatch = block.match(/Tournament started\s+(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/)
  const startDate = startMatch ? toIso(startMatch[1], startMatch[2]) : new Date(0).toISOString()

  // Finish place + payout:
  // "You finished the tournament in 5th place and received $123.45."
  // "You finished the tournament in 1452nd place."
  let finishPlace: number | null = null
  let payout = 0
  const finishMatch = block.match(
    /You finished (?:the tournament )?in (\d+)(?:st|nd|rd|th) place(?:[^$€£₹\n]*[$€£₹]\s*([\d,]+(?:\.\d+)?))?/i
  )
  if (finishMatch) {
    finishPlace = parseInt(finishMatch[1], 10)
    if (finishMatch[2]) payout += num(finishMatch[2])
  }

  // Bounty / knockout winnings: "You earned $12.00 in bounty awards" (wording varies).
  let bounty = 0
  const bountyMatch = block.match(/earned\s+[$€£₹]\s*([\d,]+(?:\.\d+)?)\s+(?:in\s+)?bount/i)
  if (bountyMatch) {
    bounty = num(bountyMatch[1])
    payout += bounty
  }

  // Rebuys / add-ons / re-entries.
  const rebuys = num(block.match(/made\s+(\d+)\s+rebuy/i)?.[1]) || 0
  const addons = num(block.match(/(\d+)\s+add-?on/i)?.[1]) || 0
  const reEntries = num(block.match(/re-?enter(?:ed)?\s+(?:the tournament\s+)?(\d+)\s+time/i)?.[1]) || 0

  const entriesCount = 1 + rebuys + addons + reEntries
  const totalCost = (buyIn + fee) * entriesCount

  return {
    id: `pokerstars:${tournamentId}`,
    source: 'pokerstars',
    tournamentId,
    name: gameType !== 'Unknown' ? `#${tournamentId} ${gameType}` : `#${tournamentId}`,
    gameType,
    speed: detectSpeed(headerRest),
    currency,
    buyIn,
    fee,
    totalCost,
    startDate,
    fieldSize,
    finishPlace,
    payout,
    bounty,
    reEntries,
    rebuys,
    addons,
    profit: payout - totalCost
  }
}
