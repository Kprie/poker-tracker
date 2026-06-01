import { useEffect, useState } from 'react'
import type { ActionType, Position } from '../data/pushFoldData'
import { availablePositions, findSpot } from '../data/pushFoldData'
import { HandGrid, HandGridLegend } from './HandGrid'

// ─── Gespeicherte Spots (localStorage) ───────────────────────────────────────

interface SavedSpot {
  id: string
  name: string
  players: number
  position: Position
  stackBb: number
  action: ActionType
}

const STORAGE_KEY = 'poker-tracker:saved-pf-spots'

function loadSaved(): SavedSpot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedSpot[]) : []
  } catch {
    return []
  }
}

function saveSaved(spots: SavedSpot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spots))
  } catch { /* stille Ignorierung */ }
}

// ─── Hilfswerte ───────────────────────────────────────────────────────────────

type PlayerCount = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

const ACTION_LABELS: Record<ActionType, string> = {
  push: 'Open-Push',
  call: 'Call gegen Push',
  overcall: 'Overcall',
}

const selectCls = 'bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent'

// ─── Komponente ───────────────────────────────────────────────────────────────

export function PushFoldPanel(): JSX.Element {
  const [players, setPlayers]       = useState<PlayerCount>(2)
  const [position, setPosition]     = useState<Position>('SB')
  const [stackBb, setStackBb]       = useState(10)
  const [stackInput, setStackInput] = useState('10')
  const [action, setAction]         = useState<ActionType>('push')
  const [copyState, setCopyState]   = useState<'idle' | 'copied'>('idle')

  // Spot speichern
  const [savedSpots, setSavedSpots]   = useState<SavedSpot[]>(loadSaved)
  const [saveInput, setSaveInput]     = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  useEffect(() => { saveSaved(savedSpots) }, [savedSpots])

  function handlePlayersChange(n: PlayerCount): void {
    setPlayers(n)
    const positions = availablePositions(n)
    if (!positions.includes(position)) setPosition(positions[0])
  }

  function handleSliderChange(val: number): void {
    setStackBb(val)
    setStackInput(String(val))
  }

  function handleInputChange(val: string): void {
    setStackInput(val)
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 2 && n <= 25) setStackBb(n)
  }

  function handleSaveSpot(): void {
    const name = saveInput.trim() || `${players}-handed ${position} ${stackBb} BB ${ACTION_LABELS[action]}`
    const spot: SavedSpot = {
      id: crypto.randomUUID(),
      name,
      players,
      position,
      stackBb,
      action,
    }
    setSavedSpots(prev => [spot, ...prev])
    setSaveInput('')
    setShowSaveForm(false)
  }

  function handleLoadSpot(s: SavedSpot): void {
    const positions = availablePositions(s.players)
    setPlayers(s.players as PlayerCount)
    setPosition(positions.includes(s.position) ? s.position : positions[0])
    setStackBb(s.stackBb)
    setStackInput(String(s.stackBb))
    setAction(s.action)
  }

  function handleDeleteSpot(id: string): void {
    setSavedSpots(prev => prev.filter(s => s.id !== id))
  }

  const result = findSpot(players, position, stackBb, action)

  function handleCopy(): void {
    if (!result) return
    const profitable = Object.entries(result.spot.hands)
      .filter(([, e]) => e !== null && e.ev !== null && e.ev > 0)
      .sort(([, a], [, b]) => ((b?.ev ?? 0) - (a?.ev ?? 0)))
      .map(([id, e]) => (e?.freq !== null ? `${id}(${e?.freq}%)` : id))
      .join(',')

    navigator.clipboard.writeText(profitable).then(
      () => { setCopyState('copied'); setTimeout(() => setCopyState('idle'), 1500) },
      () => { /* stille Ignorierung */ },
    )
  }

  const copyLabel = action === 'push' ? 'Push-Range kopieren' : 'Call-Range kopieren'
  const positions = availablePositions(players)

  return (
    <div className="card p-5 md:p-6 flex flex-col gap-5">
      {/* ── Steuerung ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Spieleranzahl</label>
          <select
            className={selectCls}
            value={players}
            onChange={e => handlePlayersChange(Number(e.target.value) as PlayerCount)}
          >
            {([2, 3, 4, 5, 6, 7, 8, 9] as PlayerCount[]).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Position</label>
          <select className={selectCls} value={position} onChange={e => setPosition(e.target.value as Position)}>
            {positions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Stack in BB</label>
          <div className="flex items-center gap-2">
            <input
              type="range" min={2} max={25} step={0.5}
              value={stackBb}
              onChange={e => handleSliderChange(parseFloat(e.target.value))}
              className="w-32 accent-accent"
            />
            <input
              type="number" min={2} max={25} step={0.5}
              value={stackInput}
              onChange={e => handleInputChange(e.target.value)}
              className="bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm text-text tabnum focus:outline-none focus:ring-1 focus:ring-accent w-16"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Aktion</label>
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
            {(['push', 'call', 'overcall'] as ActionType[]).map(a => (
              <button
                key={a}
                className={`px-3 py-1.5 transition-colors ${action === a ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-text'}`}
                onClick={() => setAction(a)}
              >
                {ACTION_LABELS[a]}
              </button>
            ))}
          </div>
        </div>

        {/* Spot speichern */}
        <div className="flex flex-col gap-1 ml-auto">
          <label className="text-xs text-muted opacity-0">_</label>
          {showSaveForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Name (optional)"
                className="bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent w-44"
                value={saveInput}
                onChange={e => setSaveInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveSpot() }}
                autoFocus
              />
              <button className="btn-primary text-xs py-1.5 px-3" onClick={handleSaveSpot}>Speichern</button>
              <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setShowSaveForm(false)}>✕</button>
            </div>
          ) : (
            <button className="btn-ghost text-xs" onClick={() => setShowSaveForm(true)}>
              Spot speichern
            </button>
          )}
        </div>
      </div>

      {/* ── Grid-Inhaltsbereich ───────────────────────────────────────────── */}
      {!result ? (
        <div className="rounded-lg border border-white/10 px-4 py-6 text-sm text-muted text-center">
          Für diesen Spot sind noch keine Referenzdaten vorhanden.
        </div>
      ) : (
        <>
          {!result.exact && (
            <p className="text-xs text-muted">
              Nächste verfügbare Tiefe:{' '}
              <span className="text-text font-medium tabnum">{result.spot.stackBb} BB</span>
            </p>
          )}
          <HandGrid data={result.spot.hands} action={action} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <HandGridLegend />
            <button className="btn-ghost text-xs shrink-0" onClick={handleCopy}>
              {copyState === 'copied' ? '✓ Kopiert' : copyLabel}
            </button>
          </div>
        </>
      )}

      {/* ── Gespeicherte Spots ────────────────────────────────────────────── */}
      {savedSpots.length > 0 && (
        <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">Gespeicherte Spots</p>
          <div className="flex flex-col gap-1">
            {savedSpots.map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.03] group"
              >
                <button
                  className="text-sm text-text text-left truncate flex-1 hover:text-accent transition-colors"
                  onClick={() => handleLoadSpot(s)}
                  title="Klicken zum Laden"
                >
                  {s.name}
                </button>
                <span className="text-xs text-muted tabnum mr-3 shrink-0">
                  {s.players}-handed · {s.position} · {s.stackBb} BB · {ACTION_LABELS[s.action]}
                </span>
                <button
                  className="text-muted hover:text-loss transition-colors opacity-0 group-hover:opacity-100 text-xs"
                  onClick={() => handleDeleteSpot(s.id)}
                  title="Löschen"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
