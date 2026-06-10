interface Props {
  bubbleFactors: number[][]
  playerCount: number
}

function cellClass(value: number): string {
  if (isNaN(value)) return 'text-muted'
  if (!isFinite(value)) return 'text-muted'
  if (value >= 2.0) return 'bg-red-900/50 text-red-300 font-semibold'
  if (value >= 1.4) return 'bg-orange-900/40 text-orange-300'
  if (value >= 1.0) return 'bg-yellow-900/30 text-yellow-200'
  return 'text-neutral-400'
}

export function BubbleFactorMatrix({ bubbleFactors, playerCount }: Props): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="text-center text-xs">
        <thead>
          <tr>
            <th className="px-3 py-2 text-muted font-medium" />
            {Array.from({ length: playerCount }, (_, j) => (
              <th key={j} className="px-3 py-2 text-muted font-medium">
                Sp.&nbsp;{j + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bubbleFactors.slice(0, playerCount).map((row, i) => (
            <tr key={i} className="border-t border-white/5">
              <td className="px-3 py-2 text-muted font-medium text-left">Sp.&nbsp;{i + 1}</td>
              {row.slice(0, playerCount).map((val, j) => {
                if (i === j) {
                  return <td key={j} className="px-3 py-2 text-muted">—</td>
                }
                const display = isNaN(val) ? '—' : !isFinite(val) ? '∞' : val.toFixed(2)
                const tooltip = isNaN(val) || !isFinite(val)
                  ? undefined
                  : `Spieler ${i + 1}: Verlust an Spieler ${j + 1} wiegt ${val.toFixed(2)}× stärker als Gewinn von Spieler ${j + 1}`
                return (
                  <td
                    key={j}
                    title={tooltip}
                    className={`tabnum px-3 py-2 rounded ${cellClass(val)}`}
                  >
                    {display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
