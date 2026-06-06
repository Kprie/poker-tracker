export interface PotLayer {
  /** Chip-Betrag dieses Pot-Layers. */
  amount: number
  /** Indizes der Spieler, die um diesen Layer berechtigt sind (am Showdown teilnehmen). */
  eligible: number[]
}

/**
 * Baut die Side-Pot-Struktur aus den Einsätzen jedes Spielers.
 * contributions[i] = Chips, die Spieler i in den Pot gegeben hat (0 = gefoldet/nicht beteiligt).
 * Berechtigt für einen Layer ist jeder Spieler, der mindestens bis zu dieser Layer-Höhe eingezahlt hat.
 */
export function buildSidePots(contributions: readonly number[]): PotLayer[] {
  // Distinkte positive Einsatz-Höhen aufsteigend — das sind die Layer-Grenzen.
  const levels = Array.from(new Set(contributions.filter(c => c > 0))).sort((a, b) => a - b)

  const layers: PotLayer[] = []
  let prev = 0
  for (const level of levels) {
    // Berechtigt für diesen Layer: jeder, der bis mindestens zur Layer-Höhe eingezahlt hat.
    const eligible: number[] = []
    for (let i = 0; i < contributions.length; i++) {
      if (contributions[i] >= level) eligible.push(i)
    }
    const amount = (level - prev) * eligible.length
    // Layer ohne Chip-Beitrag (z. B. doppelte Höhe) überspringen.
    if (amount > 0) layers.push({ amount, eligible })
    prev = level
  }

  return layers
}
