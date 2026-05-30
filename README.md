# Poker Tracker

Desktop-App (Electron + React + TypeScript) zum Auswerten von Pokerturnier-Ergebnissen
von **PokerStars** und **GGPoker**.

## Features

- **PokerStars einlesen** – liest alle `*.txt` Tournament-Summaries aus dem konfigurierten
  Ordner. Der Standardort wird automatisch erkannt; per „ändern" wählbar.
- **PokerCraft hochladen** – importiert GGPoker PokerCraft-Exporte (`.zip` mit Summaries
  oder einzelne `.txt`).
- **Filter** nach Quelle (PokerStars / GGPoker / beide).
- **Zeitraum** über Presets (7T/30T/90T/1J/Alle) oder freie Datumsauswahl.
- **Statistiken**: Netto-Profit, ROI, Buy-ins gesamt, Auszahlungen, ITM-Quote, größter Cash.
- **Spielstil** (aus Hand-Histories): VPIP, PFR, 3-Bet, Aggression Factor, WTSD, W$SD.
- **Bankroll-Verlauf** als Flächendiagramm.
- **Spieltendenzen** (ergebnisbasiert): ROI nach Buy-in-Stufe, Profit nach Speed,
  Wochentag und Startuhrzeit.
- **Turnier-Tabelle** mit Sortierung.

## Dateitypen & Zusammenführung

PokerStars erzeugt zwei Dateitypen, die unterschiedliche Informationen liefern:

| Typ | Ordner | liefert |
|-----|--------|---------|
| **Tournament Summary** | `TournSummary` | Buy-in, Platzierung, Payout |
| **Hand History** | `HandHistory` | jede Hand → Spielstil-Stats + Buy-in |

Der PokerStars-Scan durchsucht den gewählten Ordner **rekursiv** und erkennt pro Datei
automatisch den Typ. Records für dasselbe Turnier (gleiche Tournament-ID) werden
**zusammengeführt**: das Summary liefert Payout/Platzierung, die Hand-History den Spielstil.
Turniere ohne Summary haben kein bekanntes Ergebnis (`resultKnown = false`) und werden aus
Profit/ROI/ITM ausgeklammert, fließen aber in die Spielstil-Statistiken ein.

GGPoker liefert seine Daten als **PokerCraft-Export** (`.zip` mit Summary-`.txt`s).

Die Daten werden lokal als JSON unter dem Electron-`userData`-Ordner gespeichert
(`poker-data.json`). Importe sind idempotent (De-Duplizierung über die Turnier-ID).

## Nutzung & Richtlinien (wichtig)

Das Tool ist für die **private Offline-Auswertung der eigenen Spielergebnisse** gebaut und
versucht bewusst, innerhalb der Tool-Richtlinien von PokerStars und GGPoker zu bleiben.

**Bewusste Design-Einschränkungen — nicht entfernen:**

- **Manueller Import, kein Datei-Watcher.** Dateien werden nur per Button eingelesen. Es gibt
  bewusst kein `fs.watch`/Polling/Auto-Monitoring, damit der Charakter klar „nach der Session"
  bleibt und nichts in Richtung Echtzeit-Nutzung geht.
- **Kein Echtzeit-HUD / kein Overlay** über dem Pokertisch.
- **Nur Hero-Daten.** Es werden ausschließlich die eigenen aggregierten Stats gespeichert,
  **keine Gegner-Statistiken** und keine Roh-Hände (keine Massendatenanalyse).
- **Lokal.** Keine Upload-/Sharing-Funktion für Hand-Histories oder PokerCraft-Daten.
- **Nicht hinzufügen:** RTA/Solver, Equity-/Range-Rechner, Seating-Skripte, dynamische HUDs,
  Daten-Export an Dritte.

**Risiko-Einordnung:** PokerStars erlaubt Tools, die nur eigene Spieldaten nutzen
(Post-Session-Analyse) → geringes Risiko. GGPoker ist deutlich restriktiver
(Security & Ecology Policy verbietet 3rd-Party-Import von PokerCraft/HH-Daten breit) → der
GGPoker-Import erfolgt **auf eigenes Risiko**; sanktionierter Weg ist PokerCraft selbst.
Keine Rechtsberatung — aktuelle ToS der Anbieter selbst prüfen.

## Entwicklung

```bash
npm install
npm run dev        # startet die App im Dev-Modus
npm run typecheck  # TypeScript prüfen
npm run build      # Produktions-Bundle nach out/
npm run build:win  # Windows-Installer (NSIS) nach dist/
```

## Datenformate

**PokerStars** und **GGPoker** liefern beide Tournament-Summary-Textdateien
(ein Turnier pro Datei). Die Parser liegen in `src/main/parsers/`.

### Hinweise / Annahmen

- GGPoker-Auszahlungen in **T$** (Tournament-Dollars/Tickets) werden 1:1 mit der
  Buy-in-Währung verrechnet.
- **Spielstil-Stats** (VPIP/PFR/3-Bet/AF/WTSD/W$SD) stammen aus PokerStars-Hand-Histories.
  Hände werden per Hand-ID dedupliziert; All-in-Spieler werden korrekt als „Flop gesehen"
  gezählt. Limp-Reraises als 3-Bet werden (selten) nicht erfasst.
- Der PokerStars-**Summary**-Parser basiert auf dem dokumentierten Standardformat und sollte
  mit einer echten Summary gegengeprüft werden (bislang nur Hand-History-Samples vorhanden).
- GGPoker-Hand-Histories (für GG-Spielstil) sind noch nicht angebunden — derzeit nur PokerStars.
