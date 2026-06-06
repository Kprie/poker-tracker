# B6: Chip-erhaltendes, voll-multiway-exaktes Push/Fold-EV-Modell

Erstellt: 2026-06-06
Status: **Plan** (noch kein Code — vom Nutzer so gewünscht)
Scope-Entscheidung des Nutzers: **voll multiway exakt** (nicht nur HU)

---

## 1. Problem & Evidenz

`computeIcmDeltas` (nashSolver.ts) und `computeIcmScenarios` (equity.ts) sind **nicht chip-erhaltend**:

```typescript
// nashSolver.ts — Win-Pot-Szenario
const pot = Math.round(bbSize * 1.5) + ante * n
sWinPot[heroIdx] += pot          // ❌ Hero bekommt vollen Pot …
                                 // … aber kein Spieler verliert diese Chips → Chips aus dem Nichts
// Win-Call / Lose-Call
sWinCall[heroIdx] = stacks[heroIdx] + eff + pot   // ❌ +pot zusätzlich zum eff-Swap
sWinCall[callerIdx] = Math.max(0, stacks[callerIdx] - eff)
```

**Folge:** Die Gesamt-Chipmenge steigt nach jedem Szenario, die Fold-Equity wird aufgebläht. Verifiziert: Solver pusht bei **10bb HU SB 100% der Hände**.

**Referenz-Sollwerte (Nash):** HU 10bb SB-Push ≈ **55%** der Hände, BB-Call ≈ **40%** (Quellen unten). Die 100% sind eindeutig falsch.

**Grundprinzip (bestätigt durch Recherche):** Tournament-EV wird in **ICM-$ über die resultierenden Chip-Konfigurationen** gemessen — nicht in cEV. Jede Terminal-Config muss chip-erhaltend sein (Σ Stacks = const), dann ICM darauf auswerten und über Ausgangswahrscheinlichkeiten mitteln.

---

## 2. Korrektes Modell

### 2.1 Chip-Buchhaltung (Invariante: Σ Stacks = T konstant)

Eingangs-Stacks `S_i` = Chips zu Hand-Beginn **vor** Blind/Ante-Posting. Definiere:

| Größe | Bedeutung |
|-------|-----------|
| `post_i` | von Spieler i gepostete Chips (SB-Blind, BB-Blind, Ante je nach Format) |
| `pot0 = Σ post_i` | Dead Money vor Aktion |
| `behind_i = S_i − post_i` | Chips vor dem Spieler (noch nicht im Pot) |

> **Anti-Pattern:** Niemals `+pot` auf den Gewinner addieren ohne die Beiträge der anderen abzuziehen. Der Pot **besteht** bereits aus `post_i` der Spieler — er ist Teil von T, kein neues Geld.

### 2.2 EV-Prinzip

Entscheidung: **shove**, wenn `EV_ICM(shove) > EV_ICM(fold)`.
Beide Seiten = `Σ_outcomes P(outcome) · ICM(config_outcome)[heroIdx]`, ICM = Malmuth-Harville (icm.ts, korrekt).

### 2.3 Fold-Knoten (Hero foldet)

Hero gibt seine bereits geposteten Chips auf; sein Stack = `S_hero − post_hero`.
Das Dead Money `pot0` geht an die verbleibende Blind-/Push-Fold-Auseinandersetzung der Spieler hinter Hero.

- **HU (Hero = SB):** Fold → SB verliert 0.5bb, BB gewinnt 0.5bb. Config: `[S_sb − 0.5bb, S_bb + 0.5bb]`. Chip-erhaltend. ✓
- **Multiway (Hero = BTN/CO/…, Blinds dahinter):** Hero foldet → der Subgame-Baum (SB vs BB push/fold) läuft weiter. Für **voll exakt** muss dieser Rest-Baum modelliert werden (rekursiv kleinerer Spot). Pragmatische, dokumentierte Näherung als Phase-Zwischenstand: Rest-Spieler behalten ihre Posts (kein weiteres Spiel) — als bewusste Vereinfachung markieren, in der finalen Phase durch echten Rest-Baum ersetzen.

### 2.4 Shove-Knoten, multiway (der Kern)

Hero shoved `S_hero` all-in. Verbleibende Spieler entscheiden **sequenziell** call/fold gemäß ihrer Nash-Frequenz. Sei `C ⊆ {Spieler hinter Hero}` die Caller-Menge mit
`P(C) = Π_{j∈C} freq_call(j) · Π_{k∉C} (1 − freq_call(k))`.

Für jede Caller-Menge `C`:

1. **Side-Pots bilden.** All-in-Spieler = `{hero} ∪ C`. Nach Stackgröße sortieren; geschichtete Pots: Layer ℓ enthält `min`-Beiträge aller noch beteiligten Spieler. (Standard-Side-Pot-Algorithmus.)
2. **Showdown via Multiway-Equity (MC über Boards).** Für jedes Board-Sample: alle All-in-Hände mit `eval7` ranken; jeden Pot-Layer an die beste **berechtigte** Hand vergeben.
3. **Resultierende Chip-Config je Sample** → `ICM(config)[hero]`. Über Samples mitteln (ICM ist nichtlinear → ICM **pro Sample**, dann Mittelwert; nicht erst Chips mitteln).

```
EV_shove(hero) = Σ_C P(C) · ( 1/N Σ_{board} ICM(config(C, board))[hero] )
```

Das ist exakt (MC-geschätzt). Nicht-all-in-Spieler (gefoldet) behalten `S_k − post_k`.

---

## 3. Phasierung

### Phase B6.1 — Chip-erhaltendes **HU**-Modell (exakt, verifizierbar)
- `computeIcmDeltas`/`computeIcmScenarios` durch chip-erhaltende Varianten ersetzen für n=2.
- Fold: `[S_sb − 0.5bb, S_bb + 0.5bb]`. Shove+Fold: `[S_sb + bb, S_bb − bb]` (Hero gewinnt BB des Villains; chip-erhaltend). Shove+Call+Win/Lose: effektiver Stack-Swap **ohne** doppelten `+pot`.
- Ante korrekt: bei Ante posten beide; Pot = Blinds + Antes; Gewinner nimmt Pot chip-erhaltend.
- **Verifikation:** Solver bei 10bb HU SB → Push-Range **50–60%** (Ziel ~55%), BB-Call **35–45%** (Ziel ~40%). Spot-Check: AA/KK push, 72o/82o/92o fold.

### Phase B6.2 — Multiway-Equity-Engine
- Neue Funktion `multiwayEquities(hands: [Card,Card][], board?, iterations): { wins:number[], pots:... }` — pro Board-Sample alle Hände ranken, Platzierungen/Pot-Berechtigung zurückgeben.
- Baut auf `eval7` (handEval.ts, verifiziert korrekt) auf.
- **Verifikation:** 3-way AA vs KK vs QQ Equities gegen bekannte Werte (~66/19/15% grob); Summe = 100%.

### Phase B6.3 — Side-Pot-Konstruktion + ICM-über-Ausgänge
- `buildSidePots(allInStacks: number[]): PotLayer[]` (Standard-Algorithmus, mit Tests gegen Lehrbuch-Beispiele ungleicher Stacks).
- `evShoveMultiway(...)` = Caller-Set-Enumeration × Side-Pots × MC-Boards × ICM-pro-Sample.
- **Verifikation:** Chip-Erhaltung pro Sample asserten (Σ resultierende Stacks == T). 3-handed Spot gegen ICMIZER/HRC-Referenz (falls verfügbar) oder Plausibilität.

### Phase B6.4 — Integration in Nash-Solver (multiway) + Performance
- Solver-Schleife nutzt `evShoveMultiway` statt der HU-Deltas; jeder Gegner mit eigener Call-Frequenz; sequenzielle Positionslogik.
- **Fold-Rest-Baum** (2.3 multiway) korrekt modellieren (rekursiver kleinerer Push/Fold-Spot) → ersetzt die Phase-B6.1-Näherung.
- **Performance:** MC-Boards + ICM-pro-Sample in der 169×Iterationen-Schleife ist teuer. Maßnahmen:
  - Multiway-Equities cachen (analog equityTable).
  - Caller-Sets beschränken (in der Praxis dominiert 0–1 Caller; 2+ selten).
  - Ggf. Web Worker (siehe Plan 00, Phase 5.1) wegen Laufzeit.
- **Verifikation:** 3-/4-handed BTN-Push-Ranges plausibel enger als HU; Laufzeit dokumentieren.

---

## 4. Verifikations-Sollwerte (für scripts/verify-nash.mjs erweitern)

| Spot | Soll |
|------|------|
| HU 10bb SB Push | ~55% (50–60%) der 169 Hände |
| HU 10bb BB Call | ~40% (35–45%) |
| HU 15bb SB Push | enger als 10bb |
| HU 5bb SB Push | weiter (~80%+) |
| Chip-Erhaltung | Σ resultierende Stacks == Σ Eingangs-Stacks (jede Config, jedes Sample) |
| Monotonie | stärkere Hand ⇒ ≥ EV der schwächeren im selben Spot |

---

## 5. Anti-Patterns (nicht tun)

- ❌ `+pot` auf den Gewinner ohne Gegenbuchung (der ursprüngliche Bug).
- ❌ cEV statt ICM-$ vergleichen.
- ❌ Erwartete Chips mitteln und **dann** ICM (ICM ist nichtlinear → ICM pro Ausgang, dann mitteln).
- ❌ Blinds doppelt zählen (Pot besteht bereits aus den Posts).
- ❌ Multiway als Summe von HU-Duellen nähern, wo Side-Pots/Platzierungen nötig sind.
- ❌ Bei Bugfix die `STORAGE_KEY`-Cache-Version vergessen, falls Equity-Caching berührt wird.

---

## 6. Berührte Dateien

| Datei | Änderung |
|-------|----------|
| `src/renderer/src/lib/nashSolver.ts` | `computeIcmDeltas` → chip-erhaltend; Solver-Schleife multiway |
| `src/renderer/src/lib/equity.ts` | `computeIcmScenarios` → chip-erhaltend; `multiwayEquities`, `buildSidePots` |
| `src/renderer/src/lib/icm.ts` | unverändert (Malmuth-Harville korrekt) — nur Aufrufer |
| `scripts/verify-nash.mjs` | Sollwerte aus §4 ergänzen |
| `CLAUDE.md` | B6 von 🔴 offen auf ✅ + Modellbeschreibung |

---

## 7. Quellen

- [GTO Wizard — ICM Basics](https://blog.gtowizard.com/icm-basics/) — Risk Premium, $EV vs cEV
- [FlopTurnRiver — Tournament EV Calculations](https://flopturnriver.com/poker-strategy/ev-calculations-tutorial-5-tournament-calculations-20640/) — EV = Σ ICM-Equity × Wahrscheinlichkeit über Ausgänge
- [Upswing — Push/Fold Charts](https://upswingpoker.com/push-fold-tournament-strategy-charts/) & [PokerCoaching — Push/Fold Charts](https://pokercoaching.com/push-fold-charts/) — HU 10bb SB-Push ~55%, BB-Call ~40%
- [Pokerenergy — Simple 3-Way](https://pokerenergy.net/edu/item/3way-review) — Multiway-Solver-Komplexität, Side-Pots, nicht-zero-sum
