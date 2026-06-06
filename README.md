# Proker

**Turnierpoker-Tracker und Analyse-Suite** für Windows.

Importiert Turnierergebnisse von **PokerStars** und **GGPoker**, wertet die eigene Spielhistorie aus und bietet eine vollständige **Turnier-Analyse-Suite**: ICM, Nash-Push/Fold (HU + Multiway, chip-erhaltend), Pot-Odds/Bet-EV, PKO-Bounty, Deal/Satellite, Equity-Labor und ein erweitertes Spielstil-Tracking. Vollständig **offline**, Daten lokal verschlüsselt.

---

## Features

### Dashboard — Turnier-Auswertung

- **PokerStars einlesen** — liest alle `*.txt` Tournament-Summaries und Hand-Histories rekursiv aus dem konfigurierten Ordner
- **PokerCraft hochladen** — importiert GGPoker PokerCraft-Exporte (`.zip` oder einzelne `.txt`)
- **Kennzahlen**: Netto-Profit, ROI, Buy-ins gesamt, ITM-Quote, größter Cash, Ø Buy-in
- **Spielstil** (aus PokerStars Hand-Histories):
  - Preflop: VPIP, PFR, 3-Bet, **4-Bet, Fold vs 3-Bet**, Aggression Factor
  - Postflop: **C-Bet Flop, Fold vs C-Bet, Check-Raise Flop**, WTSD, W$SD
  - **BB/100** und **Winrate je Position** (BTN/SB/BB/CO/HJ/MP/EP)
  - **Sample-Size-Warnungen** bei zu kleiner Stichprobe
- **Bankroll-Verlauf** als Flächendiagramm mit gleitendem ROI-Fenster (20/50/100 Turniere)
- **ITM-Tiefe**, **Spieltendenzen** (ROI nach Buy-in/Speed/Wochentag/Uhrzeit), sortierbare **Turnier-Tabelle**
- **Filter** nach Quelle und Zeitraum
- **Anonymisierter Export** der eigenen Daten (ohne Spielernamen)

### ICM-Analyse-Tab

#### ICM-Equity-Rechner
- **Malmuth-Harville-Algorithmus** — exakte ICM-Equities für bis zu 9 Spieler
- 8 Auszahlungs-Presets · Anzeigemodi ICM % / € / Chip EV / Chip BB · Antes
- Ergebnis-Reiter: **Bubble-Factor-Matrix**, **Risk Premium** (benötigte Call-Equity je Gegner), **Ladder-Analyse**, **Chip EV vs. ICM**, **Deal & Satellite** (Chip-Chop vs. ICM-Chop + Ticket-Lock)

#### Hand-Analyse
- Hero-Hand, Board (0–5 Karten), Villain-Hand/Range über 52-Karten-Picker
- **Exakte Equity** (River direkt · Turn/Flop vollständige Enumeration · Preflop Monte Carlo) + **Outs** + Handkategorie + ICM-Szenarien

#### Equity-Labor (Multiway)
- 2–4 Hände + Board → **Multiway-Equity** je Hand, **Handklassen-Verteilung** über alle Runouts, **Draw-Erkennung** (Flush-/Nut-Flush-Draw, OESD, Gutshot)

#### Spot-Analyse (Nash Push/Fold)
- **Heads-Up: chip-erhaltend exakt** · **Multiway: exakt mit Side-Pots** (Web Worker, UI bleibt flüssig)
- **Position real modelliert** (Anzahl Responder hinter Hero) · explizite Post-Eingabe je Sitz
- 13×13 Hand-Grid mit ICM-adjustierten Nash-Farben, Equity vs. Call-Range, Konvergenz-Info

#### Pot-Odds & EV-Rechner
- Benötigte Equity, Call-EV, **Break-even-Foldfrequenz**, Bet-EV, **Sizing-Vergleich** · optionaler Risk-Premium-Aufschlag

#### PKO-Bounty-Rechner
- Sofortiger **Bounty-EV** einer All-in-Konfrontation (Coverage-bedingt) + Gesamt-EV

#### Push/Fold-Referenz
- Vorgefertigte Spots (HU, 3–6-handed), Stack-Regler, speicherbar

### Methodik-Tab
- Module & Status (Soll/Ist), verwendete **Formeln**, bekannte Grenzen, Fair-Play/TOS — siehe auch [`docs/turnier-analyse-methodik.md`](docs/turnier-analyse-methodik.md)

---

## Anleitung für Nutzer

### 1. App herunterladen & starten

**Variante A – fertige Datei (empfohlen):**

1. Auf die [**Releases-Seite**](https://github.com/Kprie/poker-tracker/releases) gehen.
2. Unter dem neuesten Release herunterladen:
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

### 5. Analyse nutzen

Über die Navigation: **Dashboard**, **ICM-Analyse** (alle Rechner) und **Methodik** (Annahmen & Grenzen).

---

## Dateitypen & Datenmodell

| Typ | Quelle | Inhalt |
|-----|--------|--------|
| Tournament Summary | PokerStars `TournSummary/` | Buy-in, Platzierung, Payout |
| Hand History | PokerStars `HandHistory/` | Spielstil-Stats, Chip-Bilanz (BB/100), Position |
| PokerCraft Export | GGPoker `.zip` | Buy-in, Platzierung, Payout |

Datensätze derselben Turnier-ID werden zusammengeführt. Turniere ohne Summary (`resultKnown = false`) fließen nicht in Profit/ROI/ITM ein, aber in die Spielstil-Statistiken.

Daten werden **lokal verschlüsselt** (OS-Schlüsselbund) als `poker-data.json` im Electron-`userData`-Ordner gespeichert (oder einem frei wählbaren Ordner).

---

## Entwicklung

```bash
npm install
npm run dev        # Dev-Modus (Electron + Vite Hot-Reload)
npm run typecheck  # TypeScript prüfen (vor jedem Commit)
npm run verify     # Mathematik-/Parser-Verifikation (14 Suites)
npm run build      # Produktions-Bundle nach out/
npm run build:win  # Windows-Installer + Portable nach dist/
```

Stack: Electron 31 · electron-vite · React 18 · Tailwind 3 · Recharts · TypeScript 5 strict · Zustand

---

## Nutzung & Richtlinien

Reines **Turnier-Analysewerkzeug** zur **privaten Offline-Auswertung der eigenen Spielergebnisse**. Cashgame und Rake sind nicht im Scope.

**Bewusste Design-Einschränkungen:**

- **Manueller Import, kein Datei-Watcher** — kein Echtzeit-Monitoring
- **Kein HUD / kein Overlay**, keine Automatisierung, kein Scraping/OCR
- **Nur Hero-Daten** — keine Gegner-Statistiken; Export ohne Spielernamen
- **Lokal & verschlüsselt** — keine Upload-/Cloud-Funktion

Alle Auswertungen sind **modellabhängig** und gelten nur für **abgeschlossene oder hypothetische** Spots — keine Echtzeit-Entscheidungshilfe für laufende Hände.

**Risiko-Einordnung:** PokerStars erlaubt Post-Session-Analyse-Tools für eigene Daten (geringes Risiko). GGPoker ist restriktiver bezüglich Drittanbieter-Imports — GGPoker-Import erfolgt auf eigenes Risiko. Aktuelle ToS der Anbieter selbst prüfen.
