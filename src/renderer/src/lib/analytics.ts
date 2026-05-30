import type { PokerSource, Tournament } from '../../../shared/types'

export type SourceFilter = 'all' | PokerSource

export interface Filters {
  source: SourceFilter
  /** ISO date (inclusive) or null for no lower bound. */
  from: string | null
  /** ISO date (inclusive) or null for no upper bound. */
  to: string | null
}

export function applyFilters(tournaments: Tournament[], f: Filters): Tournament[] {
  return tournaments
    .filter((t) => (f.source === 'all' ? true : t.source === f.source))
    .filter((t) => {
      const d = t.startDate.slice(0, 10)
      if (f.from && d < f.from) return false
      if (f.to && d > f.to) return false
      return true
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export interface Kpis {
  count: number
  totalCost: number
  totalPayout: number
  profit: number
  roi: number
  itmCount: number
  itmRate: number
  avgBuyIn: number
  biggestWin: number
  bestCashProfit: number
}

export function computeKpis(rows: Tournament[]): Kpis {
  const count = rows.length
  const totalCost = sum(rows, (t) => t.totalCost)
  const totalPayout = sum(rows, (t) => t.payout)
  const profit = totalPayout - totalCost
  const itmCount = rows.filter((t) => t.payout > 0).length
  const avgBuyIn = count ? sum(rows, (t) => t.buyIn + t.fee) / count : 0
  const biggestWin = rows.reduce((m, t) => Math.max(m, t.payout), 0)
  const bestCashProfit = rows.reduce((m, t) => Math.max(m, t.profit), 0)
  return {
    count,
    totalCost,
    totalPayout,
    profit,
    roi: totalCost ? profit / totalCost : 0,
    itmCount,
    itmRate: count ? itmCount / count : 0,
    avgBuyIn,
    biggestWin,
    bestCashProfit
  }
}

export interface BankrollPoint {
  date: string
  index: number
  profit: number
  cumulative: number
  name: string
}

export function bankrollSeries(rows: Tournament[]): BankrollPoint[] {
  let cum = 0
  return rows.map((t, i) => {
    cum += t.profit
    return {
      date: t.startDate.slice(0, 10),
      index: i + 1,
      profit: round(t.profit),
      cumulative: round(cum),
      name: t.name
    }
  })
}

export interface GroupStat {
  key: string
  count: number
  cost: number
  payout: number
  profit: number
  roi: number
  itmRate: number
}

function groupBy(rows: Tournament[], keyFn: (t: Tournament) => string): GroupStat[] {
  const map = new Map<string, Tournament[]>()
  for (const t of rows) {
    const k = keyFn(t)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  return [...map.entries()].map(([key, list]) => {
    const cost = sum(list, (t) => t.totalCost)
    const payout = sum(list, (t) => t.payout)
    const profit = payout - cost
    const itm = list.filter((t) => t.payout > 0).length
    return {
      key,
      count: list.length,
      cost: round(cost),
      payout: round(payout),
      profit: round(profit),
      roi: cost ? profit / cost : 0,
      itmRate: list.length ? itm / list.length : 0
    }
  })
}

const BUYIN_BRACKETS: { max: number; label: string }[] = [
  { max: 1, label: '≤ $1' },
  { max: 5, label: '$1–5' },
  { max: 11, label: '$5–11' },
  { max: 25, label: '$11–25' },
  { max: 55, label: '$25–55' },
  { max: 110, label: '$55–110' },
  { max: Infinity, label: '$110+' }
]

function buyInBracket(t: Tournament): string {
  const total = t.buyIn + t.fee
  return BUYIN_BRACKETS.find((b) => total <= b.max)!.label
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function byBuyIn(rows: Tournament[]): GroupStat[] {
  const order = BUYIN_BRACKETS.map((b) => b.label)
  return groupBy(rows, buyInBracket).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
}

export function bySpeed(rows: Tournament[]): GroupStat[] {
  return groupBy(rows, (t) => t.speed).sort((a, b) => b.count - a.count)
}

export function byGameType(rows: Tournament[]): GroupStat[] {
  return groupBy(rows, (t) => t.gameType).sort((a, b) => b.count - a.count)
}

export function byWeekday(rows: Tournament[]): GroupStat[] {
  const stats = groupBy(rows, (t) => WEEKDAYS[new Date(t.startDate).getDay()])
  return stats.sort((a, b) => WEEKDAYS.indexOf(a.key) - WEEKDAYS.indexOf(b.key))
}

export function byHour(rows: Tournament[]): GroupStat[] {
  const stats = groupBy(rows, (t) => String(new Date(t.startDate).getHours()).padStart(2, '0'))
  return stats.sort((a, b) => a.key.localeCompare(b.key))
}

function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((a, x) => a + f(x), 0)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
