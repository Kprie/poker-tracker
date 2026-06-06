// ─── Pot-Odds- und Bet-EV-Mathematik (Chip-EV) ───────────────────────────────
//
// Rein analytisch, kein Solver. Einheiten sind beliebig (BB oder Chips), solange
// alle Eingaben dieselbe Einheit nutzen. Konventionen bewusst dokumentiert, damit
// sie über alle Engine-Versionen konstant bleiben (vgl. Spec §9).

/**
 * Benötigte Equity für einen Call (Chip-EV-Breakeven, ohne weitere Straßen).
 *
 *   benötigte Equity = Callbetrag / (Pot nach Call)
 *
 * `potWithBet` = Pot inklusive des Bets/Raises des Gegners, bevor Hero callt.
 * `potNachCall = potWithBet + callAmount`.
 * Beispiel: Pot 150 (inkl. Villain-Bet 50), Call 50 → 50/200 = 25 %.
 */
export function requiredEquityCall(potWithBet: number, callAmount: number): number {
  const denom = potWithBet + callAmount
  return denom > 0 ? callAmount / denom : 0
}

/**
 * Break-even-Foldfrequenz eines reinen Bluff-Bets:
 *
 *   F* = Bet / (Bet + Pot vor Bet)
 *
 * Beispiel: Pot 100, Bet 50 → 50/150 = 33,3 %.
 */
export function breakEvenFoldFreq(potBefore: number, bet: number): number {
  const denom = bet + potBefore
  return denom > 0 ? bet / denom : 0
}

/**
 * Chip-EV eines Calls bei realisierter Equity `equity` (0–1).
 *   EV(Call) = equity · (potWithBet + callAmount) − callAmount
 * Positiv ⇒ Call ist Chip-EV-profitabel.
 */
export function callEvChips(equity: number, potWithBet: number, callAmount: number): number {
  return equity * (potWithBet + callAmount) - callAmount
}

export interface BetEvInput {
  /** P: Pot vor Heros Bet. */
  potBefore: number
  /** B: Heros Bet. */
  bet: number
  /** C: gegnerischer Callbetrag (i. d. R. = bet). */
  call: number
  /** F: Foldwahrscheinlichkeit des Gegners (0–1). */
  foldFreq: number
  /** E: Heros Equity, wenn gecallt wird (0–1). */
  equityWhenCalled: number
}

/**
 * EV eines Bets/Jams (Chip-EV):
 *
 *   EV(Bet) = F · P + (1 − F) · [ E · (P + B + C) − B ]
 *
 * Der eigene Bet B wird bei Call **unkonditional** investiert (nicht nur im
 * Verlustfall) — daher `− B` außerhalb des Equity-Terms. Vgl. Spec §9.4.
 */
export function betEv(i: BetEvInput): number {
  const { potBefore: P, bet: B, call: C, foldFreq: F, equityWhenCalled: E } = i
  return F * P + (1 - F) * (E * (P + B + C) - B)
}

export interface SizingRow {
  /** Bet als Anteil des Pots (z. B. 0.33 = 1/3 Pot). */
  fraction: number
  bet: number
  /** Benötigte Foldfrequenz, damit der Bet rein als Bluff EV ≥ 0 hat. */
  breakEvenFold: number
  /** EV bei der angenommenen Foldfrequenz (mit Call = Bet). */
  evAtFold: number
}

/**
 * Vergleicht mehrere Bet-Größen (Anteile des Pots) bei fester Foldfrequenz und
 * Equity-when-called. Caller-Betrag = Bet (Standard-Annahme).
 */
export function sizingComparison(
  potBefore: number,
  fractions: number[],
  foldFreq: number,
  equityWhenCalled: number,
): SizingRow[] {
  return fractions.map(f => {
    const bet = potBefore * f
    return {
      fraction: f,
      bet,
      breakEvenFold: breakEvenFoldFreq(potBefore, bet),
      evAtFold: betEv({ potBefore, bet, call: bet, foldFreq, equityWhenCalled }),
    }
  })
}
