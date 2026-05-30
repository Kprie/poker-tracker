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
- **Bankroll-Verlauf** als Flächendiagramm.
- **Spieltendenzen** (ergebnisbasiert): ROI nach Buy-in-Stufe, Profit nach Speed,
  Wochentag und Startuhrzeit.
- **Turnier-Tabelle** mit Sortierung.

Die Daten werden lokal als JSON unter dem Electron-`userData`-Ordner gespeichert
(`poker-data.json`). Importe sind idempotent (De-Duplizierung über die Turnier-ID).

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
- **Spieltendenzen sind ergebnisbasiert.** Echte Spielstil-Kennzahlen (VPIP/PFR/Aggression)
  brauchen Hand-Histories und sind als zweite Ausbaustufe vorgesehen
  (`parseGGPokerExport` für Hand-History-`.txt` ist noch nicht implementiert).
- Der PokerStars-Parser basiert auf dem dokumentierten Standardformat und sollte mit
  echten PokerStars-Summaries gegengeprüft werden.
