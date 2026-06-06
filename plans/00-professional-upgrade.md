# Workflow: poker-tracker → Professionelles Poker-Analyse-Tool

Erstellt: 2026-06-06  
Basis: Vollständiger Code-Audit aller Kernmodule (icm.ts, nashSolver.ts, equityTable.ts, equity.ts, handEval.ts, cards.ts, analytics.ts, alle Parser, SpotAnalyzer.tsx, pushFoldData.ts)

---

## Ziel

Ein Desktop-Tool das Profis vertrauen können:
- **Korrekte Mathematik** — keine Vereinfachungen die zu falschen Empfehlungen führen
- **Vollständige Parser** — kein Datenverlust bei Import
- **Professionelle Features** — Bankroll-Management, Leak-Finder, Range-Analyse
- **TOS-konform** — ausschließlich lokale Datei-Imports, kein Screen-Scraping, keine Echtzeit-Daten

---

## Audit-Ergebnisse: Bekannte Bugs & Lücken

### 🔴 Kritische Bugs (falsche Berechnungen)

| # | Datei | Zeile | Problem |
|---|-------|-------|---------|
| B1 | `nashSolver.ts` | ~158 | **P(Call) ignoriert Hero-Blocking** — dividiert durch 1326 (alle Villain-Combos) statt durch 1326 minus blockierte Combos durch Hero-Karten. Wenn Hero AA hält, sind Villain-AA-Combos unmöglich (0), aber voll gewichtet. |
| B2 | `equity.ts` | ~68–70 | **callFraction falsch** — `range.length` statt `range.reduce((s,r)=>s+r.weight,0)`. Ungewichtete Combo-Anzahl != gewichtete Calling-Frequenz. |
| B3 | `pokerstars-hh.ts` | ~131 | **3-Bet-Opportunity Timing** — `threeBetOpp` wird gesetzt *nachdem* Hero gehandelt hat, nicht *bevor*. Führt zu unter-gezählten 3-Bet-Opportunities. |
| B4 | `analytics.ts` | mehrere | **`resultKnown`-Filterung inkonsistent** — `bankrollSeries()`, `computeItmDepth()`, `groupBy()`-Calls filtern nicht selbst nach `resultKnown`. UI muss das sicherstellen, wird es aber nicht überall. |

### 🟡 Algorithmische Vereinfachungen (bekannte Abweichungen vom echten NE)

| # | Problem | Impact |
|---|---------|--------|
| A1 | **ABR ist kein echter Nash-Solver** — Alternating Best Response kann oszillieren statt zu konvergieren. Erzeugt Näherungs-Ranges, kein mathematisches Gleichgewicht. | Mittel — für Push/Fold-Spots meist gut genug, aber nicht exakt |
| A2 | **Hero-Blocking in `lookupEquityVsRange()`** — Equity gegen Range gewichtet alle 169 Villain-Hände gleich, unabhängig davon ob Hero-Karten Villain-Combos blockieren | Mittel — AK vs Range unterschätzt AA-Blocking |
| A3 | **Bubble Factors numerisch instabil bei kleinen Stacks** — `delta = max(1, floor(total * 0.001))` → bei 100-Chip-Stack delta=1, Quantisierungsfehler möglich | Niedrig |
| A4 | **Pot-Berechnung vereinfacht** — `pot = round(bbSize * 1.5) + ante * n` nimmt SB=0.5×BB an, korrekt für Standard-Spots, aber nicht für Straddle, Button-Ante etc. | Niedrig |

### 🟡 Parser-Lücken

| # | Parser | Problem |
|---|--------|---------|
| P1 | PokerStars Summary | **Kein Bounty/PKO-Parsing** — `bounty` bleibt immer 0 |
| P2 | PokerStars Summary | **Kein Rebuy/Addon-Parsing** aus Summary-Block (nur aus HH-Aggregat) |
| P3 | PokerStars HH | **Fehlende Stats**: kein CBet, kein Fold-to-Aggression, kein Position-Tracking |
| P4 | PokerStars HH | Hero-Name-Erkennung nicht robust gegen Sonderzeichen/Umlaute |
| P5 | GGPoker | Nur erste Bounty erfasst, mehrere Bounties gehen verloren |
| P6 | GGPoker | Nur PokerCraft-Export-Format; nativer GGPoker-Export nicht getestet |

---

## Phasierung

---

## Phase 1 — Kritische Bug-Fixes
**Ziel:** Alle bekannten falschen Berechnungen beseitigen  
**Aufwand:** 1–2 Sessions  
**Voraussetzungen:** Keine

### Tasks

#### 1.1 Hero-Blocking in P(Call) korrigieren
**Datei:** `src/renderer/src/lib/nashSolver.ts` ~L157–158

**Aktuell (falsch):**
```typescript
const callW = rangeWeight(callRange)
const pCall = Math.min(1, callW / totalCallCombos)  // totalCallCombos = 1326
```

**Korrekt:** `totalCallCombos` muss die durch Hero-Karten blockierten Combos abziehen.
- Hero hält 2 Karten → maximal 1326 - C(50,2) + C(48,2) Villain-Combos... nein:
- Hero hält Karte A und Karte B. Villain-Combos die A oder B enthalten sind unmöglich.
- Blockierte Combos: 2 × 51 − 1 = 101... Nein: jede Hero-Karte blockiert 51-Combos, aber Überlappung der beiden = 1 → 51+51-1 = 101 (nicht korrekt wenn pair)
- **Korrekte Formel:** `blocked = 2*51 - 1 = 101` wenn die beiden Hero-Karten verschieden sind. Bei Pocket Pair: `blocked = 2*51 - 1 = 101` (gleich).
- `availableCombos = 1326 - 101 = 1225`

Besser: `totalCallCombos` dynamisch aus Hero-Karten berechnen.

```typescript
// heroCards: [Card, Card] muss als NashInput-Feld ergänzt werden
function availableVillainCombos(heroCards: [Card, Card]): number {
  const [c1, c2] = heroCards
  // Combos aus 50 verbleibenden Karten
  return (50 * 49) / 2  // = 1225
}
```

> **Hinweis:** Wenn keine konkreten Hero-Karten bekannt (Range-Berechnung), bleibt 1326 als Näherung akzeptabel. Bei konkreter Hand-Analyse (SpotAnalyzer mit gewählter Hand) muss 1225 verwendet werden.

**Verifikation:** Push AAsss vs Call-Range: AA ist nicht in Call-Range möglich (blockiert). pCall muss niedriger sein als bei Hand ohne Blocker-Effekt.

---

#### 1.2 callFraction-Berechnung korrigieren
**Datei:** `src/renderer/src/lib/equity.ts` ~L68–70

**Aktuell (falsch):**
```typescript
const maxCombos = 1326 - 3 * 2
const weightedCombos = range.length  // <-- BUG: Anzahl Combos, nicht gewichtete Summe
const callFraction = Math.min(1, weightedCombos / maxCombos)
```

**Korrekt:**
```typescript
const weightedCombos = range.reduce((s, r) => s + r.weight, 0)
const callFraction = Math.min(1, weightedCombos / 1225)  // 1225 = 50 choose 2
```

**Verifikation:** `callFraction` bei leerer Range = 0; bei voller Range (alle 1326 Combos, gewichtet 1) ≈ 1.0.

---

#### 1.3 3-Bet-Opportunity Timing korrigieren
**Datei:** `src/main/parsers/pokerstars-hh.ts` ~L125–135

**Aktuell:** `threeBetOpp = 1` wird gesetzt wenn `raisesSeen >= 1` nach Hero-Aktion.

**Korrekt:** `threeBetOpp` muss gesetzt werden *bevor* Hero-Aktion evaluiert wird — nur wenn vor Heros Zug bereits ein Raise gesehen wurde.

**Verifikation:** In einer Hand wo Hero UTG raised und alle folden: 3BetOpp = 0 (kein vorheriger Raise). In einer Hand wo CO raised und Hero im BTN reraises: 3BetOpp = 1, 3Bet = 1.

---

#### 1.4 `resultKnown`-Filterung absichern
**Datei:** `src/renderer/src/lib/analytics.ts`

**Problem:** `bankrollSeries()`, `computeItmDepth()`, alle `byX()`-Funktionen erwarten bereits gefilterte Input, aber das ist nicht erzwungen.

**Fix:** Alle Money-relevanten Funktionen intern `withResults()` aufrufen (idempotent, da nur Filter):
```typescript
export function bankrollSeries(rows: Tournament[]): BankrollPoint[] {
  const res = withResults(rows)  // Sicherheitsnetz
  // ...
}
export function computeItmDepth(rows: Tournament[]): ItmTier[] {
  const res = withResults(rows)
  // ...
}
```

**Verifikation:** Import von Hand-History-only Records (resultKnown=false, payout=0) darf Bankroll-Chart nicht verändern.

---

### Verifikations-Checkliste Phase 1
- [ ] `npm run typecheck` fehlerfrei
- [ ] P(Call) bei AA-Push ist niedriger als bei random Hand (Blocker-Effekt)
- [ ] callFraction bei leerer Range = 0.0
- [ ] 3-Bet-Statistik nach HH-Import plausibel (< VPIP)
- [ ] HH-only Records erscheinen nicht in Bankroll-Chart oder ITM-Stats

---

## Phase 2 — Algorithmus-Verbesserungen
**Ziel:** Nash-Solver und Equity-Berechnungen näher an mathematisch korrekte Werte bringen  
**Aufwand:** 2–3 Sessions  
**Voraussetzungen:** Phase 1 abgeschlossen

### Tasks

#### 2.1 Hero-Blocking in `lookupEquityVsRange()` implementieren
**Datei:** `src/renderer/src/lib/equityTable.ts`

**Problem:** Wenn Hero AK hält, sollte `weight(AA)` in Villain-Range reduziert werden (Hero hält 1 Ass → nur noch 3 AA-Combos statt 6).

**Korrekte Gewichtung:**
```typescript
function adjustedWeight(handId: HandId, heroCards: [Card, Card]): number {
  const combos = handIdToCombos(handId)
  // Filtere Combos, die eine Hero-Karte enthalten
  const validCombos = combos.filter(
    ([a, b]) => a !== heroCards[0] && a !== heroCards[1] && b !== heroCards[0] && b !== heroCards[1]
  )
  return validCombos.length / combos.length  // Anteil verbleibender Combos
}
```

Neue Signatur: `lookupEquityVsRange(h: HandId, range: Map<HandId, number>, heroCards?: [Card, Card]): number`

**Impact:** AK vs Range mit vielen Assen-Combos: Equity erhöht sich (Hero blockiert starke Villain-Hände).

**Verifikation:** `lookupEquityVsRange('AKs', fullRange, [A♠, K♠])` > `lookupEquityVsRange('AKs', fullRange)` — Blocking erhöht Equity.

---

#### 2.2 Nash-Solver Konvergenz verbessern
**Datei:** `src/renderer/src/lib/nashSolver.ts`

**Option A (einfacher):** Damping einführen — statt harter 0/1-Entscheidungen: Mische neue Range mit vorheriger (Fictitious Play-Light):
```typescript
const dampingFactor = 0.7
newFreq = prevFreq * (1 - dampingFactor) + newFreq * dampingFactor
```
Reduziert Oszillation, bleibt ABR-basiert.

**Option B (korrekt):** Reines Regret-Minimization-Framework (CFR-artiger Ansatz für 2-Spieler 0-Summe). Aufwändiger, aber produziert echtes NE.

**Empfehlung:** Option A für Phase 2 (schnell umsetzbar, deutliche Verbesserung). Option B als separate Phase wenn gewünscht.

**Verifikation:** Solver bei `converged: false` nach 12 Iterationen — nach Fix sollte Konvergenz häufiger erreicht werden.

---

#### 2.3 Bubble Factors: Bessere numerische Ableitung
**Datei:** `src/renderer/src/lib/icm.ts` ~L63

**Aktuell:** `delta = max(1, floor(total * 0.001))` — zu grob bei kleinen Stacks.

**Fix:** Relative Delta + Symmetrische Ableitung sicherstellen:
```typescript
const delta = Math.max(10, Math.round(sum * 0.001))
// Sicherstellen dass delta <= min(stacks[i], stacks[j])
const safeDelta = Math.min(delta, Math.floor(stacks[i] * 0.5), Math.floor(stacks[j] * 0.5))
```

**Verifikation:** Bubble Factors bei sehr kurzen Stacks (100 Chips) sind stabil und > 0.

---

### Verifikations-Checkliste Phase 2
- [ ] `npm run typecheck` fehlerfrei
- [ ] Equity-Berechnung mit Blocker-Option: AK equity vs {AA,KK,QQ} ist höher mit heroCards=[A,K]
- [ ] Nash-Solver konvergiert häufiger (vergleiche `iterations` bei gleichen Inputs)
- [ ] Bubble Factors bei 100-Chip-Stacks stabil

---

## Phase 3 — Parser-Verbesserungen
**Ziel:** Vollständige Datenerfassung ohne Verluste  
**Aufwand:** 2–3 Sessions  
**Voraussetzungen:** Phase 1 abgeschlossen (Phase 2 optional)

### Tasks

#### 3.1 PokerStars Bounty/PKO-Parsing
**Datei:** `src/main/parsers/pokerstars.ts`  
**Shared Types:** `shared/types.ts` (ggf. `bounty` zu `Tournament` hinzufügen, falls nicht vorhanden)

PokerStars PKO-Format:
```
Total bounty collected: €12.50
```
oder in Rankings-Zeile:
```
1st Hero $25 + $12.50 bounty
```

**Implementierung:**
- Regex: `(?:total bounty collected|bounty)[:\s]+[$€£]?([\d.,]+)` (case-insensitive)
- Summe aller Bounty-Zahlungen in `tournament.bounty`
- `profit = payout + bounty - totalCost` für PKO-Events

> **TOS-Hinweis:** Nur lokale Datei-Parsing, keine Echtzeit-Daten. Vollständig TOS-konform.

**Verifikation:** PKO-Turnier importieren, `bounty`-Feld im TournamentTable sichtbar.

---

#### 3.2 PokerStars HH: Zusätzliche Stats
**Datei:** `src/main/parsers/pokerstars-hh.ts`

Neue HandStatsAgg-Felder (Erweiterung shared/types.ts):
```typescript
cbet: number           // Postflop: Hero raised as PFR and bet flop
foldToCbet: number     // Postflop: Hero folded to opponent cbet
foldToCbetOpp: number  // Postflop: opportunities to fold/call cbet
```

**Implementierung CBet:**
- `pfr=1` in Hand UND Hero eröffnet Wetten auf dem Flop → `cbet = 1`
- Sonst: `cbet = 0`

**Position-Tracking:**
Aus PokerStars HH Header: `Seat 6: HeroName (1500 in chips)` und `Seat 6 ist der Button/Dealer`.
- Button-Position aus `"Seat N is the button"` extrahieren
- Relative Position berechnen: BTN, CO, HJ, UTG etc.
- In `HandResult.position` speichern, aggregieren via `byPosition`-Breakdown

**Verifikation:** VPIP by position zeigt statistisch sinnvolle Unterschiede (BTN > UTG).

---

#### 3.3 GGPoker: Mehrfach-Bounties
**Datei:** `src/main/parsers/ggpoker.ts` ~L123

**Fix:** Alle Bounty-Matches summieren statt nur ersten:
```typescript
const bountyMatches = block.matchAll(/bount(?:y|ies)[^$€£₹\n]*T?[$€£₹]([\d.,]+)/gi)
const bounty = [...bountyMatches].reduce((s, m) => s + num(m[1]), 0)
```

---

### Verifikations-Checkliste Phase 3
- [ ] `npm run typecheck` fehlerfrei
- [ ] PKO-Turnier: `bounty > 0` nach Import
- [ ] HH-Import: CBet%-Rate vorhanden und plausibel (20–70%)
- [ ] GGPoker: Mehrfach-Bounties werden summiert

---

## Phase 4 — Professionelle Features
**Ziel:** Tool-Set das echte Poker-Pros nutzen würden  
**Aufwand:** 4–6 Sessions  
**Voraussetzungen:** Phasen 1–3 abgeschlossen

### 4.1 Bankroll-Management-Modul

**Neue Tab: "Bankroll"** (neben Dashboard und ICM-Analyse)

Features:
- **Stop-Loss-Tracker:** Tagesgrenze und Sessiongrenze konfigurierbar (in €, gespeichert in AppSettings)
- **Reload-Point-Kalkulation:** "Bei welchem Bankroll-Stand sollte ich Buy-In-Level wechseln?" — Regel: 100 Buy-Ins für Spin, 50 für SNG, 20 für MTT
- **Varianz-Simulation:** Monte-Carlo auf Basis eigener ROI/Standardabweichung — "Wie groß ist die Wahrscheinlichkeit eines X%-Drawdowns über N Turniere?"
- **ROI-Konfidenzintervall:** `roi ± 1.96 × sqrt(roi*(1-roi)/n)` — zeigt wie viele Turniere für statistisch signifikante ROI nötig

**Komponenten:** `BankrollTab.tsx`, `VarianceSimulator.tsx`, `BankrollSettings.tsx`

**IPC-Kanäle:** Keine neuen — nutzt existierende `settings:get/update` und `tournaments:get`

---

### 4.2 Leak-Finder

**Neue Sektion im Dashboard: "Leak-Analyse"**

Algorithmik:
- **Vergleich mit Heuristiken:** VPIP 20–28% (SNG optimal), PFR > VPIP/2, 3-Bet 4–8%
- **Regressions-Analyse:** Korrelation zwischen VPIP und ROI über Zeitfenster
- **Auffälligkeiten erkennen:** Statistisch signifikante Abweichungen von eigenen Referenz-Werten

Konkrete Checks (mit Ampel-Status):
| Leak | Grenzwert | Berechnung |
|------|-----------|------------|
| VPIP zu hoch | > 30% | aus PlayStyle |
| PFR/VPIP-Ratio zu niedrig | < 0.5 | deutet auf zu passives Spiel hin |
| 3-Bet zu selten | < 3% | unter-3-bettet präflop |
| WTSD zu hoch | > 30% | geht zu oft zum Showdown |
| Won@SD zu niedrig | < 50% | verliert zu oft am Showdown |

**Komponente:** `LeakFinder.tsx` — zeigt Ampel-Grid + Erklärungstext auf Deutsch

---

### 4.3 Range-Visualisierung verbessern

**In SpotAnalyzer:**
- **Combo-Count-Overlay:** Zeigt wie viele Combos in Push/Call-Range (z.B. "Push: 234/1326 Combos, 17.7%")
- **Range vs Range Equity-Matrix:** 3×3-Heatmap (Pocket Pairs / Suited Connectors / Broadways) — zeigt durchschnittliche Equity je Kategoriengruppe
- **Export als PNG:** Canvas-Render der Hand-Grid für Notizen/Coaching

**Implementierung:** HTML5 Canvas oder SVG-Export; kein externer Service (TOS-konform).

---

### 4.4 Session-Notizen

**Lightweight Journal** — pro Spieltag / Import-Batch:
- Freitext-Notiz (Textfeld)
- Tags (z.B. "tilt", "gute Session", "schlechte Entscheidung")
- Persistent in `poker-data.json` als `sessions[]`

**Nutzen:** Hilft Spielern, emotionale/technische Ursachen von schlechten Sessions zu identifizieren.

---

### 4.5 CSV-Export

**Toolbar-Button "Exportieren":**
- Tournament-Tabelle als CSV
- Analytics-Summary als CSV
- Format: Standard Excel-kompatibel (Semikolon-Trennzeichen, UTF-8 BOM)

**IPC-Kanal:** `data:export-csv` → `ipcMain` schreibt Datei via `dialog.showSaveDialog`

---

### Verifikations-Checkliste Phase 4
- [ ] `npm run typecheck` fehlerfrei
- [ ] Bankroll-Tab: Varianz-Simulation mit 1000 Iterationen < 2s
- [ ] Leak-Finder: Ampel-Status korrekt bei bekannten Grenzwerten
- [ ] Range-Export funktioniert (PNG nicht leer)
- [ ] CSV-Export: Excel öffnet Datei korrekt (Encoding, Trennzeichen)

---

## Phase 5 — Tech-Stack-Optimierungen (Optional/Bedarfsabhängig)
**Ziel:** Performance und Datenverwaltung auf professionellem Niveau  
**Aufwand:** 3–5 Sessions  
**Voraussetzungen:** Phasen 1–4 abgeschlossen; nur wenn Probleme auftreten

### 5.1 Web Worker für Nash-Solver und Equity-Precomputation

**Problem:** Nash-Solver blockiert UI-Thread für 15–30s bei kaltem Cache.

**Fix:** `nashSolver.ts` und `equityTable.ts` in einen Web Worker auslagern:
- `renderer/worker/solver.worker.ts`
- Kommunikation via `postMessage` mit Fortschritts-Callbacks
- PrecomputeBanner nutzt Worker-Progress-Events

**Tech:** Electron + Vite unterstützen Web Workers via `new Worker(new URL('./worker.ts', import.meta.url))`

### 5.2 SQLite statt JSON (bei > 10.000 Turnieren)

**Problem:** JSON-Datei wird bei tausenden Turnieren langsam zu laden/schreiben.

**Evaluierung:** Bei < 5000 Turnieren ist JSON performant genug. Migration nur bei echtem Performance-Problem.

**Stack-Option:** `better-sqlite3` (synchrone SQLite-Bindings für Electron Main Process)

### 5.3 Lookup-Table Hand-Evaluator (optional)

**Aktuell:** `eval7()` berechnet alle 21 fünf-Karten-Kombinationen per Hand.
**Alternative:** Pre-computed 7-card lookup table (Cactus Kev / OMPEval-Stil) — ~100MB RAM, O(1) statt O(21).

**Empfehlung:** Erst evaluieren ob aktueller Evaluator Performance-Bottleneck ist. Wahrscheinlich nicht.

---

## CLAUDE.md — Pflegehinweise

Bei jeder Phase: CLAUDE.md aktualisieren wenn sich folgendes ändert:
- Neue IPC-Kanäle → Tabelle in "IPC channels"
- Neue shared/types.ts Felder → "Data model"
- Neue Lib-Module → "Analytics" oder neue Sektion
- Neue Komponenten → "UI components"

Neue Einträge für CLAUDE.md nach Phase 1–2:
- `nashSolver.ts`: `heroCards?: [Card, Card]` in `NashInput` (optionales Blocking-Feld)
- `equityTable.ts`: `lookupEquityVsRange(h, range, heroCards?)` — neues optionales Param
- `analytics.ts`: Alle Money-Funktionen rufen intern `withResults()` auf

---

## Technische Randbedingungen

- **TOS PokerStars/GGPoker:** Ausschließlich Import von lokal gespeicherten Dateien (Hand Histories, Tournament Summaries, PokerCraft-ZIPs). Kein automatisiertes Herunterladen, kein Screen-Scraping, keine Echtzeit-Verbindung zur Plattform.
- **Keine Bots:** Kein Code der automatisch am Tisch Aktionen ausführt oder empfiehlt (in Echtzeit). Das Tool analysiert vergangene Hands.
- **Datenschutz:** Alle Daten bleiben lokal (`userData`-Ordner). Kein Cloud-Upload.
- **Sprache:** Alle UI-Strings formelles Deutsch, keine Umgangssprache.

---

## Ausführungsreihenfolge (empfohlen)

```
Phase 1 (Bugs)      → Phase 2 (Algorithmen) → Phase 3 (Parser)
      ↓
Phase 4 (Features)  → Phase 5 (Tech, optional)
```

Jede Phase ist eigenständig und kann in einem neuen Chat-Kontext gestartet werden.  
Vor jeder Phase: relevante Dateien lesen + CLAUDE.md konsultieren.

---

## Referenzen für korrekte Mathematik

- **ICM Malmuth-Harville:** Mason Malmuth "Poker Essays" + Bill Chen/Jerrod Ankenman "The Mathematics of Poker"
- **Nash Push/Fold:** Jam-or-Fold Charts (Holdem Resources Calculator als Referenz)
- **Hero Blocking:** "Combinatorics in Poker" — Hand-Combos mit Dead Cards
- **VPIP/PFR/3-Bet Definitionen:** PokerTracker 4 / Hold'em Manager Standard-Definitionen
- **Bankroll Management:** Kelly Criterion für Poker (Semikolon-Anpassung für Turniere)
