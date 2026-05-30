import { useState } from 'react'
import { useStore } from '../store'
import type { SourceFilter } from '../lib/analytics'
import { Logo } from './Logo'
import { ArrowUpRight, ChevronDown, Folder, Scan, Settings, Upload } from './icons'

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
  const [openSettings, setOpenSettings] = useState(false)

  const applyPreset = (days: number | 'all'): void => {
    if (days === 'all') setFilters({ from: null, to: null })
    else setFilters({ from: isoDaysAgo(days), to: null })
  }

  return (
    <header className="sticky top-0 z-nav px-6 pt-4 pb-3">
      <div className="mx-auto max-w-[1400px]">
        <div className="card bg-surface/80 px-4 py-3 backdrop-blur-xl">
          {/* Row 1: brand + actions, edge-aligned */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo size={38} />
              <div className="leading-none">
                <h1 className="text-[17px] font-semibold tracking-tightest">Poker Tracker</h1>
                <p className="mt-1 text-[11px] text-muted">PokerStars &amp; GGPoker</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenSettings((v) => !v)}
                className={`btn-ghost !px-2.5 ${openSettings ? '!border-accent/40 !bg-white/[0.07]' : ''}`}
                aria-expanded={openSettings}
                title="Ordner-Einstellungen"
              >
                <Settings width={16} height={16} />
                <ChevronDown
                  width={14}
                  height={14}
                  className={`transition-transform duration-300 ease-fluid ${openSettings ? 'rotate-180' : ''}`}
                />
              </button>
              <button onClick={scanPokerStars} disabled={!!busy} className="btn-ghost">
                <Scan width={16} height={16} className="text-ps" />
                PokerStars einlesen
              </button>
              <button onClick={importGGPoker} disabled={!!busy} className="btn-primary">
                <Upload width={15} height={15} />
                PokerCraft hochladen
              </button>
            </div>
          </div>

          <div className="my-3 h-px bg-white/[0.06]" />

          {/* Row 2: source filter (left) + date range (right) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setFilters({ source: s.key })}
                  className={`seg ${filters.source === s.key ? 'seg-active' : ''}`}
                >
                  {s.dot && <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} />}
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {PRESETS.map((p) => (
                  <button key={p.label} className="chip" onClick={() => applyPreset(p.days)}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="date"
                  value={filters.from ?? ''}
                  onChange={(e) => setFilters({ from: e.target.value || null })}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-text [color-scheme:dark]"
                />
                <span className="opacity-50">–</span>
                <input
                  type="date"
                  value={filters.to ?? ''}
                  onChange={(e) => setFilters({ to: e.target.value || null })}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-text [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Collapsible folder settings */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-fluid ${
              openSettings ? 'mt-3 max-h-72 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5 md:grid-cols-2">
              <FolderRow
                icon={<Scan width={15} height={15} />}
                label="PokerStars-Ordner"
                value={settings.pokerStarsPath ?? 'nicht gefunden – bitte wählen'}
                onChange={chooseFolder}
              />
              <FolderRow
                icon={<Folder width={15} height={15} />}
                label="Datenordner"
                value={settings.dataDir ?? 'Standard'}
                onChange={chooseDataFolder}
              />
            </div>
            {(busy || lastScan) && (
              <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-muted">
                {busy ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    {busy}
                  </>
                ) : (
                  <span>Letzter Scan: {lastScan}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function FolderRow({
  icon,
  label,
  value,
  onChange
}: {
  icon: JSX.Element
  label: string
  value: string
  onChange: () => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-eyebrow text-muted">{label}</div>
        <div className="truncate font-mono text-xs text-text/90" title={value}>
          {value}
        </div>
      </div>
      <button
        onClick={onChange}
        className="inline-flex items-center gap-1 rounded-lg border border-accent/25 px-3 py-1.5 text-xs text-accent transition-colors duration-200 ease-fluid hover:bg-accent/10"
      >
        ändern
        <ArrowUpRight width={13} height={13} />
      </button>
    </div>
  )
}
