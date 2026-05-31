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

/** Rows whose money result is known (came from a tournament summary). */
export function withResults(rows: Tournament[]): Tournament[] {
  return rows.filter((t) => t.resultKnown)
}

export interface Kpis {
  /** All tournaments in range (played). */
  count: number
  /** Tournaments with a known money result. */
  resultCount: number
  totalCost: number
  totalPayout: number
  profit: number
  roi: number
  itmCount: number
  itmRate: number
  avgBuyIn: number
  biggestWin: number
}

export function computeKpis(rows: Tournament[]): Kpis {
  const count = rows.length
  const res = withResults(rows)
  const totalCost = sum(res, (t) => t.totalCost)
  const totalPayout = sum(res, (t) => t.payout)
  const profit = totalPayout - totalCost
  const itmCount = res.filter((t) => t.payout > 0).length
  const avgBuyIn = count ? sum(rows, (t) => t.buyIn + t.fee) / count : 0
  const biggestWin = res.reduce((m, t) => Math.max(m, t.payout), 0)
  return {
    count,
    resultCount: res.length,
    totalCost,
    totalPayout,
    profit,
    roi: totalCost ? profit / totalCost : 0,
    itmCount,
    itmRate: res.length ? itmCount / res.length : 0,
    avgBuyIn,
    biggestWin
  }
}

export interface PlayStyle {
  hands: number
  vpip: number
  pfr: number
  threeBet: number
  af: number
  afq: number
  wtsd: number
  wonSd: number
  /** Tournaments that contributed hand stats. */
  tournaments: number
}

/** Aggregate hero hand-history stats across rows into play-style rates. */
export function computePlayStyle(rows: Tournament[]): PlayStyle {
  const stats = rows.map((t) => t.handStats).filter((s): s is NonNullable<typeof s> => !!s)
  const hands = sum(stats, (s) => s.hands)
  const vpip = sum(stats, (s) => s.vpip)
  const pfr = sum(stats, (s) => s.pfr)
  const threeBet = sum(stats, (s) => s.threeBet)
  const threeBetOpp = sum(stats, (s) => s.threeBetOpp)
  const wtsd = sum(stats, (s) => s.wtsd)
  const wonSd = sum(stats, (s) => s.wonSd)
  const sawFlop = sum(stats, (s) => s.sawFlop)
  const agg = sum(stats, (s) => s.aggActions)
  const calls = sum(stats, (s) => s.callActions)
  return {
    hands,
    vpip: hands ? vpip / hands : 0,
    pfr: hands ? pfr / hands : 0,
    threeBet: threeBetOpp ? threeBet / threeBetOpp : 0,
    af: calls ? agg / calls : 0,
    afq: agg + calls ? agg / (agg + calls) : 0,
    wtsd: sawFlop ? wtsd / sawFlop : 0,
    wonSd: wtsd ? wonSd / wtsd : 0,
    tournaments: stats.length
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

const SPEED_LABEL: Record<string, string> = {
  regular: 'Regular',
  turbo: 'Turbo',
  hyper: 'Hyper',
  unknown: 'Unknown'
}

export function bySpeed(rows: Tournament[]): GroupStat[] {
  return groupBy(rows, (t) => SPEED_LABEL[t.speed] ?? t.speed).sort((a, b) => b.count - a.count)
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

export interface RollingRoiPoint {
  date: string
  roi: number
  index: number
}

export function rollingRoiSeries(rows: Tournament[], window: number): RollingRoiPoint[] {
  const sorted = [...rows].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const result: RollingRoiPoint[] = []
  for (let i = window - 1; i < sorted.length; i++) {
    const slice = sorted.slice(i - window + 1, i + 1)
    const cost = sum(slice, (t) => t.totalCost)
    if (cost === 0) continue
    const profit = sum(slice, (t) => t.profit)
    result.push({ date: sorted[i].startDate.slice(0, 10), roi: round(profit / cost), index: i + 1 })
  }
  return result
}

export interface ItmTier {
  label: string
  count: number
  pct: number
  avgProfit: number
}

const ITM_TIERS: { label: string; test: (t: Tournament) => boolean }[] = [
  { label: 'Kein Cash', test: (t) => t.payout === 0 },
  { label: '< 2× Kosten', test: (t) => t.payout > 0 && t.payout < t.totalCost * 2 },
  { label: '2–5× Kosten', test: (t) => t.payout >= t.totalCost * 2 && t.payout < t.totalCost * 5 },
  { label: '≥ 5× Kosten', test: (t) => t.payout >= t.totalCost * 5 }
]

export function computeItmDepth(rows: Tournament[]): ItmTier[] {
  const total = rows.length
  return ITM_TIERS.map(({ label, test }) => {
    const matches = rows.filter(test)
    const avgProfit = matches.length ? round(sum(matches, (t) => t.profit) / matches.length) : 0
    return { label, count: matches.length, pct: total ? matches.length / total : 0, avgProfit }
  })
}

function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((a, x) => a + f(x), 0)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
