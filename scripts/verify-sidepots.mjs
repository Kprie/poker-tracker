import { buildSidePots } from '../src/renderer/src/lib/sidePots.ts'

let failures = 0

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0)
}

function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function check(name, actual, expected) {
  if (eq(actual, expected)) {
    console.log(`PASS  ${name}`)
  } else {
    failures++
    console.log(`FAIL  ${name}`)
    console.log(`      expected: ${JSON.stringify(expected)}`)
    console.log(`      actual:   ${JSON.stringify(actual)}`)
  }
}

function checkConservation(name, contributions) {
  const layers = buildSidePots(contributions)
  const layerSum = sum(layers.map(l => l.amount))
  const contribSum = sum([...contributions])
  if (layerSum === contribSum) {
    console.log(`PASS  ${name} (Σ amount=${layerSum} == Σ contributions=${contribSum})`)
  } else {
    failures++
    console.log(`FAIL  ${name} (Σ amount=${layerSum} != Σ contributions=${contribSum})`)
  }
}

// --- Feste Testfälle ---

check('[100,100,100]', buildSidePots([100, 100, 100]), [{ amount: 300, eligible: [0, 1, 2] }])

check('[50,100,100]', buildSidePots([50, 100, 100]), [
  { amount: 150, eligible: [0, 1, 2] },
  { amount: 100, eligible: [1, 2] },
])

check('[100,50,25]', buildSidePots([100, 50, 25]), [
  { amount: 75, eligible: [0, 1, 2] },
  { amount: 50, eligible: [0, 1] },
  { amount: 50, eligible: [0] },
])

check('[0,100,100]', buildSidePots([0, 100, 100]), [{ amount: 200, eligible: [1, 2] }])

check('[200,0,0]', buildSidePots([200, 0, 0]), [{ amount: 200, eligible: [0] }])

// Leere Eingabe / alle 0 → leeres Array.
check('[] (leer)', buildSidePots([]), [])
check('[0,0,0]', buildSidePots([0, 0, 0]), [])

// --- Chip-Erhaltung für die festen Fälle ---

checkConservation('Erhaltung [100,100,100]', [100, 100, 100])
checkConservation('Erhaltung [50,100,100]', [50, 100, 100])
checkConservation('Erhaltung [100,50,25]', [100, 50, 25])
checkConservation('Erhaltung [0,100,100]', [0, 100, 100])
checkConservation('Erhaltung [200,0,0]', [200, 0, 0])

// --- Zufalls-Test: 100 zufällige Arrays, Chip-Erhaltung ---

let randomFails = 0
for (let t = 0; t < 100; t++) {
  const len = 2 + Math.floor(Math.random() * 5) // 2–6
  const contributions = Array.from({ length: len }, () => Math.floor(Math.random() * 1001)) // 0–1000
  const layers = buildSidePots(contributions)
  const layerSum = sum(layers.map(l => l.amount))
  const contribSum = sum(contributions)
  if (layerSum !== contribSum) {
    randomFails++
    failures++
    console.log(`FAIL  Zufall #${t}: ${JSON.stringify(contributions)} → Σ amount=${layerSum} != Σ contributions=${contribSum}`)
  }
}
if (randomFails === 0) {
  console.log('PASS  Zufalls-Test (100 Arrays, Chip-Erhaltung)')
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)
