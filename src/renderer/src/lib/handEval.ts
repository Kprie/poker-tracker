// Karten-Encoding: card = rank*4+suit, rank 0=2..12=A, suit 0..3

const B  = 13
const T  = 371293  // 13^5 — Kategorie-Trenner

/**
 * Bewertet 5 Karten ohne Array-Allokation (Sorting Network + reine Integer-Arithmetik).
 * Ca. 3–8× schneller als die array-basierte Vorgänger-Version.
 */
export function eval5(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  // ── Ränge extrahieren ──────────────────────────────────────────────────────
  let r0 = c0 >> 2, r1 = c1 >> 2, r2 = c2 >> 2, r3 = c3 >> 2, r4 = c4 >> 2

  // ── Absteigende Sortierung ohne Array (Sorting Network, 9 Vergleiche) ──────
  let t: number
  if (r0 < r1) { t = r0; r0 = r1; r1 = t }
  if (r2 < r3) { t = r2; r2 = r3; r3 = t }
  if (r0 < r2) { t = r0; r0 = r2; r2 = t }
  if (r1 < r3) { t = r1; r1 = r3; r3 = t }
  if (r1 < r2) { t = r1; r1 = r2; r2 = t }
  // r4 einsortiern (Insertion)
  if (r4 > r0)        { t = r4; r4 = r3; r3 = r2; r2 = r1; r1 = r0; r0 = t }
  else if (r4 > r1)   { t = r4; r4 = r3; r3 = r2; r2 = r1; r1 = t }
  else if (r4 > r2)   { t = r4; r4 = r3; r3 = r2; r2 = t }
  else if (r4 > r3)   { t = r4; r4 = r3; r3 = t }
  // jetzt: r0 >= r1 >= r2 >= r3 >= r4

  // ── Flush-Check ────────────────────────────────────────────────────────────
  const isFlush = (c0 & 3) === (c1 & 3) && (c1 & 3) === (c2 & 3) && (c2 & 3) === (c3 & 3) && (c3 & 3) === (c4 & 3)

  // ── Straight-Erkennung ─────────────────────────────────────────────────────
  const strHigh = (r0 - r4 === 4 && r0 !== r1)    // 5 verschiedene & Range=4 → Straight
    ? r0
    : (r0 === 12 && r1 === 3 && r2 === 2 && r3 === 1 && r4 === 0)  // Wheel A-2-3-4-5
      ? 3 : -1

  // ── Duplikat-Muster (funktioniert da Array sortiert ist) ───────────────────
  const d01 = r0 === r1 ? 1 : 0
  const d12 = r1 === r2 ? 1 : 0
  const d23 = r2 === r3 ? 1 : 0
  const d34 = r3 === r4 ? 1 : 0
  const dups = d01 + d12 + d23 + d34

  // ── Hand-Bewertung ─────────────────────────────────────────────────────────

  if (dups === 0) {
    if (isFlush && strHigh >= 0)  return 8 * T + strHigh                                     // Straight Flush
    if (isFlush)                  return 5 * T + r0 * 28561 + r1 * 2197 + r2 * 169 + r3 * B + r4  // Flush
    if (strHigh >= 0)             return 4 * T + strHigh                                      // Straight
    return r0 * 28561 + r1 * 2197 + r2 * 169 + r3 * B + r4                                  // High Card
  }

  if (dups === 1) {
    // Ein Paar — Paar-Rang und Kicker bestimmen
    if (d01) return 1 * T + r0 * 2197 + r2 * 169 + r3 * B + r4   // Paar r0, Kicker r2,r3,r4
    if (d12) return 1 * T + r1 * 2197 + r0 * 169 + r3 * B + r4   // Paar r1
    if (d23) return 1 * T + r2 * 2197 + r0 * 169 + r1 * B + r4   // Paar r2
             return 1 * T + r3 * 2197 + r0 * 169 + r1 * B + r2   // Paar r3
  }

  if (dups === 2) {
    // Drilling oder zwei Paare
    if (d01 && d12) return 3 * T + r0 * 169 + r3 * B + r4         // Drilling r0
    if (d12 && d23) return 3 * T + r1 * 169 + r0 * B + r4         // Drilling r1
    if (d23 && d34) return 3 * T + r2 * 169 + r0 * B + r1         // Drilling r2
    // Zwei Paare
    if (d01 && d23) return 2 * T + r0 * 169 + r2 * B + r4         // Zwei Paare r0,r2 Kicker r4
    if (d01 && d34) return 2 * T + r0 * 169 + r3 * B + r2         // Zwei Paare r0,r3 Kicker r2
                    return 2 * T + r1 * 169 + r3 * B + r0         // Zwei Paare r1,r3 Kicker r0 (d12+d34)
  }

  if (dups === 3) {
    if (d01 && d12 && d23) return 7 * T + r0 * B + r4             // Vierling r0
    if (d12 && d23 && d34) return 7 * T + r1 * B + r0             // Vierling r1
    if (d01 && d12)        return 6 * T + r0 * B + r3             // Full House Drilling r0, Paar r3
                            return 6 * T + r2 * B + r0             // Full House Drilling r2, Paar r0 (d23+d34+d01)
  }

  return 0  // rechnerisch unerreichbar
}

/**
 * Beste 5 aus 7 Karten (Texas Hold'em). Testet alle C(7,5)=21 Kombinationen.
 */
export function eval7(c: readonly number[]): number {
  let best = -1
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      let k = 0
      let a = 0, b = 0, cc = 0, d = 0, e = 0
      for (let m = 0; m < 7; m++) {
        if (m === i || m === j) continue
        switch (k++) {
          case 0: a = c[m]; break
          case 1: b = c[m]; break
          case 2: cc = c[m]; break
          case 3: d = c[m]; break
          default: e = c[m]
        }
      }
      const s = eval5(a, b, cc, d, e)
      if (s > best) best = s
    }
  }
  return best
}

/** Wrapper-Überladung für Array-Input (Kompatibilität mit bestehendem Code). */
export function eval7arr(cards: readonly number[]): number {
  return eval7(cards)
}
