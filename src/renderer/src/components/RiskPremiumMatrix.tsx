import { requiredCallEquity, riskPremium } from '../lib/icm'

interface Props {
  bubbleFactors: number[][]
  playerCount: number
}

function cellClass(rp: number): string {
  if (isNaN(rp)) return 'text-muted'
  if (rp >= 0.20) return 'bg-red-900/50 text-red-300 font-semibold'
  if (rp >= 0.10) return 'bg-orange-900/40 text-orange-300'
  if (rp >= 0.03) return 'bg-yellow-900/30 text-yellow-200'
  return 'text-slate-400'
}

/**
 * Benötigte Call-Equity je Gegner, abgeleitet aus dem Bubble Factor
 * (= BF/(1+BF)). Zeigt, wie viel mehr als die Chip-EV-Schwelle (50 %) Hero
 * gegen einen All-in dieses Gegners braucht (Risk Premium).
 */
export function RiskPremiumMatrix({ bubbleFactors, playerCount }: Props): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Benötigte Call-Equity gegen ein All-in (Zeile = Hero, Spalte = Gegner). 50 % = Chip-EV-neutral;
        darüber liegt der <span className="text-text">Risk Premium</span>.
      </p>
      <div className="overflow-x-auto">
        <table className="text-center text-xs">
          <thead>
            <tr>
              <th className="px-3 py-2 text-muted font-medium" />
              {Array.from({ length: playerCount }, (_, j) => (
                <th key={j} className="px-3 py-2 text-muted font-medium">Sp.&nbsp;{j + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bubbleFactors.slice(0, playerCount).map((row, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-3 py-2 text-muted font-medium text-left">Sp.&nbsp;{i + 1}</td>
                {row.slice(0, playerCount).map((bf, j) => {
                  if (i === j) return <td key={j} className="px-3 py-2 text-muted">—</td>
                  const req = requiredCallEquity(bf)
                  const rp = riskPremium(bf)
                  const display = isNaN(req) ? '—' : `${(req * 100).toFixed(0)} %`
                  const tip = isNaN(rp) ? undefined
                    : `Hero (Sp. ${i + 1}) braucht ${(req * 100).toFixed(1)} % Equity, um den All-in von Sp. ${j + 1} zu callen — Risk Premium ${(rp * 100).toFixed(1)} %-Pkt.`
                  return (
                    <td key={j} title={tip} className={`tabnum px-3 py-2 rounded ${cellClass(rp)}`}>{display}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
