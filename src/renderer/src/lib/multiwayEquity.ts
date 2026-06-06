import type { Card } from './cards'
import { drawRandom, FULL_DECK } from './cards'
import { eval7 } from './handEval'

/**
 * Bewertet alle Hände gegen ein vollständiges Board (genau 5 Karten).
 *
 * Liefert für jede Hand den eval7-Score von [...hand, ...board] zurück
 * (höher = bessere 5-aus-7-Hand, exakt gleicher Score = Tie).
 *
 * Reine Funktion: dies ist das Primitiv für die spätere Side-Pot-Vergabe —
 * pro Pot-Layer gewinnt der höchste Score unter den dafür berechtigten Spielern.
 */
export function scoreHandsOnBoard(
  hands: readonly [Card, Card][],
  board: readonly Card[],
): number[] {
  const scores = new Array<number>(hands.length)
  for (let i = 0; i < hands.length; i++) {
    const [a, b] = hands[i]
    scores[i] = eval7([a, b, board[0], board[1], board[2], board[3], board[4]])
  }
  return scores
}

/**
 * Monte-Carlo-Showdown-Equity für beliebig viele Hände (Multiway, preflop All-in).
 *
 * Pro Iteration werden 5 Board-Karten aus dem Deck OHNE die Hole-Cards aller
 * Spieler gezogen, dann via {@link scoreHandsOnBoard} bewertet. Der/die Spieler
 * mit höchstem Score teilen sich den Pot: bei k-fachem Tie erhält jeder 1/k.
 *
 * Rückgabe: durchschnittliche Equity je Spieler. Die Summe ergibt exakt 1.0,
 * da jede Iteration genau ein Gesamtgewicht von 1.0 verteilt.
 *
 * Annahme: die Hole-Cards aller Hände sind paarweise verschieden (vom Aufrufer
 * garantiert). Defensiv werden dennoch alle Hole-Cards aus dem Deck gefiltert.
 */
export function multiwayEquity(
  hands: readonly [Card, Card][],
  iterations = 5000,
): number[] {
  const n = hands.length
  const equity = new Array<number>(n).fill(0)
  if (n === 0 || iterations <= 0) return equity

  // Deck ohne alle Hole-Cards
  const blocked = new Set<Card>()
  for (const [a, b] of hands) { blocked.add(a); blocked.add(b) }
  const available = FULL_DECK.filter(c => !blocked.has(c))

  for (let it = 0; it < iterations; it++) {
    const board = drawRandom(available, 5)
    const scores = scoreHandsOnBoard(hands, board)

    // Höchsten Score und Anzahl der Gewinner bestimmen
    let best = scores[0]
    let winners = 1
    for (let i = 1; i < n; i++) {
      if (scores[i] > best) { best = scores[i]; winners = 1 }
      else if (scores[i] === best) winners++
    }

    const share = 1 / winners
    for (let i = 0; i < n; i++) {
      if (scores[i] === best) equity[i] += share
    }
  }

  for (let i = 0; i < n; i++) equity[i] /= iterations
  return equity
}

/** Verteilt einen Showdown auf einem fertigen 5-Karten-Board an die Gewinner. */
function tallyShowdown(hands: readonly [Card, Card][], board: readonly Card[], equity: number[]): void {
  const scores = scoreHandsOnBoard(hands, board)
  let best = scores[0], winners = 1
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > best) { best = scores[i]; winners = 1 }
    else if (scores[i] === best) winners++
  }
  const share = 1 / winners
  for (let i = 0; i < scores.length; i++) if (scores[i] === best) equity[i] += share
}

/**
 * Multiway-Equity mit (Teil-)Board. Board-Länge → Methode:
 *   5 (River):  direkte Auswertung
 *   4 (Turn):   exakte Enumeration der Riverkarte
 *   3 (Flop):   exakte Enumeration Turn+River (C(rest,2))
 *   0–2:        Monte Carlo (`iterations` Runouts)
 * Summe der Equities = 1.0.
 */
export function multiwayEquityBoard(
  hands: readonly [Card, Card][],
  board: readonly Card[],
  iterations = 5000,
): number[] {
  const n = hands.length
  const equity = new Array<number>(n).fill(0)
  if (n === 0) return equity

  const blocked = new Set<Card>(board)
  for (const [a, b] of hands) { blocked.add(a); blocked.add(b) }
  const avail = FULL_DECK.filter(c => !blocked.has(c))
  const need = 5 - board.length

  if (need <= 0) {
    tallyShowdown(hands, board.slice(0, 5), equity)
    return equity  // bereits normiert (Summe 1)
  }

  if (need === 1) {
    for (const c of avail) tallyShowdown(hands, [...board, c], equity)
    for (let i = 0; i < n; i++) equity[i] /= avail.length
    return equity
  }

  if (need === 2) {
    let total = 0
    for (let i = 0; i < avail.length; i++) {
      for (let j = i + 1; j < avail.length; j++) {
        tallyShowdown(hands, [...board, avail[i], avail[j]], equity)
        total++
      }
    }
    for (let i = 0; i < n; i++) equity[i] /= total
    return equity
  }

  // need ≥ 3: Monte Carlo
  for (let it = 0; it < iterations; it++) {
    const drawn = drawRandom(avail, need)
    tallyShowdown(hands, [...board, ...drawn], equity)
  }
  for (let i = 0; i < n; i++) equity[i] /= iterations
  return equity
}
