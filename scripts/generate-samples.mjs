/**
 * Generates realistic PokerStars + GGPoker sample data for manual testing.
 * Run: node scripts/generate-samples.mjs
 * Output: D:/Code/samples/generated/
 */

import fs from 'fs'
import path from 'path'

const OUT = 'D:/Code/samples/generated'
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(path.join(OUT, 'Pokerstars'), { recursive: true })

const HERO = 'DerGamingOpa'
const RNG_SEED = 42

// Seeded PRNG (mulberry32)
function makePrng(seed) {
  let s = seed
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const rng = makePrng(RNG_SEED)

const NAMES = [
  'BluffMaster99','PokerKing77','AllInAnna','NittyGritty','TiltKing',
  'RiverRat42','FlopMaster','AceHunter','CardShark','SemiBluff',
  'PotOdds','CallStation','ChipLeader','ThunderFold','Raiser2000',
  'SilverStack','GrindKing','BubbleBoy','ShoveMonkey','OpenFold',
]
const COUNTRIES = ['Österreich','Schweiz','Vereinigtes Königreich','Kanada','Brasilien','Frankreich','Spanien','Schweden']

const rndName  = () => NAMES[Math.floor(rng() * NAMES.length)]
const rndCountry = () => COUNTRIES[Math.floor(rng() * COUNTRIES.length)]

// Date helpers
function addDays(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() + Math.floor(days))
  return d
}
function fmtDE(d) {
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const mi = String(d.getMinutes()).padStart(2,'0')
  const ss = String(d.getSeconds()).padStart(2,'0')
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}:${ss} MEZ`
}
function fmtGG(d) {
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const mi = String(d.getMinutes()).padStart(2,'0')
  const ss = String(d.getSeconds()).padStart(2,'0')
  return `${d.getFullYear()}/${mm}/${dd} ${hh}:${mi}:${ss}`
}
function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v-20)%10] || s[v] || s[0])
}

// Payout multiplier distribution (realistic ~18% ITM)
function payoutMultiplier() {
  const r = rng()
  if (r < 0.72) return 0           // no cash
  if (r < 0.84) return 1.2 + rng() * 0.7   // < 2× (small cash)
  if (r < 0.92) return 2.0 + rng() * 2.8   // 2–5×
  if (r < 0.97) return 5.0 + rng() * 5.0   // 5–10×
  return 10.0 + rng() * 20.0               // 10–30× (big score)
}

// ─── PokerStars summaries ──────────────────────────────────────────────────

const PS_CONFIGS = [
  { name: 'No Limit Hold\'em',        buyIn: 1.80, fee: 0.20 },
  { name: 'No Limit Hold\'em Turbo',  buyIn: 1.80, fee: 0.20 },
  { name: 'No Limit Hold\'em Hyper',  buyIn: 0.92, fee: 0.08 },
  { name: 'No Limit Hold\'em',        buyIn: 4.50, fee: 0.50 },
  { name: 'No Limit Hold\'em Turbo',  buyIn: 4.50, fee: 0.50 },
  { name: 'No Limit Hold\'em Hyper',  buyIn: 4.50, fee: 0.50 },
  { name: 'No Limit Hold\'em',        buyIn: 9.10, fee: 0.90 },
  { name: 'No Limit Hold\'em Turbo',  buyIn: 9.10, fee: 0.90 },
  { name: 'No Limit Hold\'em',        buyIn: 20.00, fee: 2.00 },
  { name: 'No Limit Hold\'em Hyper',  buyIn: 9.10, fee: 0.90 },
  { name: 'No Limit Hold\'em',        buyIn: 45.00, fee: 5.00 },
  { name: 'No Limit Hold\'em Turbo',  buyIn: 20.00, fee: 2.00 },
]

const BASE_DATE = new Date('2026-01-06T19:00:00')
let psIdBase   = 3990000000
let handIdBase = 260000000000

let psContent = ''

for (let i = 0; i < 120; i++) {
  psIdBase += Math.floor(rng() * 5000) + 500
  handIdBase += Math.floor(rng() * 1000000) + 100000

  const cfg = PS_CONFIGS[i % PS_CONFIGS.length]
  const totalBuyIn = cfg.buyIn + cfg.fee

  // re-entry in ~10% of cases
  const reEntry = rng() < 0.10
  const entries = reEntry ? 2 : 1
  const totalCost = totalBuyIn * entries

  const fieldSize = 300 + Math.floor(rng() * 2500)
  const prizePool = (totalBuyIn * fieldSize * 0.9).toFixed(2)

  // Spread dates across ~4 months with random hour between 17-23
  const daysOffset = (i / 120) * 112 + rng() * 2
  const d = addDays(BASE_DATE, daysOffset)
  d.setHours(17 + Math.floor(rng() * 6), Math.floor(rng() * 60), Math.floor(rng() * 60))
  const dateStr = fmtDE(d)

  const mult = payoutMultiplier()
  const payout = mult > 0 ? (totalCost * mult).toFixed(2) : '0'
  const finishPct = mult > 0 ? fieldSize * 0.01 + rng() * fieldSize * 0.17 : fieldSize * 0.18 + rng() * fieldSize * 0.80
  const place = Math.max(1, Math.round(finishPct))

  const payoutLine = mult > 0
    ? `  ${place}: ${HERO} (Deutschland), $${payout} (${(Number(payout) / Number(prizePool) * 100).toFixed(3)}%)`
    : `  ${place}: ${HERO} (Deutschland), `

  const bustHandId = psIdBase + 100000000
  const reEntryNote = reEntry ? ` (Re-Entry)` : ''

  psContent += `PokerStars Turnier #${psIdBase}, ${cfg.name}${reEntryNote}
Buy-in: $${cfg.buyIn.toFixed(2)}/$${cfg.fee.toFixed(2)} USD
${fieldSize} Spieler
Preispool gesamt: $${prizePool} USD
Turnierbeginn ${dateStr} [${dateStr.replace('MEZ','ET')}]

  1: ${rndName()} (${rndCountry()}), spielt noch
  2: ${rndName()} (${rndCountry()}), spielt noch
  3: ${rndName()} (${rndCountry()}), spielt noch
${payoutLine}

Du hast den ${place}. Platz belegt (in Hand #${bustHandId} aus dem Turnier ausgeschieden).

`
}

const psFile = path.join(OUT, 'Pokerstars', 'generated_summaries.txt')
fs.writeFileSync(psFile, psContent, 'utf8')
console.log(`PS: ${psFile}  (120 Turniere)`)

// ─── GGPoker summaries ────────────────────────────────────────────────────

const GG_CONFIGS = [
  { name: 'Daily Hyper $1',    buyIn: 0.92, fee: 0.08, speed: 'Hyper' },
  { name: 'Daily Turbo $2',    buyIn: 1.80, fee: 0.20, speed: 'Turbo' },
  { name: 'Daily Regular $2',  buyIn: 1.80, fee: 0.20, speed: 'Regular' },
  { name: 'Daily Hyper $5',    buyIn: 4.50, fee: 0.50, speed: 'Hyper' },
  { name: 'Daily Turbo $5',    buyIn: 4.50, fee: 0.50, speed: 'Turbo' },
  { name: 'Daily Regular $10', buyIn: 9.10, fee: 0.90, speed: 'Regular' },
  { name: 'Daily Hyper $10',   buyIn: 9.10, fee: 0.90, speed: 'Hyper' },
  { name: 'Daily Turbo $10',   buyIn: 9.10, fee: 0.90, speed: 'Turbo' },
  { name: 'T Builder $0.25',   buyIn: 0.23, fee: 0.02, speed: 'Regular' },
  { name: 'T Builder $0.50',   buyIn: 0.46, fee: 0.04, speed: 'Regular' },
]

let ggIdBase = 271500000
let ggContent = ''

for (let i = 0; i < 80; i++) {
  ggIdBase += Math.floor(rng() * 10000) + 1000

  const cfg = GG_CONFIGS[i % GG_CONFIGS.length]
  const totalBuyIn = cfg.buyIn + cfg.fee

  const fieldSize = 500 + Math.floor(rng() * 3000)
  const prizePool = (totalBuyIn * fieldSize * 0.94).toFixed(2)

  const daysOffset = (i / 80) * 112 + rng() * 2
  const d = addDays(BASE_DATE, daysOffset)
  d.setHours(17 + Math.floor(rng() * 6), Math.floor(rng() * 60), Math.floor(rng() * 60))
  const dateStr = fmtGG(d)

  const mult = payoutMultiplier()
  const payout = mult > 0 ? (totalBuyIn * mult).toFixed(2) : '0'
  const finishPct = mult > 0 ? fieldSize * 0.01 + rng() * fieldSize * 0.17 : fieldSize * 0.18 + rng() * fieldSize * 0.80
  const place = Math.max(1, Math.round(finishPct))

  ggContent += `Tournament #${ggIdBase}, ${cfg.name}, Hold'em No Limit
Buy-in: $${cfg.buyIn.toFixed(2)}+$${cfg.fee.toFixed(2)}
${fieldSize} Players
Total Prize Pool: $${prizePool}
Tournament started ${dateStr}
${ordinal(place)} : Hero, $${payout}
You finished the tournament in ${ordinal(place)} place.
You received a total of $${payout}.

`
}

const ggFile = path.join(OUT, 'ggpoker_generated.txt')
fs.writeFileSync(ggFile, ggContent, 'utf8')
console.log(`GG: ${ggFile}  (80 Turniere)`)

// ─── PokerStars Hand Histories ────────────────────────────────────────────

// Generate realistic hands for 15 tournaments (for PlayStyle stats)
// Hero: VPIP ~26%, PFR ~19%, 3bet ~7%, AF ~2.2

const HH_CONFIGS = [
  { tid: '3993000001', buyIn: '4.50', fee: '0.50', game: 'No Limit Hold\'em', level: 'Level III (25/50)' },
  { tid: '3993000002', buyIn: '9.10', fee: '0.90', game: 'No Limit Hold\'em', level: 'Level II (15/30)' },
  { tid: '3993000003', buyIn: '1.80', fee: '0.20', game: 'No Limit Hold\'em Turbo', level: 'Level IV (50/100)' },
  { tid: '3993000004', buyIn: '4.50', fee: '0.50', game: 'No Limit Hold\'em Hyper', level: 'Level II (25/50)' },
  { tid: '3993000005', buyIn: '9.10', fee: '0.90', game: 'No Limit Hold\'em', level: 'Level V (75/150)' },
  { tid: '3993000006', buyIn: '20.00', fee: '2.00', game: 'No Limit Hold\'em', level: 'Level III (25/50)' },
  { tid: '3993000007', buyIn: '1.80', fee: '0.20', game: 'No Limit Hold\'em', level: 'Level II (15/30)' },
  { tid: '3993000008', buyIn: '4.50', fee: '0.50', game: 'No Limit Hold\'em Turbo', level: 'Level III (30/60)' },
  { tid: '3993000009', buyIn: '9.10', fee: '0.90', game: 'No Limit Hold\'em Hyper', level: 'Level IV (50/100)' },
  { tid: '3993000010', buyIn: '20.00', fee: '2.00', game: 'No Limit Hold\'em Turbo', level: 'Level II (20/40)' },
  { tid: '3993000011', buyIn: '45.00', fee: '5.00', game: 'No Limit Hold\'em', level: 'Level I (10/20)' },
  { tid: '3993000012', buyIn: '9.10', fee: '0.90', game: 'No Limit Hold\'em', level: 'Level III (25/50)' },
  { tid: '3993000013', buyIn: '4.50', fee: '0.50', game: 'No Limit Hold\'em', level: 'Level II (15/30)' },
  { tid: '3993000014', buyIn: '1.80', fee: '0.20', game: 'No Limit Hold\'em Hyper', level: 'Level III (30/60)' },
  { tid: '3993000015', buyIn: '9.10', fee: '0.90', game: 'No Limit Hold\'em', level: 'Level IV (50/100)' },
]

const HOLE_CARDS = ['Ah Kd','Qh Qs','Jc Td','As Js','Kh Kc','9h 8h','7c 7d','Ad 5d','2h 2c','Th 9s']
const OPP_CARDS  = ['Kc Qd','Jh Js','8c 8d','Ac 7h','5s 4s','Ts 9c','6h 6c','Qd Jd','3h 3c','Ah 2c']
const BOARD_FLOP = ['2c 7h Kd','Ah 3s 9c','Qd Jh 4c','Ts 6d 2h','Kc 8h 5s']
const BOARD_TURN = ['Qh','7c','As','Jd','4h']
const BOARD_RIVER = ['3s','Tc','6h','9d','Kh']

function heroCard() { return HOLE_CARDS[Math.floor(rng() * HOLE_CARDS.length)] }
function oppCard()  { return OPP_CARDS[Math.floor(rng() * OPP_CARDS.length)] }
function flopBoard(){ return BOARD_FLOP[Math.floor(rng() * BOARD_FLOP.length)] }
function turnCard() { return BOARD_TURN[Math.floor(rng() * BOARD_TURN.length)] }
function riverCard(){ return BOARD_RIVER[Math.floor(rng() * BOARD_RIVER.length)] }

function generateHand(hid, tid, cfg, d, seat) {
  const bigBlind = parseInt(cfg.level.match(/\(.*?\/(\d+)\)/)[1])
  const stackSize = bigBlind * 50 + Math.floor(rng() * bigBlind * 30)
  const heroSeat = 1 + Math.floor(rng() * 9)

  // Hero action probabilities: VPIP ~26%, PFR when VPIP ~73%, 3bet when opp raised ~7%
  const oppRaisedPreflop = rng() < 0.55   // opponent raises preflop 55% of hands
  const heroVpip  = rng() < 0.26
  const heroPfr   = heroVpip && rng() < 0.73
  const hero3bet  = oppRaisedPreflop && rng() < 0.07
  const heroFoldedPre = !heroVpip && rng() < 0.74
  const sawFlop   = heroVpip && !heroFoldedPre
  const heroAgg   = sawFlop && rng() < 0.35  // postflop aggression
  const heroCall  = sawFlop && !heroAgg && rng() < 0.40
  const heroWtsd  = sawFlop && rng() < 0.25
  const heroWonSd = heroWtsd && rng() < 0.52
  const heroWon   = (!sawFlop && rng() < 0.05) || (sawFlop && !heroWtsd && rng() < 0.35) || heroWonSd

  const heroCards = heroCard()
  const oppCards  = oppCard()
  const flop = flopBoard()
  const turn = turnCard()
  const river = riverCard()

  const pot = bigBlind * (2 + Math.floor(rng() * 8))
  const betAmt = Math.floor(pot * 0.6)
  const raiseAmt = bigBlind * (3 + Math.floor(rng() * 3))
  const callAmt  = oppRaisedPreflop ? raiseAmt : bigBlind

  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const mi = String(d.getMinutes()).padStart(2,'0')
  const ss = String(d.getSeconds()).padStart(2,'0')
  const dateStr = `${d.getFullYear()}/${mm}/${dd} ${hh}:${mi}:${ss} ET`

  const preflopAction = hero3bet
    ? `${HERO}: erhöht auf ${raiseAmt * 3}`
    : heroPfr
      ? `${HERO}: erhöht auf ${raiseAmt}`
      : heroVpip
        ? `${HERO}: geht mit ${callAmt}`
        : heroFoldedPre
          ? `${HERO}: passt`
          : `${HERO}: passt`

  const postflopAction = !sawFlop ? '' : heroAgg
    ? `${HERO}: setzt ${betAmt}`
    : heroCall
      ? `${HERO}: geht mit ${betAmt}`
      : `${HERO}: checkt`

  const showdownSection = heroWtsd
    ? `\n*** SHOWDOWN ***\n${HERO}: zeigt [${heroCards}]\nOpponent: zeigt [${oppCards}]\n${heroWonSd ? `${HERO} gewinnt ($${pot})` : `Opponent gewinnt ($${pot})`}`
    : ''

  const wonLine = (heroWon && !heroWtsd) ? `${HERO} gewinnt ($${pot})` : ''

  const summaryHero = heroWtsd
    ? `Seat ${heroSeat}: ${HERO} zeigte [${heroCards}] und ${heroWonSd ? 'gewann' : 'verlor'} ($${pot})`
    : `Seat ${heroSeat}: ${HERO} ${heroFoldedPre ? 'passte' : heroVpip ? 'passte' : 'passte'}`

  return `PokerStars Hand #${hid}: Turnier #${tid}, $${cfg.buyIn}+$${cfg.fee} USD ${cfg.game} - ${cfg.level} - ${dateStr}
Table '${tid} ${seat}' 9-max Seat #${1 + Math.floor(rng()*9)} is the button
Seat 1: ${rndName()} (${stackSize + 200} in chips)
Seat 2: ${rndName()} (${stackSize + 100} in chips)
Seat ${heroSeat}: ${HERO} (${stackSize} in chips)
Seat 5: ${rndName()} (${stackSize - 150} in chips)
Seat 6: ${rndName()} (${stackSize + 300} in chips)
${HERO}: setzt Small Blind ${bigBlind/2}
${rndName()}: setzt Big Blind ${bigBlind}
*** HOLE CARDS ***
Dealt to ${HERO} [${heroCards}]
${rndName()}: passt
${rndName()}: ${oppRaisedPreflop ? `erhöht auf ${raiseAmt}` : 'passt'}
${preflopAction}
*** FLOP *** [${flop}]
${postflopAction}
${wonLine}${showdownSection}
*** ZUSAMMENFASSUNG ***
Total pot $${pot}
Board [${flop} ${turn} ${river}]
${summaryHero}

`
}

let hhContent = ''
let hhHandId = 260500000000
const hhBaseDate = new Date('2026-01-10T19:00:00')

for (const cfg of HH_CONFIGS) {
  const handsPerTournament = 15 + Math.floor(rng() * 20)
  const dOffset = rng() * 100
  const td = addDays(hhBaseDate, dOffset)

  for (let h = 0; h < handsPerTournament; h++) {
    hhHandId += Math.floor(rng() * 5000) + 1000
    const hd = new Date(td.getTime() + h * (60000 + Math.floor(rng() * 120000)))
    hhContent += generateHand(hhHandId, cfg.tid, cfg, hd, 1 + Math.floor(rng() * 5))
  }
}

const hhFile = path.join(OUT, 'Pokerstars', 'generated_hands.txt')
fs.writeFileSync(hhFile, hhContent, 'utf8')
console.log(`HH: ${hhFile}  (${HH_CONFIGS.length} Turniere, ~${HH_CONFIGS.length * 22} Hände)`)

console.log('\nFertig. Dateien können jetzt in der App importiert werden.')
