// Phase 7: erweiterte Tracking-Stats aus synthetischen PokerStars-Hand-Histories.
const { parsePokerStarsHands } = await import('../src/main/parsers/pokerstars-hh.ts')

let failures = 0
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }

let handNo = 0
function build(preflop, flop) {
  handNo++
  return [
    `PokerStars Hand #${handNo}: Tournament #100, $1.00+$0.10 USD Hold'em No Limit - Level I (10/20) - 2024/01/01 12:00:00 ET`,
    `Table '100 1' 9-max Seat #1 is the button`,
    `Seat 1: Hero (1500 in chips)`,
    `Seat 2: Villain (1500 in chips)`,
    `Seat 3: Villain2 (1500 in chips)`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [Ah Kh]`,
    ...preflop,
    ...(flop ? [`*** FLOP *** [7s 2c 9d]`, ...flop] : []),
    `*** SUMMARY ***`,
  ].join('\n')
}

function parse(text) {
  const hands = parsePokerStarsHands(text)
  return hands[0]
}

// A — Hero opent, Villain 3-bettet, Hero foldet
{
  const h = parse(build([
    `Villain: folds`,
    `Hero: raises 40 to 60`,
    `Villain2: raises 120 to 180`,
    `Hero: folds`,
  ]))
  ok('A: pfr', h.pfr === 1)
  ok('A: faced 3-bet (fourBetOpp)', h.fourBetOpp === 1)
  ok('A: kein 4-bet', h.fourBet === 0)
  ok('A: foldTo3BetOpp', h.foldTo3BetOpp === 1)
  ok('A: foldTo3Bet', h.foldTo3Bet === 1)
  ok('A: kein sawFlop', h.sawFlop === 0)
}

// B — Hero 3-bettet
{
  const h = parse(build([
    `Villain: raises 40 to 60`,
    `Hero: raises 120 to 180`,
    `Villain: folds`,
  ]))
  ok('B: threeBetOpp', h.threeBetOpp === 1)
  ok('B: threeBet', h.threeBet === 1)
  ok('B: kein fourBetOpp', h.fourBetOpp === 0)
  ok('B: kein foldTo3Bet', h.foldTo3Bet === 0)
}

// C — Hero PFA, c-bettet Flop
{
  const h = parse(build(
    [`Hero: raises 40 to 60`, `Villain: calls 60`],
    [`Villain: checks`, `Hero: bets 50`, `Villain: folds`],
  ))
  ok('C: cbetFlopOpp', h.cbetFlopOpp === 1)
  ok('C: cbetFlop', h.cbetFlop === 1)
  ok('C: kein foldToCbet', h.foldToCbet === 0)
}

// D — Hero nicht PFA, foldet zur C-Bet
{
  const h = parse(build(
    [`Hero: raises 40 to 60`, `Villain: raises 120 to 180`, `Hero: calls 120`],
    [`Hero: checks`, `Villain: bets 50`, `Hero: folds`],
  ))
  ok('D: kein cbetFlopOpp (nicht PFA)', h.cbetFlopOpp === 0)
  ok('D: foldToCbetOpp', h.foldToCbetOpp === 1)
  ok('D: foldToCbet', h.foldToCbet === 1)
  ok('D: checkRaiseFlopOpp', h.checkRaiseFlopOpp === 1)
  ok('D: kein checkRaiseFlop', h.checkRaiseFlop === 0)
}

// E — Hero check-raist Flop
{
  const h = parse(build(
    [`Hero: raises 40 to 60`, `Villain: raises 120 to 180`, `Hero: calls 120`],
    [`Hero: checks`, `Villain: bets 50`, `Hero: raises 100 to 150`, `Villain: calls 100`],
  ))
  ok('E: checkRaiseFlopOpp', h.checkRaiseFlopOpp === 1)
  ok('E: checkRaiseFlop', h.checkRaiseFlop === 1)
  ok('E: foldToCbetOpp (Cbet gesehen)', h.foldToCbetOpp === 1)
  ok('E: kein foldToCbet', h.foldToCbet === 0)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
