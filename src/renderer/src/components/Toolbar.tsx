import { useStore } from '../store'
import type { SourceFilter } from '../lib/analytics'

const SOURCES: { key: SourceFilter; label: string; dot?: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'pokerstars', label: 'PokerStars', dot: 'bg-ps' },
  { key: 'ggpoker', label: 'GGPoker', dot: 'bg-gg' }
]

const PRESETS: { label: string; days: number | 'all' }[] = [
  { label: '7T', days: 7 },
  { label: '30T', days: 30 },
  { label: '90T', days: 90 },
  { label: '1J', days: 365 },
  { label: 'Alle', days: 'all' }
]

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function Toolbar(): JSX.Element {
  const { settings, filters, busy, lastScan } = useStore()
  const setFilters = useStore((s) => s.setFilters)
  const scanPokerStars = useStore((s) => s.scanPokerStars)
  const importGGPoker = useStore((s) => s.importGGPoker)
  const chooseFolder = useStore((s) => s.chooseFolder)
  const chooseDataFolder = useStore((s) => s.chooseDataFolder)

  const applyPreset = (days: number | 'all'): void => {
    if (days === 'all') setFilters({ from: null, to: null })
    else setFilters({ from: isoDaysAgo(days), to: null })
  }

  return (
    <header className="sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-border">
      <div className="px-6 pt-5 pb-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-accent/25 to-accent/5 border border-accent/30 grid place-items-center text-accent text-xl shadow-glow">
              ♠
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-none tracking-tightest">Poker Tracker</h1>
              <p className="mt-1 text-xs text-muted">Turnier-Statistiken · PokerStars &amp; GGPoker</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={scanPokerStars} disabled={!!busy}>
              <span className="w-2 h-2 rounded-full bg-ps" /> PokerStars einlesen
            </button>
            <button className="btn-primary" onClick={importGGPoker} disabled={!!busy}>
              <span className="w-2 h-2 rounded-full bg-gg" /> PokerCraft hochladen
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Source filter */}
          <div className="flex items-center gap-1.5">
            {SOURCES.map((s) => (
              <button
                key={s.key}
                onClick={() => setFilters({ source: s.key })}
                className={`chip ${filters.source === s.key ? 'chip-active' : ''}`}
              >
                {s.dot && <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${s.dot}`} />}
                {s.label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} className="chip" onClick={() => applyPreset(p.days)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <input
                type="date"
                value={filters.from ?? ''}
                onChange={(e) => setFilters({ from: e.target.value || null })}
                className="bg-surface2 border border-border rounded-lg px-2.5 py-1.5 text-text"
              />
              <span>–</span>
              <input
                type="date"
                value={filters.to ?? ''}
                onChange={(e) => setFilters({ to: e.target.value || null })}
                className="bg-surface2 border border-border rounded-lg px-2.5 py-1.5 text-text"
              />
            </div>
          </div>
        </div>

        {/* PokerStars path */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="shrink-0">PokerStars-Ordner:</span>
          <code className="px-2 py-1 rounded bg-surface2 border border-border truncate max-w-[60ch]">
            {settings.pokerStarsPath ?? 'nicht gefunden – bitte wählen'}
          </code>
          <button className="text-accent hover:underline shrink-0" onClick={chooseFolder}>
            ändern
          </button>
        </div>

        {/* Data folder */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="shrink-0">Datenordner:</span>
          <code className="px-2 py-1 rounded bg-surface2 border border-border truncate max-w-[60ch]">
            {settings.dataDir ?? 'Standard'}
          </code>
          <button className="text-accent hover:underline shrink-0" onClick={chooseDataFolder}>
            ändern
          </button>
        </div>

        {lastScan && <div className="text-xs text-muted">Letzter Scan: {lastScan}</div>}
      </div>
      {busy && (
        <div className="px-6 pb-2 text-xs text-accent flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          {busy}
        </div>
      )}
    </header>
  )
}
