// ─── PKO-/Bounty-EV ───────────────────────────────────────────────────────────
//
// Modelliert den SOFORTIGEN Bounty-Wert einer All-in-Konfrontation: schlägt Hero
// einen Gegner aus, den er covert, erhält er den Cash-Anteil von dessen Bounty
// (PKO-Standard: 50 % als Cash, 50 % wandert auf Heros eigenen Kopf). Zukünftiger
// Bounty-Wert, Coverage-Ketteneffekte und die eigene Bounty-Liability sind bewusst
// NICHT modelliert (würde einen vollen Bounty-aware Multiway-Solver erfordern) —
// das Modul liefert den unmittelbaren Bounty-Anreiz als $-Aufschlag auf den
// Chip-/ICM-$EV. Vgl. Spec §5.6/§8.9.

export interface BountyShoveInput {
  /** Heros Stack (Chips) vor der Konfrontation. */
  heroStack: number
  /** Stack des Gegners (Chips). */
  villainStack: number
  /** Heros Equity gegen die Call-/Commit-Range des Gegners (0–1). */
  heroEquity: number
  /** Aktueller Bounty des Gegners (in $/€). */
  villainBounty: number
  /** Cash-Anteil des Bounties, der bei Elimination zufließt (PKO-Standard 0.5). */
  bountyCashFraction?: number
  /** Optionaler Basis-EV (Chip- oder ICM-$EV) ohne Bounty. */
  baseEv?: number
}

export interface BountyResult {
  /** Covert Hero den Gegner (kann ihn überhaupt ausschalten)? */
  covers: boolean
  /** Cash-Wert des Bounties bei Elimination. */
  bountyCash: number
  /** Erwarteter sofortiger Bounty-$ = P(Elimination) × Cash. */
  bountyEv: number
  /** baseEv + bountyEv. */
  totalEv: number
}

/**
 * Sofortiger Bounty-EV eines All-ins. Hero kann nur dann einen Bounty kassieren,
 * wenn er den Gegner covert (heroStack ≥ villainStack); dann ist P(Elimination)
 * = heroEquity (Gegner ist all-in und bustet bei Heros Sieg).
 */
export function bountyShoveEv(i: BountyShoveInput): BountyResult {
  const frac = i.bountyCashFraction ?? 0.5
  const covers = i.heroStack >= i.villainStack
  const bountyCash = i.villainBounty * frac
  const bountyEv = covers ? i.heroEquity * bountyCash : 0
  return { covers, bountyCash, bountyEv, totalEv: (i.baseEv ?? 0) + bountyEv }
}

export interface BountyOpponent {
  stack: number
  bounty: number
  /** Heros Equity, diesen Gegner zu schlagen (0–1). */
  equity: number
}

/**
 * Summierter sofortiger Bounty-EV gegen mehrere Gegner (z. B. Multiway-All-in).
 * Vereinfachung: Bounties werden unabhängig addiert (kein Side-Pot-/Coverage-Detail).
 */
export function totalBountyEv(
  heroStack: number,
  opponents: BountyOpponent[],
  bountyCashFraction = 0.5,
): number {
  return opponents.reduce((s, o) => {
    const covers = heroStack >= o.stack
    return s + (covers ? o.equity * o.bounty * bountyCashFraction : 0)
  }, 0)
}
