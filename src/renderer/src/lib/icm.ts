export type EvMode = 'icm_pct' | 'icm_usd' | 'chip_ev' | 'chip_bb'

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

/**
 * Berechnet ICM-Equity nach Malmuth-Harville (rekursiv).
 * Laufzeit O(n! / (n-m)!) — für ≤10 Spieler und ≤5 bezahlte Plätze schnell genug.
 */
export function computeIcmEquities(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length
  const m = Math.min(payouts.length, n)
  const equity = new Array<number>(n).fill(0)

  // Ausgeschiedene Spieler (0 Chips) können keinen Platz mehr gewinnen — sie belegen
  // die untersten Plätze. Ohne diese Behandlung bräche die Rekursion bei einem
  // 0-Stack ab und gäbe dem Spieler 0 statt seiner tatsächlichen (niedrigsten)
  // Auszahlung (z. B. 2. Platz im HU-All-in). Nur lebende Spieler gehen in die
  // Malmuth-Harville-Rekursion ein.
  const alive: number[] = []
  const busted: number[] = []
  for (let i = 0; i < n; i++) (stacks[i] > 0 ? alive : busted).push(i)

  const aliveDepth = Math.min(payouts.length, alive.length)

  function recurse(remaining: number[], depth: number, prob: number): void {
    if (depth >= aliveDepth || remaining.length === 0) return
    const total = sum(remaining.map(i => stacks[i]))
    if (total === 0) return
    for (const i of remaining) {
      const p = stacks[i] / total
      equity[i] += prob * p * payouts[depth]
      recurse(remaining.filter(j => j !== i), depth + 1, prob * p)
    }
  }

  recurse(alive.slice(), 0, 1)

  // Ausgeschiedene teilen sich die verbleibenden (untersten) Auszahlungsplätze.
  if (busted.length > 0) {
    let rem = 0
    for (let place = alive.length; place < m; place++) rem += payouts[place]
    const share = rem / busted.length
    for (const i of busted) equity[i] = share
  }

  return equity
}

/**
 * Liefert pro Spieler und Auszahlungsposition den Equity-Beitrag dieser Position.
 * result[player][positionIndex] = Equity-Anteil aus Platz (positionIndex+1).
 * Summe je Spieler = computeIcmEquities(stacks, payouts)[player].
 */
export function computePositionEquities(stacks: number[], payouts: number[]): number[][] {
  const n = stacks.length
  const m = Math.min(payouts.length, n)
  const posEq: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(0))

  function recurse(remaining: number[], depth: number, prob: number): void {
    if (depth >= m || remaining.length === 0) return
    const total = sum(remaining.map(i => stacks[i]))
    if (total === 0) return
    for (const i of remaining) {
      const p = stacks[i] / total
      posEq[i][depth] += prob * p * payouts[depth]
      recurse(remaining.filter(j => j !== i), depth + 1, prob * p)
    }
  }

  recurse(Array.from({ length: n }, (_, i) => i), 0, 1)
  return posEq
}

/**
 * Bubble Factor BF[i][j]: wie viel stärker 1 Chip Verlust gegen Spieler j für Spieler i
 * wiegt als 1 Chip Gewinn gegen j. BF > 1 = Verlust wiegt mehr als Gewinn.
 * Diagonale = NaN.
 */
export function computeBubbleFactors(stacks: number[], payouts: number[]): number[][] {
  const n = stacks.length
  const totalChips = sum(stacks)
  const baseEquities = computeIcmEquities(stacks, payouts)
  const bf: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(NaN))

  // Feineres Basis-Delta (0.05 % der Chips) für eine genauere numerische Ableitung.
  const baseDelta = Math.max(1, Math.round(totalChips * 0.0005))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue

      // Symmetrisches Delta: darf weder Stack i noch Stack j ins Negative ziehen,
      // damit Gewinn- und Verlust-Szenario mit identischer Schrittweite gemessen werden.
      const delta = Math.min(baseDelta, Math.floor(stacks[i] / 2), Math.floor(stacks[j] / 2))
      if (delta < 1) {
        bf[i][j] = Infinity
        continue
      }

      const sw = [...stacks]
      sw[i] += delta
      sw[j] -= delta
      const gain = computeIcmEquities(sw, payouts)[i] - baseEquities[i]

      const sl = [...stacks]
      sl[i] -= delta
      sl[j] += delta
      const loss = baseEquities[i] - computeIcmEquities(sl, payouts)[i]

      bf[i][j] = gain > 0 ? loss / gain : Infinity
    }
  }
  return bf
}

/**
 * Wandelt rohe ICM-Equities in den gewünschten Anzeigemodus um.
 */
export function convertEquities(
  equities: number[],
  stacks: number[],
  payouts: number[],
  mode: EvMode,
  bbSize?: number,
): { values: number[]; unit: string } {
  const totalPayout = sum(payouts)
  const totalChips = sum(stacks)

  switch (mode) {
    case 'icm_usd':
      return { values: equities, unit: '€' }

    case 'icm_pct':
      return {
        values: equities.map(e => (totalPayout > 0 ? (e / totalPayout) * 100 : 0)),
        unit: '%',
      }

    case 'chip_ev':
      return {
        values: stacks.map(s => (totalChips > 0 ? (s / totalChips) * totalPayout : 0)),
        unit: '€ (Chip EV)',
      }

    case 'chip_bb':
      return {
        values: stacks.map(s => (bbSize && bbSize > 0 ? s / bbSize : s)),
        unit: 'BB',
      }
  }
}
