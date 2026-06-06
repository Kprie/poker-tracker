import { Section } from './Section'

// In-App-Referenz „Methodik & Annahmen" — Kurzfassung von docs/turnier-analyse-methodik.md.

function Status({ k }: { k: 'ok' | 'part' | 'plan' | 'no' }): JSX.Element {
  const map = {
    ok: ['✓ umgesetzt', 'text-profit'],
    part: ['◐ teilweise', 'text-[#f0a500]'],
    plan: ['◔ geplant', 'text-muted'],
    no: ['✕ nicht im Scope', 'text-loss'],
  } as const
  return <span className={`text-[11px] font-medium ${map[k][1]}`}>{map[k][0]}</span>
}

const MODULES: { name: string; status: 'ok' | 'part' | 'plan' | 'no'; note: string }[] = [
  { name: 'ICM-Equity (Malmuth-Harville)', status: 'ok', note: '0-Stacks erhalten unterste Auszahlung' },
  { name: 'Bubble-Factor- & Risk-Premium-Matrix', status: 'ok', note: 'benötigte Call-Equity = BF/(1+BF)' },
  { name: 'Deal & Satellite', status: 'ok', note: 'Chip-Chop vs. ICM-Chop, Ticket-Lock ≥95 %' },
  { name: 'Hand-Analyse (Equity + Outs)', status: 'ok', note: 'River/Turn/Flop exakt, Preflop MC' },
  { name: 'Equity-Labor (Multiway)', status: 'ok', note: '2–4 Hände, Handklassen, Draws' },
  { name: 'Spot-Analyse Push/Fold', status: 'ok', note: 'HU exakt + Multiway-exakt (Worker), Position real' },
  { name: 'Pot-Odds / Bet-EV', status: 'ok', note: 'Chip-EV, korrigierte Bet-EV-Formel' },
  { name: 'PKO-Bounty', status: 'part', note: 'nur sofortiger Bounty-EV' },
  { name: 'Tracking + BB/100 + Positions-Winrates', status: 'part', note: 'aus eigenen Hand-Histories' },
  { name: 'EV-BB/100 (All-in-adjustiert)', status: 'plan', note: 'erfordert Equity-Pass' },
  { name: 'Mystery Bounty · FGS', status: 'plan', note: 'zurückgestellt' },
  { name: 'Postflop-Solver / Bet-Trees / Nodelocking', status: 'no', note: 'außerhalb des Scopes' },
]

const FORMULAS: { label: string; formula: string }[] = [
  { label: 'Pot Odds', formula: 'benötigte Equity = Callbetrag / (Pot nach Call)' },
  { label: 'Call-EV (Chip)', formula: 'E · (Pot nach Call) − Callbetrag' },
  { label: 'Bet-/Jam-EV', formula: 'F·P + (1−F)·[E·(P+B+C) − B]  (B unkonditional)' },
  { label: 'Break-even-Fold', formula: 'B / (B + P)' },
  { label: 'Benötigte Call-Equity (ICM)', formula: 'BF / (1 + BF),  Risk Premium = davon − 50 %' },
]

const LIMITS = [
  'Equity-Tabelle ist combo-gemittelt — Blocker-Effekte nur näherungsweise.',
  'Multiway-Solver: simultaner-Call-Modell, Monte-Carlo-basiert (für tiefe Bäume langsam).',
  'ICM-Szenarien für >2 Spieler: chip-erhaltendes Einzel-Caller-Modell; volle Verteilung über den Solver.',
  'Position: Abstand-zum-Button-Modell (BTN = 2 Responder, SB = 1 …).',
  'BB/100: chip-genaues Accounting aus der Hand-History (best effort, EN + DE).',
  'PKO: nur sofortiger Bounty-Wert (kein zukünftiger Wert / keine Liability).',
]

export function MethodikPanel(): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <Section title="Methodik & Annahmen">
        <div className="card p-5 md:p-6 flex flex-col gap-3 text-sm text-muted">
          <p>
            Reines <span className="text-text">Turnier-Analysewerkzeug</span>, vollständig offline.
            Jede Auswertung ist <span className="text-text">modellabhängig</span> und gilt nur für
            abgeschlossene oder hypothetische Spots unter den angegebenen Annahmen. Kein Cashgame,
            kein Rake, keine Echtzeit-Entscheidungshilfe.
          </p>
          <p className="text-xs">
            Vollständige Fassung: <span className="font-mono text-text/80">docs/turnier-analyse-methodik.md</span>
          </p>
        </div>
      </Section>

      <Section title="Module & Status">
        <div className="card p-5 md:p-6">
          <div className="flex flex-col divide-y divide-white/5">
            {MODULES.map((m) => (
              <div key={m.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-text">{m.name}</div>
                  <div className="text-[11px] text-muted">{m.note}</div>
                </div>
                <Status k={m.status} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Formeln">
        <div className="card p-5 md:p-6 flex flex-col gap-2">
          {FORMULAS.map((f) => (
            <div key={f.label} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 py-1.5 border-b border-white/5 last:border-0">
              <span className="text-xs text-muted w-48 shrink-0">{f.label}</span>
              <span className="font-mono text-sm text-text">{f.formula}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Bekannte Grenzen">
        <div className="card p-5 md:p-6">
          <ul className="flex flex-col gap-2 text-sm text-muted">
            {LIMITS.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted/50">·</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Fair Play / TOS">
        <div className="card p-5 md:p-6 flex flex-col gap-2 text-sm text-muted">
          <p>100 % offline · keine Verbindung zu Pokerseiten/Clients · kein Scraping/OCR/HUD/Automatisierung.</p>
          <p>Nur eigene Hand-Histories · lokale Speicherung verschlüsselt · Export anonymisiert (keine Spielernamen).</p>
          <p>Bestätigung „abgeschlossene/hypothetische Hand" mit Zeitstempel · dauerhafter Modell-Hinweis pro Analyse.</p>
          <p className="text-xs text-slate-600">
            Keine Rechtsberatung. Die Zulässigkeit richtet sich nach den jeweils aktuellen Regeln des Pokerraums.
          </p>
        </div>
      </Section>
    </div>
  )
}
