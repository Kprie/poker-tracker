/**
 * Parse a monetary amount that may be in English (1,816.08) or German
 * (1.816,08 / 14,59) notation, with or without a currency symbol.
 */
export function parseMoney(raw: string | undefined | null): number {
  if (raw == null) return 0
  let s = String(raw).replace(/[^0-9.,-]/g, '')
  if (s === '' || s === '-') return 0

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // The right-most separator is the decimal separator.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.') // German 1.816,08
    } else {
      s = s.replace(/,/g, '') // English 1,816.08
    }
  } else if (hasComma) {
    const after = s.slice(s.lastIndexOf(',') + 1)
    if (after.length <= 2) {
      s = s.replace(',', '.') // decimal comma, e.g. 14,59
    } else {
      s = s.replace(/,/g, '') // thousands comma, e.g. 1,816
    }
  }
  return parseFloat(s) || 0
}

export function detectCurrency(text: string): string {
  if (text.includes('€')) return 'EUR'
  if (text.includes('£')) return 'GBP'
  return 'USD'
}

/** All currency amounts found in a string, parsed locale-aware. */
export function moneyAmounts(text: string): number[] {
  return [...text.matchAll(/[$€£₹]\s*([\d.,]+)/g)].map((m) => parseMoney(m[1]))
}

/**
 * Parse a buy-in segment like "$20.00/$2.00 USD", "$0.92+$0.08",
 * "$9,80+$1,20" or "Freeroll" into prize buy-in + fee.
 */
export function parseBuyInSegment(seg: string): { buyIn: number; fee: number; currency: string } {
  const currency = detectCurrency(seg)
  if (/freeroll/i.test(seg)) return { buyIn: 0, fee: 0, currency }
  const parts = moneyAmounts(seg)
  if (parts.length === 0) return { buyIn: 0, fee: 0, currency }
  if (parts.length === 1) return { buyIn: parts[0], fee: 0, currency }
  return {
    buyIn: parts.slice(0, -1).reduce((a, b) => a + b, 0),
    fee: parts[parts.length - 1],
    currency
  }
}

/**
 * Parse a PokerStars timestamp in either English (2020/10/14 10:33:59 or
 * 20201014 103359) or German (27.04.2026 14:19:23) form. Uses the first
 * (local) timestamp in the header, ignoring the bracketed ET copy.
 */
export function parseTimestamp(header: string): string {
  const src = header.split('[')[0] // local time, before the [ET] copy
  // German DD.MM.YYYY HH:MM:SS
  let m = src.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
  if (m) {
    const [, d, mo, y, h, mi, s] = m
    return `${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}:${s}`
  }
  // English YYYY/MM/DD or YYYYMMDD with HH:MM:SS or HHMMSS
  m = src.match(/(\d{4})[/-]?(\d{2})[/-]?(\d{2})\s+(\d{1,2}):?(\d{2}):?(\d{2})/)
  if (m) {
    const [, y, mo, d, h, mi, s] = m
    return `${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}:${s}`
  }
  return new Date(0).toISOString()
}
