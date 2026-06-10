// Reine Monte-Carlo-Paar-Equity (ohne Cache/localStorage), damit sowohl der
// equityTable-Lazy-Lookup als auch der Vorberechnungs-Worker dieselbe Quelle nutzen.
import { drawRandom, FULL_DECK, handIdToCombos } from './cards'
import { eval7 } from './handEval'
import type { HandId } from '../data/pushFoldData'

export const ITERS_PER_COMBO = 200  // 200 Iters × ~10 Combos = 2000 eff. Samples → SE ≈ 1 %

/**
 * Berechnet Equity von h1 gegen h2 via MC über alle nicht-konfliktierenden Combos.
 * Nutzt den schnellen array-freien eval7. Pur — keine Seiteneffekte.
 */
export function computeCanonicalEquity(h1: HandId, h2: HandId): number {
  const c1 = handIdToCombos(h1)
  const c2 = handIdToCombos(h2)

  let sumWin = 0
  let count  = 0

  for (const [a, b] of c1) {
    for (const [c, d] of c2) {
      if (a === c || a === d || b === c || b === d) continue  // Karten-Konflikt

      const deck = FULL_DECK.filter(x => x !== a && x !== b && x !== c && x !== d)
      let wins = 0, ties = 0

      for (let i = 0; i < ITERS_PER_COMBO; i++) {
        const board = drawRandom(deck, 5)
        const s1 = eval7([a, b, board[0], board[1], board[2], board[3], board[4]])
        const s2 = eval7([c, d, board[0], board[1], board[2], board[3], board[4]])
        if (s1 > s2) wins++
        else if (s1 === s2) ties++
      }

      sumWin += (wins + ties * 0.5) / ITERS_PER_COMBO
      count++
    }
  }

  return count > 0 ? sumWin / count : 0.5
}
