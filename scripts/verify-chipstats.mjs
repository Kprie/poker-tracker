// Phase 7b: Chip-Bilanz (netBb) + Positionserkennung aus PokerStars-HH (EN/DE).
const { parsePokerStarsHands } = await import('../src/main/parsers/pokerstars-hh.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const near = (a, b, e = 1e-9) => a !== null && Math.abs(a - b) < e
const parse = (t) => parsePokerStarsHands(t)[0]

// ── F: BTN-Steal, Gewinn +30 Chips = +1.5 BB, Position BTN ──
{
  const h = parse([
    `PokerStars Hand #1: Tournament #100, $1.00+$0.10 USD Hold'em No Limit - Level I (10/20) - 2024/01/01 12:00:00 ET`,
    `Table '100 1' 9-max Seat #1 is the button`,
    `Seat 1: Hero (1500 in chips)`,
    `Seat 2: Villain (1500 in chips)`,
    `Seat 3: Villain2 (1500 in chips)`,
    `Villain: posts small blind 10`,
    `Villain2: posts big blind 20`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [Ah Kh]`,
    `Hero: raises 40 to 60`,
    `Villain: folds`,
    `Villain2: folds`,
    `Uncalled bet (40) returned to Hero`,
    `Hero collected 50 from pot`,
    `*** SUMMARY ***`,
    `Total pot 50 | Rake 0`,
    `Seat 1: Hero (button) collected (50)`,
  ].join('\n'))
  ok('F: netBb = +1.5', near(h.netBb, 1.5), `${h.netBb}`)
  ok('F: Position BTN', h.position === 'BTN', `${h.position}`)
}

// ── G: BB verliert (postet BB 20, callt 40, foldet Flop) = −60 Chips = −3 BB ──
{
  const h = parse([
    `PokerStars Hand #2: Tournament #100, $1.00+$0.10 USD Hold'em No Limit - Level II (10/20) - 2024/01/01 12:05:00 ET`,
    `Table '100 1' 9-max Seat #2 is the button`,
    `Seat 1: Hero (1500 in chips)`,
    `Seat 2: Villain (1500 in chips)`,
    `Seat 3: Villain2 (1500 in chips)`,
    `Villain2: posts small blind 10`,
    `Hero: posts big blind 20`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [Ah Kh]`,
    `Villain: raises 40 to 60`,
    `Villain2: folds`,
    `Hero: calls 40`,
    `*** FLOP *** [7s 2c 9d]`,
    `Hero: checks`,
    `Villain: bets 80`,
    `Hero: folds`,
    `*** SUMMARY ***`,
    `Total pot 130 | Rake 0`,
    `Seat 2: Villain collected (130)`,
  ].join('\n'))
  ok('G: netBb = -3', near(h.netBb, -3), `${h.netBb}`)
  ok('G: Position BB', h.position === 'BB', `${h.position}`)
}

// ── H: DE mit Ante, Gewinn. Ante 5 + Raise auf 60 + Flop-Bet 50 (uncalled) ──
//     investiert = 5 + 60 + 50 = 115; collected 130; uncalled 50 → net +65 = +3.25 BB
{
  const h = parse([
    `PokerStars Hand #3: Tournament #100, $1.00+$0.10 USD Hold'em No Limit - Level III (10/20) - 2024/01/01 12:10:00 ET`,
    `Table '100 1' 9-max Seat #3 is the button`,
    `Seat 1: Hero (1500 in chips)`,
    `Seat 2: Villain (1500 in chips)`,
    `Seat 3: Villain2 (1500 in chips)`,
    `Hero: posts the ante 5`,
    `Villain: posts the ante 5`,
    `Hero: posts small blind 10`,
    `Villain: posts big blind 20`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [Ah Kh]`,
    `Hero: raises 40 to 60`,
    `Villain: calls 40`,
    `*** FLOP *** [7s 2c 9d]`,
    `Hero: bets 50`,
    `Villain: folds`,
    `Uncalled bet (50) returned to Hero`,
    `Hero collected 130 from pot`,
    `*** SUMMARY ***`,
    `Total pot 130 | Rake 0`,
    `Seat 1: Hero collected (130)`,
  ].join('\n'))
  ok('H: netBb = +3.25 (Ante separat)', near(h.netBb, 3.25), `${h.netBb}`)
  ok('H: Position SB', h.position === 'SB', `${h.position}`)
}

// ── I: Position CO (6 Sitze, Button Seat 6, Hero Seat 5) ──
{
  const h = parse([
    `PokerStars Hand #4: Tournament #100, $1.00+$0.10 USD Hold'em No Limit - Level IV (10/20) - 2024/01/01 12:15:00 ET`,
    `Table '100 1' 6-max Seat #6 is the button`,
    `Seat 1: P1 (1500 in chips)`,
    `Seat 2: P2 (1500 in chips)`,
    `Seat 3: P3 (1500 in chips)`,
    `Seat 4: P4 (1500 in chips)`,
    `Seat 5: Hero (1500 in chips)`,
    `Seat 6: P6 (1500 in chips)`,
    `P1: posts small blind 10`,
    `P2: posts big blind 20`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [Ah Kh]`,
    `Hero: folds`,
    `*** SUMMARY ***`,
    `Total pot 30 | Rake 0`,
    `Seat 1: P1 collected (30)`,
  ].join('\n'))
  ok('I: Position CO (Seat direkt vor Button)', h.position === 'CO', `${h.position}`)
}

// ── J: Namens-Teilstring — Hero 'Joe' darf nicht 'Joey' matchen ──
{
  const h = parse([
    `PokerStars Hand #5: Tournament #100, $1.00+$0.10 USD Hold'em No Limit - Level V (10/20) - 2024/01/01 12:20:00 ET`,
    `Table '100 1' 9-max Seat #1 is the button`,
    `Seat 1: Joe (1500 in chips)`,
    `Seat 2: Joey (1500 in chips)`,
    `Seat 3: Al (1500 in chips)`,
    `Al: posts small blind 10`,
    `Joey: posts big blind 20`,
    `*** HOLE CARDS ***`,
    `Dealt to Joe [2c 7d]`,
    `Joe: folds`,
    `Al: folds`,
    `Uncalled bet (10) returned to Joey`,
    `Joey collected 30 from pot`,
    `*** SUMMARY ***`,
    `Total pot 30 | Rake 0`,
    `Seat 2: Joey collected (30)`,
  ].join('\n'))
  ok('J: Hero Joe foldet BTN → netBb 0 (kein Joey-Match)', near(h.netBb, 0), `${h.netBb}`)
  ok('J: Position BTN', h.position === 'BTN', `${h.position}`)
}

// ── K: Aussetzender Spieler zählt nicht zur Positionsreihenfolge ──
{
  const h = parse([
    `PokerStars Hand #6: Tournament #100, $1.00+$0.10 USD Hold'em No Limit - Level VI (10/20) - 2024/01/01 12:25:00 ET`,
    `Table '100 1' 9-max Seat #1 is the button`,
    `Seat 1: P1 (1500 in chips)`,
    `Seat 2: P2 (1500 in chips)`,
    `Seat 3: P3 (1500 in chips) is sitting out`,
    `Seat 4: Hero (1500 in chips)`,
    `P2: posts small blind 10`,
    `Hero: posts big blind 20`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [Ah Kh]`,
    `Hero: checks`,
    `*** SUMMARY ***`,
    `Total pot 30 | Rake 0`,
    `Seat 2: P2 folded`,
  ].join('\n'))
  ok('K: Position BB (Sitz 3 ausgesetzt, 3 aktive)', h.position === 'BB', `${h.position}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
