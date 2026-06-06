import { useEffect, useState } from 'react'

const KEY = 'pt.disclaimerAccepted.v4'

interface Point {
  icon: string
  tone: string
  text: JSX.Element
}

const POINTS: Point[] = [
  {
    icon: '✓',
    tone: 'text-profit',
    text: (
      <>
        Nur <span className="text-text">deine eigenen</span> Hand-Histories /
        PokerCraft-Exporte – keine Gegnerdaten, keine Massendatenanalyse.
      </>
    )
  },
  {
    icon: '✓',
    tone: 'text-profit',
    text: (
      <>
        Reine <span className="text-text">Nachbereitung nach der Session</span> – kein
        Echtzeit-HUD, kein Overlay, keine Spielhilfe während des Spiels.
      </>
    )
  },
  {
    icon: '✓',
    tone: 'text-profit',
    text: (
      <>
        Alle analysierten Hände sind <span className="text-text">abgeschlossen oder
        hypothetisch</span> – das Tool wird nicht zur Entscheidung in einer laufenden Hand genutzt.
      </>
    )
  },
  {
    icon: '✓',
    tone: 'text-profit',
    text: (
      <>
        Daten bleiben <span className="text-text">lokal</span> – kein Upload, keine Weitergabe.
      </>
    )
  },
  {
    icon: '!',
    tone: 'text-gg',
    text: (
      <>
        <span className="text-text">GGPoker</span> ist besonders restriktiv (Security &amp;
        Ecology Policy). Der Import erfolgt auf{' '}
        <span className="text-text">eigenes Risiko</span>; im Zweifel die PokerCraft-App selbst
        nutzen.
      </>
    )
  }
]

/**
 * One-time usage notice shown on first launch. Frames the app as a personal,
 * offline, own-data-only post-session tracker to stay within the sites' tool
 * policies (no real-time use, no HUD overlay, no opponent data, no sharing).
 */
export function Disclaimer(): JSX.Element | null {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setOpen(true)
  }, [])

  if (!open) return null

  const accept = (): void => {
    // Bestätigung lokal mit Zeitstempel speichern (TOS: dokumentierte Zustimmung).
    localStorage.setItem(KEY, JSON.stringify({ accepted: true, ts: new Date().toISOString() }))
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-modal grid place-items-center bg-black/70 p-4 backdrop-blur-md">
      <div className="card w-full max-w-lg p-6">
        <span className="eyebrow">Hinweis zur Nutzung</span>
        <h2 className="mb-2 mt-3 text-xl font-semibold tracking-tightest">Private Offline-Nutzung</h2>
        <p className="text-sm text-muted mb-5 leading-relaxed">
          Dieses Tool ist ausschließlich für die{' '}
          <span className="text-text">private Offline-Auswertung deiner eigenen Spielergebnisse</span>{' '}
          gedacht. Damit du im Rahmen der Richtlinien von PokerStars und GGPoker bleibst:
        </p>

        <ul className="space-y-3 mb-5">
          {POINTS.map((p, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
              <span className={`${p.tone} shrink-0 mt-0.5 w-4 text-center font-semibold`}>
                {p.icon}
              </span>
              <span className="text-muted">{p.text}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted mb-5 leading-relaxed">
          Keine Rechtsberatung. Prüfe die aktuellen Nutzungsbedingungen der Anbieter selbst.
        </p>

        <div className="flex justify-end">
          <button className="btn-primary" onClick={accept}>
            Verstanden
          </button>
        </div>
      </div>
    </div>
  )
}
