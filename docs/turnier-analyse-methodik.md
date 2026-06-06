# Turnier-Analyse — Methodik & Annahmen

Version 1.0 · Stand 2026-06 · Scope: **ausschließlich Turnierpoker**

Dieses Dokument beschreibt, **was das Tool tatsächlich berechnet**, mit welchen
Annahmen und Grenzen. Jede Auswertung ist modellabhängig und gilt nur für
abgeschlossene oder hypothetische Spots. Status-Legende: ✅ umgesetzt · 🔶 teilweise · 🚧 geplant · ⛔ bewusst nicht.

---

## 1. Scope

| Unterstützt | Nicht im Scope |
|---|---|
| MTT, SNG, Satellite, PKO, Final Table | Cashgame, Rake-Optimierung |
| abgeschlossene/hypothetische Turnierspots | Live-/Echtzeit-Entscheidungen |
| Preflop Push/Fold (HU + Multiway, ICM-exakt) | Postflop-GTO-Solver, Bet-Trees, Nodelocking ⛔ |
| eigene, rechtmäßig verfügbare Hand-Histories | fremde/geminte Daten, Playerpools |

Cashgame und Rake sind bewusst ausgeschlossen.

## 2. Zentrale Größen

- **Chip-EV** — Bewertung in Chips. Im Turnier *nicht* linear in Geld.
- **ICM-$EV** — Prizepool-Equity (Malmuth-Harville). Eine Entscheidung kann Chip-EV-positiv und ICM-$EV-negativ sein.
- **Risk Premium** — zusätzliche Equity über den Chip-Breakeven hinaus, um ein All-in zu callen.
- **Bubble Factor** — `$-Verlust / $-Gewinn`; je höher, desto vorsichtiger.
- **Ticket-EV** — im Satellite zählt nur das Erreichen eines Tickets (gleiche Auszahlungen).
- **Bounty-EV** — im PKO zusätzlicher Wert durch Eliminierung gedeckter Gegner.

## 3. Formeln (verwendete Konventionen)

- **Pot Odds:** benötigte Equity = `Callbetrag / (Pot nach Call)`. Bsp.: Pot 150 (inkl. Villain-Bet 50), Call 50 → 50/200 = **25 %**. Verglichen wird die **realisierte** Equity, nicht die Roh-Equity.
- **Call-EV (Chip):** `E · (Pot nach Call) − Callbetrag` — „Pot nach Call" enthält Heros Call.
- **Bet-/Jam-EV (Chip):** `F·P + (1−F)·[E·(P+B+C) − B]`, mit F = Foldfrequenz, P = Pot vor Bet, B = Heros Bet, C = Callbetrag, E = Equity bei Call. **Wichtig:** der eigene Bet `B` wird bei Call **unkonditional** investiert (`− B`, nicht `−(1−F)·B` und nicht `−(1−E)·B`).
- **Break-even-Foldfrequenz:** `B / (B + P)`. Bsp.: Pot 100, Bet 50 → 33,3 %.
- **Benötigte Call-Equity unter ICM:** `BF / (1 + BF)` (Risk Premium = davon − 50 %). Näherung für symmetrisches Doppeln-oder-Bust.

## 4. Module (Ist-Stand)

| Modul | Status | Methode / Annahme |
|---|---|---|
| ICM-Equity-Rechner | ✅ | Malmuth-Harville; ausgeschiedene 0-Stacks erhalten unterste Auszahlung |
| Bubble-Factor-Matrix | ✅ | symmetrische finite Differenz |
| Risk-Premium-Matrix | ✅ | `BF/(1+BF)` aus den Bubble-Faktoren |
| Ladder / Chip-EV-vs-ICM | ✅ | Positions-Equity-Beiträge |
| Deal & Satellite | ✅ | Chip-Chop (Mindestplatz + Rest nach Chips) vs. ICM-Chop; Satellite-Lock ≥95 % |
| Hand-Analyse | ✅ | exakte Equity + Outs (River/Turn/Flop exakt, Preflop MC), ICM-Szenarien |
| Equity-Labor (Multiway) | ✅ | 2–4 Hände + Board: Equity, Handklassen-Verteilung, Draws |
| Spot-Analyse (Push/Fold) | ✅ | HU chip-erhaltend exakt; Multiway-exakt mit Side-Pots im Web Worker; **Position real modelliert** (Responder hinter Hero) |
| Pot-Odds / Bet-EV | ✅ | rein analytisch, Chip-EV + manueller Risk-Premium-Aufschlag |
| PKO-Bounty | 🔶 | nur **sofortiger** Bounty-EV (Coverage-bedingt); zukünftiger Wert/Liability nicht modelliert |
| Tracking (eigene HH) | 🔶 | VPIP/PFR/3-Bet/4-Bet/Fold-vs-3-Bet/C-Bet/Fold-vs-C-Bet/Check-Raise/AF/WTSD/W$SD, **BB/100**, **Positions-Winrates**, Sample-Size-Warnungen |
| EV-BB/100 (All-in-adjustiert) | 🚧 | geplant (erfordert Equity-Pass im Main-Prozess) |
| Mystery Bounty · FGS | ⛔/🚧 | Mystery Bounty weggelassen; FGS zurückgestellt |
| Postflop-Solver / Bet-Trees / Nodelocking | ⛔ | außerhalb des Scopes |

## 5. Ein einziges ICM-Modell

Fold/Push-Szenarien und Solver nutzen **eine** chip-erhaltende Quelle
(`icmScenarioConfigs`). Für n>2 ist das Szenario-Modell ein Einzel-Caller-Modell
mit Dead Money der übrigen (gefoldeten) Sitze; die **vollständige** Multiway-
Verteilung liefert der Solver (Nash-Ranges / EV-Tabelle). „Nash-Ranges laden" und
„Analysieren" verwenden für n>2 denselben Multiway-Worker → konsistente Ranges.

## 6. Bekannte Grenzen

- **Equity-Tabelle** ist über alle Combos einer Hand gemittelt — Blocker-Effekte nur näherungsweise (für Push/Fold ausreichend).
- **Multiway-Solver:** simultaner-Call-Modell (keine sequenzielle Konditionierung auf beobachtete Calls), Monte-Carlo-basiert → für tiefe Bäume langsam.
- **Position:** Abstand-zum-Button-Modell (BTN=2 Responder, SB=1, …), auf Spielerzahl gekappt.
- **BB/100:** chip-genaues Accounting aus der Hand-History (best effort, EN+DE); hängt von der Formattreue ab.
- **PKO:** nur sofortiger Bounty-Wert.

## 7. Korrekturen an der ursprünglichen Spezifikation

Beim Abgleich der KI-Spezifikation gegen die Implementierung wurden bewusst korrigiert/verworfen:

1. **Fold-Equity-Formel:** `−B` ist unkonditional (frühere Fassung `−(1−E)·B` überschätzte den Bet-EV um `E·B`).
2. **§4.1 Keyword-Blocking** („Call oder Fold?", „schnell" …) **verworfen** — Kategorienfehler: das Tool ist formularbasiert, hat kein Prompt-Feld. Live-Schutz ist strukturell (kein Live-Datenpfad).
3. **§8.12 Postflop-Frequenz-Solver:** nicht gebaut — Scope-Widerspruch (keine Postflop-Engine spezifiziert).
4. **§11.3 Accuracy-Metriken** (ICM-Punt-Rate, Call-Off-Accuracy …): aus normalen Hand-Histories nicht zuverlässig berechenbar → nicht versprochen.
5. **Heads-up-ICM:** ICM „reduziert sich" auf die 1./2.-Differenz, **kollabiert nicht**.
6. **Call-EV** nur korrekt, wenn „Pot nach Call" Heros Call enthält (Konvention dokumentiert).
7. **DSGVO-Aussage** der Spec ist keine Rechtsberatung; Nutzungsregeln der Anbieter haben Vorrang.

## 8. Fair Play / TOS

- 100 % offline; keine Verbindung zu Pokerseiten/Clients, kein Scraping/OCR/HUD/Automatisierung.
- Nur **eigene** Hand-Histories; keine Gegner-/Playerpool-Daten.
- Lokale Speicherung **verschlüsselt** (OS-Schlüsselbund); Export **anonymisiert** (keine Spielernamen).
- Bestätigung „abgeschlossene/hypothetische Hand" mit Zeitstempel; dauerhafter Modell-Hinweis pro Analyse.
- Keine Echtzeit-Entscheidungshilfe. Die Zulässigkeit richtet sich nach den jeweils aktuellen Anbieterregeln.
