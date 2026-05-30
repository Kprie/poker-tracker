interface Props {
  label: string
  value: string
  sub?: string
  tone?: 'profit' | 'loss' | 'neutral'
  /** Larger value type for emphasis tiles. */
  size?: 'sm' | 'md'
}

export function KpiTile({ label, value, sub, tone = 'neutral', size = 'sm' }: Props): JSX.Element {
  const toneClass =
    tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-text'
  return (
    <div className="tile p-4">
      <div className="text-[10px] uppercase tracking-eyebrow text-muted/80">{label}</div>
      <div
        className={`tabnum mt-2 font-semibold leading-none tracking-tight ${toneClass} ${
          size === 'md' ? 'text-[1.6rem]' : 'text-[1.3rem]'
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-muted">{sub}</div>}
    </div>
  )
}
