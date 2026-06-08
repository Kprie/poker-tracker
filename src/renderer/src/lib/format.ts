export function money(n: number, currency = 'USD'): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
  const sign = n < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(n).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export function pct(n: number): string {
  return `${(n * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`
}

/**
 * Formatiert einen ICM-/Equity-Wert: als Euro-Betrag, wenn Payouts in Geld
 * vorliegen (`totalPayout > 0`), sonst als roher Equity-Anteil (4 Nachkommastellen).
 */
export function fmtEquity(value: number, totalPayout: number): string {
  if (totalPayout > 0) {
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 })
}

/** Wie {@link fmtEquity}, aber mit explizitem Vorzeichen — für Delta-Werte. */
export function fmtEquityDelta(value: number, totalPayout: number): string {
  const abs = fmtEquity(Math.abs(value), totalPayout)
  return value >= 0 ? `+${abs}` : `-${abs}`
}

export function dateLabel(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
