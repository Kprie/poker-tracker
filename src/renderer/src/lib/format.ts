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

export function dateLabel(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
