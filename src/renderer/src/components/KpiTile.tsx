interface Props {
  label: string
  value: string
  sub?: string
  tone?: 'profit' | 'loss' | 'neutral'
}

export function KpiTile({ label, value, sub, tone = 'neutral' }: Props): JSX.Element {
  const toneClass =
    tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-text'
  return (
    <div className="card p-4 transition-colors duration-300 ease-fluid hover:border-white/15">
      <div className="text-[10px] uppercase tracking-eyebrow text-muted">{label}</div>
      <div className={`tabnum mt-2 text-[1.4rem] font-semibold leading-none tracking-tight ${toneClass}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-muted">{sub}</div>}
    </div>
  )
}
