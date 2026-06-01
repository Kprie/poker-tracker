# Proker

**Poker-Turnier-Tracker und ICM-Analyse-Tool** für Windows.

Importiert Turnierergebnisse von **PokerStars** und **GGPoker**, wertet die eigene Spielhistorie aus und bietet einen vollständigen **ICM-Analyse-Tab** mit Nash-Solver, Runden-Simulator und Push/Fold-Referenz.

---

## Features

### Dashboard — Turnier-Auswertung

- **PokerStars einlesen** — liest alle `*.txt` Tournament-Summaries und Hand-Histories rekursiv aus dem konfigurierten Ordner
- **PokerCraft hochladen** — importiert GGPoker PokerCraft-Exporte (`.zip` oder einzelne `.txt`)
- **Kennzahlen**: Netto-Profit, ROI, Buy-ins gesamt, ITM-Quote, größter Cash, Ø Buy-in
- **Spielstil** (aus PokerStars Hand-Histories): VPIP, PFR, 3-Bet, Aggression Factor, WTSD, W$SD
- **Bankroll-Verlauf** als Flächendiagramm mit gleitendem ROI-Fenster (20/50/100 Turniere)
- **ITM-Tiefe**: Auszahlungsverteilung über 4 Tiers (kein Cash / <2× / 2–5× / ≥5× Buy-in)
- **Spieltendenzen**: ROI nach Buy-in-Stufe, Speed, Wochentag und Startuhrzeit
- **Turnier-Tabelle** — sortier- und filterbar nach allen Spalten
- **Filter** nach Quelle (PokerStars / GGPoker / beide) und Zeitraum (Presets oder frei)

### ICM-Analyse-Tab

#### ICM-Equity-Rechner
- **Malmuth-Harville-Algorithmus** — berechnet exakte ICM-Equities für bis zu 9 Spieler
- **8 Auszahlungs-Presets**: Heads-Up, SNG 6/9-Handed, Final Table 6/9, PKO, Satellit
- **Anzeigemodi**: ICM % / ICM € / Chip EV / Chip BB
- **Antes-Unterstützung** mit effektivem Stack
- **Bubble-Factor-Matrix** — zeigt für jedes Spielerpaar, wie viel stärker ein Chip-Verlust wiegt als ein Chip-Gewinn
- **Ladder-Analyse** — gestapeltes Balkendiagramm: Equity-Beitrag je Auszahlungsplatz pro Spieler
- **Chip EV vs. ICM** — Vergleichsdiagramm mit Differenzlabels

#### Runden-Simulation *(neu in 0.5.0)*
- **Konkrete Karten-Eingabe**: Hero-Hand, Board (0–5 Karten), Villain-Hand über 52-Karten-Picker
- **Exakte Wahrscheinlichkeiten** — vollständige Board-Enumeration:
  - River: direkte Auswertung (1 Board, exakt)
  - Turn: Enumeration aller 44 möglichen River-Karten
  - Flop: Enumeration aller C(45,2) = 990 Turn+River-Kombinationen
  - Preflop: Monte Carlo 20.000 Iterationen (SE < 0,4 %)
- **Hand-Erkennung**: automatische Anzeige der aktuellen Handkategorie (Paar Asse, Flush, etc.)
- **Outs-Anzeige**: konkrete Karten, die Hero gewinnen lassen (Turn/River)
- **ICM-Szenarien**: Fold / Push alle folden / Push gecallt+gewonnen / Push gecallt+verloren
- Alle Wahrscheinlichkeiten sind **mathematisch berechnet** — kein historischer Datensatz

#### Spot-Analyse (Nash Push/Fold)
- **Iterativer Nash-Solver** via Alternating Best Response (ABR)
- ICM-adjustierte EVs nach Malmuth-Harville für jede Hand
- **13×13 Hand-Grid** mit Nash-Farben (grün = pushen, gelb = grenzwertig, grau = folden)
- Zeigt: Equity vs. Call-Range, ICM-EV aller Szenarien, Konvergenz-Info
- Equity-Tabelle: 200 Monte-Carlo-Iterationen je Combo-Paar, gecacht in localStorage

#### Push/Fold-Referenz
- Vorgefertigte Spots: HU SB/BB, 3-handed, 4–6-handed (BTN/CO/HJ/UTG)
- Stack-Regler 2–25 BB, Positions-Auswahl
- Spots speichern und laden (localStorage)

---

## Anleitung für Nutzer

### 1. App herunterladen & starten

**Variante A – fertige Datei (empfohlen):**

1. Auf die [**Releases-Seite**](https://github.com/Kprie/poker-tracker/releases) gehen.
2. Unter dem neuesten Release eine Datei herunterladen:
   - **`Proker-Setup-x.y.z.exe`** — Installer (Startmenü-Eintrag), oder
   - **`Proker-Portable-x.y.z.exe`** — läuft direkt ohne Installation.
3. Datei ausführen. Windows SmartScreen kann warnen (App ist nicht signiert) →
   *„Weitere Informationen" → „Trotzdem ausführen"*.

Beim ersten Start erscheint ein einmaliger Nutzungshinweis — mit **„Verstanden"** bestätigen.

**Variante B – aus dem Quellcode** (benötigt [Node.js](https://nodejs.org) 20+):

```bash
git clone https://github.com/Kprie/poker-tracker.git
cd poker-tracker
npm install
npm run dev
```

### 2. PokerStars vorbereiten

1. PokerStars öffnen → **Einstellungen** → **Hand-History**.
2. **„Meine Hand-Historie speichern"** aktivieren.
3. Standard-Speicherort Windows:
   ```
   C:\Users\<NAME>\AppData\Local\PokerStars\
   ```

> **Tipp:** Auf den übergeordneten `PokerStars`-Ordner zeigen — die App durchsucht ihn rekursiv und findet `HandHistory` und `TournSummary` automatisch.

### 3. GGPoker / PokerCraft exportieren

1. GGPoker-Client → **PokerCraft** → **Game History / Tournaments**.
2. Zeitraum wählen → **Download / Export** → `.zip`-Datei speichern.

### 4. Daten importieren

Oben rechts in der App:

- **„PokerStars einlesen"** — scannt den konfigurierten Ordner (mit „ändern" wechselbar).
- **„PokerCraft hochladen"** — Dateidialog für die GGPoker-`.zip` oder `.txt`-Dateien.

Importe sind idempotent: vorhandene Turniere werden aktualisiert, nicht doppelt gezählt.

### 5. ICM-Analyse nutzen

Den Tab **„ICM-Analyse"** oben in der Navigation auswählen. Dort stehen vier Sektionen bereit:

| Sektion | Verwendung |
|---|---|
| **ICM-Equity-Rechner** | Stacks und Auszahlungen eingeben → Bubble-Faktoren, Equity-Vergleich |
| **Runden-Simulation** | Konkrete Karten wählen → exakte Win/Tie/Lose-Wahrscheinlichkeit + ICM-EV |
| **Spot-Analyse** | Stack in BB, Position, Spielerzahl → Nash Push/Fold-Range mit ICM-Rangliste |
| **Push/Fold-Referenz** | Schnellübersicht für Standardsituationen, speicherbar |

---

## Dateitypen & Datenmodell

| Typ | Quelle | Inhalt |
|-----|--------|--------|
| Tournament Summary | PokerStars `TournSummary/` | Buy-in, Platzierung, Payout |
| Hand History | PokerStars `HandHistory/` | Spielstil-Stats (VPIP/PFR/…) |
| PokerCraft Export | GGPoker `.zip` | Buy-in, Platzierung, Payout |

Datensätze derselben Turnier-ID werden zusammengeführt. Turniere ohne Summary (`resultKnown = false`) fließen nicht in Profit/ROI/ITM ein, aber in die Spielstil-Statistiken.

Daten werden lokal als `poker-data.json` im Electron-`userData`-Ordner gespeichert (oder einem frei wählbaren Ordner).

---

## Entwicklung

```bash
npm install
npm run dev        # Dev-Modus (Electron + Vite Hot-Reload)
npm run typecheck  # TypeScript prüfen (vor jedem Commit)
npm run build      # Produktions-Bundle nach out/
npm run build:win  # Windows-Installer + Portable nach dist/
```

Stack: Electron 31 · electron-vite · React 18 · Tailwind 3 · Recharts · TypeScript 5 strict · Zustand

---

## Nutzung & Richtlinien

Das Tool dient der **privaten Offline-Auswertung der eigenen Spielergebnisse**.

**Bewusste Design-Einschränkungen:**

- **Manueller Import, kein Datei-Watcher** — kein Echtzeit-Monitoring
- **Kein HUD / kein Overlay** über dem Pokertisch
- **Nur Hero-Daten** — keine Gegner-Statistiken
- **Lokal** — keine Upload-Funktion für Hand-Histories

Der ICM-Analyse-Tab ist ein **Post-Session-Analyse-Tool** — alle Berechnungen laufen lokal und offline.

**Risiko-Einordnung:** PokerStars erlaubt Post-Session-Analyse-Tools für eigene Daten (geringes Risiko). GGPoker ist restriktiver bezüglich Drittanbieter-Imports — GGPoker-Import erfolgt auf eigenes Risiko. Aktuelle ToS der Anbieter selbst prüfen.
