import type { Card } from './cards'
import { drawRandom, FULL_DECK, handIdToCombos } from './cards'
import { eval7 } from './handEval'
import type { HandEntry, PushFoldSpot } from '../data/pushFoldData'
import { ALL_HAND_IDS } from '../data/pushFoldData'

export interface RangeCombo {
  cards: [Card, Card]
  /** Nash-Frequenz 0–1. 1.0 = immer; 0.6 = 60 % der Zeit. */
  weight: number
}

/**
 * Verfügbare Villain-Combos nach Abzug der 2 Hero-Karten: C(50,2) = 1225.
 * Einheitliche Bezugsgröße für alle P(call)-/Combo-Anteil-Berechnungen.
 */
export const VILLAIN_COMBOS = 1225

/**
 * Baut die Calling-Range eines Villains aus einem PushFoldSpot.
 * Hände mit ev > 0 sind im Call enthalten; Mixed-Strategy-Hände mit freq ≠ null anteilig.
 * hero_cards werden als blockiert ausgeschlossen.
 */
export function buildCallingRange(spot: PushFoldSpot, heroCards: [Card, Card]): RangeCombo[] {
  const blocked = new Set<Card>(heroCards)
  const result: RangeCombo[] = []

  for (const id of ALL_HAND_IDS) {
    const entry: HandEntry | null = spot.hands[id] ?? null
    if (entry === null || entry.ev === null || entry.ev <= 0) continue

    const weight = entry.freq !== null ? entry.freq / 100 : 1.0

    for (const [c1, c2] of handIdToCombos(id)) {
      if (blocked.has(c1) || blocked.has(c2)) continue
      result.push({ cards: [c1, c2], weight })
    }
  }

  return result
}

export interface EquityResult {
  /** Equity des Heros (0–1). Ties zählen als 0.5. */
  equity: number
  /** Standardabweichung der Schätzung. */
  stdDev: number
  /** Anteil der Villain-Hände (gewichtet), die diesen Spot callen. */
  callFraction: number
  /** Anzahl MC-Iterationen. */
  iterations: number
}

/**
 * Monte-Carlo-Equity: Heros konkrete Hand vs Villain-Range (preflop All-in).
 * Algorithmus: pick random weighted villain combo → shuffle 5 Board-Karten → eval7 beide.
 * Konfidenzintervall: ±1.96 × stdDev ≈ 95 %-Intervall.
 *
 * @param heroCards  Die zwei konkreten Karten des Heros
 * @param range      Villain-Range aus buildCallingRange
 * @param iterations Anzahl MC-Samples (2000 ≈ <100 ms, Fehler ±~2 %)
 */
export function computeEquityMC(
  heroCards: [Card, Card],
  range: RangeCombo[],
  iterations = 2000,
): EquityResult {
  if (range.length === 0) return { equity: 0.5, stdDev: 0, callFraction: 0, iterations: 0 }

  // Gewichtete Sampling-Tabelle (alias method wäre optimal; hier direkte weighted-pick)
  const totalWeight = range.reduce((s, r) => s + r.weight, 0)

  // callFraction: gewichtete Combo-Summe / verfügbare Villain-Combos (C(50,2)=1225 nach Hero-Blocking)
  const weightedCombos = range.reduce((s, r) => s + r.weight, 0)
  const callFraction = Math.min(1, weightedCombos / VILLAIN_COMBOS)

  // Deck ohne Hero-Karten
  const deckWithoutHero = FULL_DECK.filter(c => c !== heroCards[0] && c !== heroCards[1])

  let wins = 0
  let ties = 0

  for (let i = 0; i < iterations; i++) {
    // Gewichtetes Ziehen eines Villain-Combos
    let rnd = Math.random() * totalWeight
    let villain = range[0].cards
    for (const combo of range) {
      rnd -= combo.weight
      if (rnd <= 0) { villain = combo.cards; break }
    }

    // Board aus verbleibendem Deck (ohne Hero + Villain)
    const available = deckWithoutHero.filter(c => c !== villain[0] && c !== villain[1])
    const board = drawRandom(available, 5)

    const heroScore = eval7([heroCards[0], heroCards[1], ...board])
    const villScore = eval7([villain[0],   villain[1],   ...board])

    if (heroScore > villScore) wins++
    else if (heroScore === villScore) ties++
  }

  const equity = (wins + ties * 0.5) / iterations
  // Binomial-Standardabweichung
  const stdDev = Math.sqrt((equity * (1 - equity)) / iterations)

  return { equity, stdDev, callFraction, iterations }
}

/** ICM-Equity-Szenarien nach einem Push-/Fold-Entscheid. */
export interface IcmScenarios {
  /** Equity wenn Hero jetzt foldet (unveränderter Zustand). */
  fold: number
  /** Equity wenn Hero pushed und alle anderen folden (gewinnt Blinds + Antes). */
  pushWinBlinds: number
  /** Equity wenn Hero pushed, gecallt wird und gewinnt. */
  pushCallWin: number
  /** Equity wenn Hero pushed, gecallt wird und verliert. */
  pushCallLose: number
}

/**
 * Berechnet ICM-Equity für alle 4 Push-Szenarien — chip-erhaltend für **jede**
 * Spielerzahl. Generalisiert das exakte HU-Modell (B6.1) um Dead Money: alle
 * Sitze außer Hero und dem betrachteten Caller gelten als bereits gefoldet, ihre
 * Posts liegen als Dead Money im Pot und gehen an den jeweiligen Gewinner.
 *
 * Konvention: Index 0 = Hero. Posts sind sitz-indiziert (Blind + Ante je Sitz);
 * die Stacks sind Pre-Posting-Werte. Bei HU (n=2, dead=0) identisch zum exakten
 * Stack-Swap-Modell. Für n>2 ist dies das chip-erhaltende Einzel-Caller-Modell;
 * die volle Multiway-Verteilung liefert der Solver (Nash-Ranges / EV-Tabelle).
 *
 * @param stacks    Chip-Stacks aller Spieler, Pre-Posting (Index 0 = Hero)
 * @param payouts   Auszahlungen
 * @param posts     Geposteter Blind+Ante je Sitz (≥0)
 * @param callerIdx Index des betrachteten Callers (typischerweise BB)
 */
export function computeIcmScenarios(
  stacks: number[],
  payouts: number[],
  posts: number[],
  callerIdx: number,
  computeEquities: (s: number[], p: number[]) => number[],
): IcmScenarios {
  const d = icmScenarioConfigs(stacks, posts, 0, callerIdx)
  return {
    fold: computeEquities(d.fold, payouts)[0],
    pushWinBlinds: computeEquities(d.winPot, payouts)[0],
    pushCallWin: computeEquities(d.winCall, payouts)[0],
    pushCallLose: computeEquities(d.loseCall, payouts)[0],
  }
}

/**
 * Gewichteter Push-EV als Delta zur Fold-Line, aus den vier ICM-Szenarien.
 *
 * @param sc         Die vier Szenario-Equities (Fold / Push-durch / Call-Win / Call-Lose).
 * @param pCall      Wahrscheinlichkeit (0–1), dass Villain callt.
 * @param heroEquity Heros Showdown-Equity (0–1), falls gecallt wird.
 * @returns EV-Differenz zur Fold-Line in Payout-Einheiten (positiv = Push besser als Fold).
 */
export function weightedPushEv(sc: IcmScenarios, pCall: number, heroEquity: number): number {
  const { fold, pushWinBlinds, pushCallWin, pushCallLose } = sc
  return (1 - pCall) * (pushWinBlinds - fold)
    + pCall * heroEquity * (pushCallWin - fold)
    + pCall * (1 - heroEquity) * (pushCallLose - fold)
}

/**
 * Baut die vier chip-erhaltenden Stack-Konfigurationen für die Push/Fold-Szenarien
 * aus Sicht von `dm` (Entscheider) gegen `op` (Caller). Gemeinsame Quelle für
 * {@link computeIcmScenarios} und computeIcmDeltas (nashSolver) — garantiert ein
 * einziges, konsistentes ICM-Modell.
 */
export function icmScenarioConfigs(
  stacks: number[],
  posts: number[],
  dm: number,
  op: number,
): { fold: number[]; winPot: number[]; winCall: number[]; loseCall: number[] } {
  const eff = Math.min(stacks[dm], stacks[op])
  // Posts auf den verfügbaren Stack kappen (All-in-Blind kann nicht mehr posten als er hat),
  // sonst entstünden negative Stacks. Chip-Erhaltung bleibt gewahrt.
  const pd = Math.min(posts[dm], stacks[dm])
  const po = Math.min(posts[op], stacks[op])
  // Dead Money: (gekappte) Posts aller übrigen (bereits gefoldeten) Sitze.
  let dead = 0
  const base = stacks.slice()
  for (let i = 0; i < stacks.length; i++) {
    if (i !== dm && i !== op) { const pi = Math.min(posts[i], stacks[i]); dead += pi; base[i] = stacks[i] - pi }
  }
  const cfg = (h: number, o: number): number[] => {
    const c = base.slice()
    c[dm] = h
    c[op] = o
    return c
  }
  return {
    // Fold: Entscheider gibt seinen Post auf; Caller gewinnt Entscheider-Post + Dead Money.
    fold: cfg(stacks[dm] - pd, stacks[op] + pd + dead),
    // Push, alle folden: Entscheider gewinnt Caller-Post + Dead Money.
    winPot: cfg(stacks[dm] + po + dead, stacks[op] - po),
    // Push + Call gewonnen: Entscheider gewinnt eff vom Caller + Dead Money.
    winCall: cfg(stacks[dm] + eff + dead, stacks[op] - eff),
    // Push + Call verloren: Caller gewinnt eff vom Entscheider + Dead Money.
    loseCall: cfg(stacks[dm] - eff, stacks[op] + eff + dead),
  }
}
