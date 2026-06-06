# poker-tracker — Claude context

## What this is
Electron desktop app (Windows) that imports poker tournament results from **PokerStars** and **GGPoker**, stores them locally, and shows a statistics dashboard. Version 0.4.8.

## Stack
| Layer | Tech |
|---|---|
| Desktop shell | Electron 31 |
| Build | electron-vite (Vite 5 underneath) |
| UI | React 18 + Tailwind 3 + Recharts |
| State (renderer) | Zustand |
| Language | TypeScript 5 (strict) |
| Fonts | Geist / Geist Mono variable |
| ZIP parsing | adm-zip |
| Date utils | date-fns |

## Commands
```
npm run dev          # dev server + Electron window
npm run build        # compile (no installer)
npm run build:win    # compile + create Windows installer via electron-builder
npm run typecheck    # tsc for both main and renderer (run before committing)
npm run start        # preview built app
```

## Architecture: three processes

```
main/          Node.js / Electron main process
  index.ts     — window creation, registers IPC
  ipc.ts       — all ipcMain.handle() definitions
  store.ts     — JSON file persistence (poker-data.json)
  parsers/     — text parsing (no UI dependency)

preload/
  index.ts     — contextBridge: exposes window.api to renderer
  index.d.ts   — explicit PokerApi interface + `declare global { Window.api }` (no import from index.ts!)

src/renderer/src/   Browser / React  ← CORRECT path prefix for ALL renderer files
  App.tsx           — root layout, tab navigation (Dashboard / ICM-Analyse)
  store.ts          — Zustand store, calls window.api
  lib/              — pure utility modules (no React)
  components/       — all UI components
  data/             — static data (pushFoldData.ts)

shared/types.ts   — interfaces shared between main and renderer
```

**Process boundary rule**: main process does all file I/O and parsing; renderer only receives plain JSON over IPC. Never import `electron` or `fs` from renderer code.

**Path note**: All renderer source files live under `src/renderer/src/` (not `renderer/src/`). Always use this prefix when reading or writing renderer files.

## IPC channels (ipc.ts ↔ preload/index.ts ↔ renderer/store.ts)
| Channel | Direction | Description |
|---|---|---|
| `settings:get` | main→renderer | Returns `AppSettings` |
| `settings:update` | renderer→main | Patch `AppSettings` |
| `tournaments:get` | main→renderer | Returns `Tournament[]` |
| `data:clear` | renderer→main | Optionally filter by source |
| `pokerstars:choose-folder` | renderer→main | Opens OS folder dialog |
| `pokerstars:scan` | renderer→main | Scans configured folder, returns `PokerStarsScanResult` |
| `data:choose-dir` | renderer→main | Changes where poker-data.json lives |
| `ggpoker:import` | renderer→main | Opens file dialog (zip/txt), returns `ImportResult` |

## Data model (shared/types.ts)

### Tournament (core entity)
- `id` — stable key: `"pokerstars:<tournamentId>"` or `"ggpoker:<tournamentId>"`
- `resultKnown` — **critical flag**: `true` only when a tournament summary was imported (payout/finish known). Records created solely from hand histories have `resultKnown: false` and must be **excluded from ROI/ITM/profit calculations**. Use `withResults(rows)` from analytics.ts before any money stats.
- `totalCost` — `(buyIn + fee) × (1 + reEntries)`, not just buyIn+fee
- `profit` — `payout - totalCost` (pre-calculated and stored)
- `handStats?: HandStatsAgg` — only present when hand histories were imported; always **raw counts** (not rates)

### HandStatsAgg — raw counts, rates derived in UI
`hands, vpip, pfr, threeBetOpp, threeBet, sawFlop, wtsd, wonSd, wonHand, aggActions, callActions`

Rates are computed in `computePlayStyle()` (analytics.ts). Never store rates in HandStatsAgg.

### Persistence
`poker-data.json` in Electron's `userData` folder (or a user-chosen dir). The pointer to the custom dir is stored separately in `config.json` (same userData folder) so it survives data moves.

## Parsers (src/main/parsers/)

### pokerstars.ts — tournament summaries
- Bilingual: English + German (PokerStars.DE). Both share the same regex patterns with `i` flag.
- Identifies hero via optional `heroName` param (derived from hand histories). Needed for German files where "You finished" phrasing differs.
- Handles re-entries, rebuys, addons in cost calculation.
- `pokerStarsPath` can point to the client root (e.g. `PokerStars.DE/`) — `walkTxtFiles` recurses into both `HandHistory/` and `TournSummary/` and auto-detects each file type.

### pokerstars-hh.ts — hand histories
- `isPokerStarsHandHistory(content)` — quick sniff to distinguish HH files from summaries
- `parsePokerStarsHands(content)` → `HandResult[]` per hand
- `aggregateHands(results)` → one `Tournament` per tournament id with aggregated `HandStatsAgg`
- `dominantHero(results)` → most-frequent hero name across all parsed hands (used to resolve hero in summaries)
- De-duplication: hands are keyed by hand id so multiple table files for one tournament don't double-count.

### ggpoker.ts — PokerCraft exports
- Supports ZIP (extracted in ipc.ts via adm-zip) and individual .txt files.
- Speed detection: `hyper`/`turbo`/`regular` keywords in name → respective value; no keyword → `'unknown'`.

### util.ts — shared parser helpers
Regex utilities and currency parsing shared by all parsers.

## Analytics (src/renderer/src/lib/analytics.ts)

Key functions:
- `applyFilters(tournaments, filters)` — source + date range filter, returns sorted by startDate
- `withResults(rows)` — filter to resultKnown=true before any money calc
- `computeKpis(rows)` → `Kpis` — ROI, ITM, avgBuyIn, biggestWin etc.
- `computePlayStyle(rows)` → `PlayStyle` — aggregates HandStatsAgg raw counts into rates
- `bankrollSeries(rows)` → cumulative profit over time (for BankrollChart)
- `byBuyIn / bySpeed / byGameType / byWeekday / byHour` — group stats for Breakdown component
- `rollingRoiSeries(rows, window)` → `RollingRoiPoint[]` — sliding-window ROI per tournament (window = 20/50/100); input must already be `withResults()` rows
- `computeItmDepth(rows)` → `ItmTier[]` — ITM payout distribution across 4 tiers: no cash / <2× / 2–5× / ≥5× of totalCost

Buy-in brackets are defined in `BUYIN_BRACKETS` at the top of analytics.ts — edit there to change tiers.

---

## ICM-Analyse Tab

Added in v0.5 — standalone tab next to Dashboard in `App.tsx`.

### ICM lib modules (src/renderer/src/lib/)

#### icm.ts
- `EvMode` — `'icm_pct' | 'icm_usd' | 'chip_ev' | 'chip_bb'`
- `computeIcmEquities(stacks, payouts): number[]` — Malmuth-Harville recursion, O(n!/(n-m)!)
- `computePositionEquities(stacks, payouts): number[][]` — per-player per-place equity contribution (used by LadderChart)
- `computeBubbleFactors(stacks, payouts): number[][]` — BF[i][j], diagonal = NaN. Uses 0.1 % total-chips delta.
- `convertEquities(equities, stacks, payouts, mode, bbSize?)` — converts raw ICM equities to display mode

#### cards.ts
- `Card = number` — encoding: `rank * 4 + suit` (rank 0=2…12=A, suit 0=c…3=s)
- `RANK_CHARS`, `cardRank`, `cardSuit`, `makeCard`, `FULL_DECK`
- `handIdToCombos(id): [Card,Card][]` — pair=6, suited=4, offsuit=12 combos
- `drawRandom(arr, k): Card[]` — partial Fisher-Yates (in-place on copy)

#### handEval.ts
- `eval5(c0,c1,c2,c3,c4): number` — no array allocation; sorting network (9 comparisons for 5 elements) + integer arithmetic. Score = `type * 371293 + kicker_encoding`.
- `eval7(c: readonly number[]): number` — best 5 of C(7,5)=21 combos, calls eval5 inline without temporaries
- `eval7arr(cards)` — array-input wrapper for compatibility

#### equityTable.ts — lazy equity cache
- `lookupEquity(h1, h2): number` — hand-vs-hand MC equity, cached in memory + `localStorage` key `'poker-tracker:equity-cache-v1'`
- `lookupEquityVsRange(h, range: Map<HandId,number>): number` — weighted average against a range
- `precomputeAllEquities(onProgress?, chunkSize?): Promise<void>` — async chunked precomputation via `setTimeout(0)`; call from UI to warm cache
- `cachedPairCount(): number`, `TOTAL_PAIR_COUNT = 14365`
- `ITERS_PER_COMBO = 25` — 25 iters × ~10 combos/hand = ~250 effective samples per pair, SE ≈ 3 %
- Cache is **not** persisted per-entry (too slow); `persistCache()` is called once at the end of `precomputeAllEquities`

#### nashSolver.ts — iterative push/fold Nash solver
- `solveNash(input: NashInput): NashResult`
- Algorithm: **Alternating Best Response (ABR)**
  1. Init call-range = all 169 hands
  2. Compute hero push EV per hand via `lookupEquityVsRange` + real ICM deltas → push-range
  3. Compute villain call EV per hand → call-range
  4. Repeat until convergence (`convergenceThreshold = 0.02`, `maxIterations = 12`)
- `NashHandResult` — `{ handId, ev, freq, equity }`; `freq` is 0 or 1 (pure strategy)
- `NashInput` — `{ stacks, payouts, bbSize, ante, callerIdx=1, maxIterations, convergenceThreshold }`
- `getHandNashResult(result, handId, isHero): NashHandResult | null`
- ICM deltas computed via 4 scenarios: current / win-pot / win-call / lose-call (each a full Malmuth-Harville pass)
- First call: ~15–30 s if equity cache is cold; subsequent calls: near-instant

#### equity.ts — Monte Carlo equity + ICM scenarios
- `buildCallingRange(spot, heroCards): RangeCombo[]`
- `computeEquityMC(heroCards, range, iterations=2000): EquityResult` — returns `{ equity, stdDev }`
- `computeIcmScenarios(stacks, payouts, bbSize, ante, callerIdx, computeEquities): IcmScenarios`
  - Returns `{ fold, pushWinBlinds, pushCallWin, pushCallLose }` in payout units

### Data (src/renderer/src/data/)

#### pushFoldData.ts
- `ALL_HAND_IDS: HandId[]` — all 169 canonical hands in 13×13 grid order
- `PUSH_FOLD_SPOTS: PushFoldSpot[]` — HU SB push (3–20 BB), HU BB call (5–15 BB), 3-handed BTN/SB, 4/5/6-handed BTN/CO/HJ/UTG push
- `findSpot(players, position, stackBb, action)` — nearest-neighbour fallback
- `availablePositions(players)` — correct position list per player count
- `handStrength(id): number`, `nashThreshold(players, position, stackBb, action)` — approximate thresholds (used as fallback only; SpotAnalyzer uses real Nash solver)

### UI components (src/renderer/src/components/)

#### IcmTab.tsx
Main ICM tab. Sections: ICM-Equity-Rechner, Spot-Analyse, Push/Fold-Referenz.
Result sub-tabs: Bubble-Factor-Matrix / Ladder-Analyse / Chip EV vs ICM.

#### IcmCalculator.tsx
- Stack/payout inputs; 8 presets (HU, SNG 6/9, Final Table 6/9, PKO, Satellite)
- Ante field with effective-stack column when ante > 0
- 4-option EV mode toggle (ICM% / ICM€ / ChipEV / ChipBB)
- Exports `IcmResult` interface

#### BubbleFactorMatrix.tsx
Props: `{ bubbleFactors: number[][], playerCount: number }`.
Colors: ≥2.0 red-900 / ≥1.4 orange-900 / ≥1.0 yellow-900 / <1.0 slate-400.

#### LadderChart.tsx
Recharts stacked BarChart; one bar per player stacked by payout-position equity contribution. Colors: gold/silver/bronze for 1st/2nd/3rd.

#### IcmCompareChart.tsx
Recharts grouped BarChart: ChipEV% (gray) vs ICM% (green) per player; difference labels on bars.

#### HandGrid.tsx
13×13 EV grid. Colors: green-700 (>1 BB) / green-900 (0–1 BB) / yellow-900 (-1–0 BB) / slate-800 (<-1 BB).
Exports `HandGridLegend`.

#### SpotAnalyzer.tsx
- Situation inputs: players, position, stack slider (2–25 BB), BB size, ante, all stacks, payouts
- `PrecomputeBanner` — progress bar for equity table precomputation (first session only)
- `MiniHandGrid` — 13×13 clickable grid; colors from Nash solver result
- **"Nash-Ranges laden"** — runs `solveNash()` for the situation, colors the grid
- **"Analysieren"** (async, setTimeout 0):
  1. `solveNash()` → Nash push/call ranges
  2. `computeEquityMC()` → concrete equity with 95 % CI
  3. `computeIcmScenarios()` → all 4 ICM scenarios
  Shows: Nash recommendation + EV, equity bar + confidence interval, ICM scenario table, weighted ICM-EV

#### PushFoldPanel.tsx
Static push/fold reference. Save/load spots to `localStorage` key `'poker-tracker:saved-pf-spots'`. Saved spots list with hover-to-delete, click-to-load.

---

## Dashboard UI components (src/renderer/src/components/)
- `Toolbar` — source/date filters + import buttons
- `BankrollChart` — Recharts LineChart of cumulative profit
- `RollingRoiChart` — sliding-window ROI chart; manages window state internally, receives `rows: Tournament[]`
- `ItmDepth` — bar chart + table of ITM payout tiers (both sources)
- `TournamentTable` — sortable/filterable table of all tournaments
- `Breakdown` — tabbed GroupStat tables (buy-in / speed / weekday / hour)
- `PlayStyle` — VPIP/PFR/3-bet/AF stats display (PokerStars only — requires hand histories)
- `KpiTile` — single stat box
- `Reveal` — toggle-show wrapper (used to hide/show sections)
- `Section` — titled card wrapper
- `Disclaimer` — hand-history data quality note
- `icons.tsx` — inline SVG icon components

## Conventions
- No test suite — validate with `npm run typecheck` + manual testing
- UI strings are German (app targets German-speaking players) — **formal register, no colloquialisms**
- No comment unless the why is non-obvious
- Parsers return empty arrays on parse failure (never throw to caller)
- `upsertTournaments` in store.ts merges by id: summary wins on money fields, HH record wins on handStats — see `mergeTournament()`
- Recharts theme in `chartTheme.ts`, always use it instead of inline colors

## Upgrade Roadmap

Full phased plan in `plans/00-professional-upgrade.md`. Summary of known bugs to fix:

| ID | File | Bug |
|----|------|-----|
| B1 | `nashSolver.ts` ~L158 | P(Call) ignores hero blocking — divides by 1326 instead of 1225 (50 choose 2) |
| B2 | `equity.ts` ~L68 | callFraction uses `range.length` instead of `range.reduce((s,r)=>s+r.weight,0)` |
| B3 | `pokerstars-hh.ts` ~L131 | 3-Bet opportunity set after hero action instead of before |
| B4 | `analytics.ts` | `bankrollSeries()` / `computeItmDepth()` don't enforce `withResults()` internally |

## Common gotchas
1. **Don't compute rates on HandStatsAgg** — always sum raw counts first, then divide. `computePlayStyle` is the single place that does this.
2. **Check `resultKnown`** before including a tournament in profit/ROI/ITM — HH-only records inflate counts otherwise. Note: `bankrollSeries()` and `computeItmDepth()` do NOT currently enforce this internally — caller must pass `withResults(rows)`.
3. **IPC must be registered** in `ipc.ts` AND exposed via `contextBridge` in `preload/index.ts` AND typed in `preload/index.d.ts` — three places for every new channel.
4. **`totalCost` includes re-entries** — don't recompute it as `buyIn + fee`.
5. `walkTxtFiles` is depth-limited to 6 to avoid infinite loops on symlinked dirs.
6. **Speed is `'unknown'` by default** — both parsers only set `'regular'`/`'turbo'`/`'hyper'` when the keyword appears explicitly in the tournament name. PokerStars summaries never carry speed info; GGPoker names are descriptive but still keyword-based. `migrateSpeed()` in `store.ts` re-derives speed from the name on every `loadData()` call, so historical records with wrong defaults are corrected automatically without re-import.
7. **Never import from `preload/index.ts` in renderer code** — TypeScript resolves `.ts` over `.d.ts`, pulling the main-process module into the renderer compilation (TS6307). Renderer derives the API type via `type PokerApi = Window['api']` (see `renderer/src/store.ts`). Only `preload/index.d.ts` is part of the renderer compilation.
8. **Nash solver is slow on cold cache** — first `solveNash()` call may take 15–30 s while `equityTable` computes ~3000 hand-pair equities on demand. Subsequent calls use the localStorage cache and are near-instant. Use `precomputeAllEquities()` with the `PrecomputeBanner` to warm the cache proactively.
9. **`handIdToCombos` is in `cards.ts`**, not `pushFoldData.ts`. Import from `'../lib/cards'`.
10. **ICM Bubble Factors**: diagonal is `NaN` (player vs themselves). Always guard against NaN in BubbleFactorMatrix rendering.
11. **Nash P(Call) known bug**: `totalCallCombos` in `nashSolver.ts` uses 1326 (all combos) instead of 1225 (50 choose 2, after hero's 2 cards removed). Fix before relying on Nash results for concrete hand analysis.
12. **ABR ≠ true Nash**: `solveNash()` uses Alternating Best Response which can oscillate. Results are good approximations for push/fold spots but not mathematically guaranteed Nash equilibria.
