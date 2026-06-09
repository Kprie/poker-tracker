import { useMemo, useState } from 'react'
import { computeBubbleFactors, computePositionEquities } from '../lib/icm'
import { Section } from './Section'
import { IcmCalculator } from './IcmCalculator'
import type { IcmResult } from './IcmCalculator'
import { BubbleFactorMatrix } from './BubbleFactorMatrix'
import { RiskPremiumMatrix } from './RiskPremiumMatrix'
import { DealPanel } from './DealPanel'
import { LadderChart } from './LadderChart'
import { IcmCompareChart } from './IcmCompareChart'
import { PushFoldPanel } from './PushFoldPanel'
import { SpotAnalyzer } from './SpotAnalyzer'
import { RoundSimulator } from './RoundSimulator'
import { EquityLab } from './EquityLab'
import { PotOddsCalculator } from './PotOddsCalculator'
import { PkoBountyPanel } from './PkoBountyPanel'
import { SpotContextPanel } from './SpotContextPanel'
import { useSpotStore } from '../lib/spotStore'

// Sub-Tab-Leiste innerhalb der ICM-Ergebnis-Sektion
const RESULT_TABS = [
  { key: 'matrix',  label: 'Bubble-Factor-Matrix' },
  { key: 'risk',    label: 'Risk Premium' },
  { key: 'ladder',  label: 'Ladder-Analyse' },
  { key: 'compare', label: 'Chip EV vs ICM' },
  { key: 'deal',    label: 'Deal & Satellite' },
] as const
type ResultTab = typeof RESULT_TABS[number]['key']

export function IcmTab(): JSX.Element {
  const [result, setResult] = useState<IcmResult | null>(null)
  const [resultTab, setResultTab] = useState<ResultTab>('matrix')

  const mode = useSpotStore((s) => s.mode)
  const setMode = useSpotStore((s) => s.setMode)

  const bf = useMemo(
    () => (result ? computeBubbleFactors(result.stacks, result.payouts) : null),
    [result],
  )

  const posEq = useMemo(
    () => (result ? computePositionEquities(result.stacks, result.payouts) : null),
    [result],
  )

  const tabCls = (key: ResultTab) =>
    resultTab === key
      ? 'border-b-2 border-accent pb-2 pt-2.5 px-4 text-xs font-semibold text-text'
      : 'border-b-2 border-transparent pb-2 pt-2.5 px-4 text-xs text-muted hover:text-text transition-colors'

  return (
    <div className="flex flex-col gap-8">
      {/* ── Dauerhafter Modell-/TOS-Hinweis ────────────────────────────────── */}
      <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-2.5 text-[11px] text-muted">
        Alle Auswertungen sind <span className="text-text">modellabhängig</span> und gelten nur für
        abgeschlossene oder hypothetische Turnierspots unter den angegebenen Annahmen. Keine
        Echtzeit-Entscheidungshilfe für laufende Hände.
      </div>

      {/* ── Eingabemodus-Umschalter ────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted">Eingabemodus</span>
        <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
          {([['shared', 'Gemeinsam'], ['single', 'Einzeln']] as const).map(([key, label]) => (
            <button
              key={key}
              className={`px-3 py-1.5 transition-colors ${mode === key ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-text'}`}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted/70">
          {mode === 'shared'
            ? 'Turnier-Kontext oben einmal eingeben — die Analyse-Tools übernehmen ihn.'
            : 'Jedes Tool wird einzeln befüllt.'}
        </span>
      </div>

      {/* ── Geteilter Spot-Kontext (nur im Modus „Gemeinsam") ──────────────── */}
      {mode === 'shared' && (
        <Section title="Spot-Kontext">
          <SpotContextPanel />
        </Section>
      )}

      {/* ════════ Kontext-gesteuerte Analyse ════════ */}

      {/* ── ICM-Equity-Rechner ─────────────────────────────────────────────── */}
      <Section title="ICM-Equity-Rechner">
        <div className="flex flex-col gap-4">
          <IcmCalculator onResult={setResult} />

          {result && bf && posEq && (
            <div className="card p-5 md:p-6">
              <div className="flex gap-1 border-b border-white/10 mb-4">
                {RESULT_TABS.map(t => (
                  <button key={t.key} className={tabCls(t.key)} onClick={() => setResultTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {resultTab === 'matrix' && (
                <BubbleFactorMatrix bubbleFactors={bf} playerCount={result.stacks.length} />
              )}
              {resultTab === 'risk' && (
                <RiskPremiumMatrix bubbleFactors={bf} playerCount={result.stacks.length} />
              )}
              {resultTab === 'ladder' && (
                <LadderChart positionEquities={posEq} payouts={result.payouts} playerCount={result.stacks.length} />
              )}
              {resultTab === 'compare' && (
                <IcmCompareChart equities={result.equities} stacks={result.stacks} payouts={result.payouts} />
              )}
              {resultTab === 'deal' && (
                <DealPanel stacks={result.stacks} payouts={result.payouts} />
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ── Spot-Analyse ──────────────────────────────────────────────────── */}
      <Section title="Spot-Analyse">
        <SpotAnalyzer />
      </Section>

      {/* ── Hand-Analyse ─────────────────────────────────────────────────── */}
      <Section title="Hand-Analyse">
        <RoundSimulator />
      </Section>

      {/* ── Equity-Labor ──────────────────────────────────────────────────── */}
      <Section title="Equity-Labor (Multiway)">
        <EquityLab />
      </Section>

      {/* ════════ Eigenständige Rechner ════════ */}
      <div className="flex items-center gap-3 pt-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted/70">Eigenständige Rechner</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* ── Pot-Odds & EV ─────────────────────────────────────────────────── */}
      <Section title="Pot-Odds & EV-Rechner">
        <PotOddsCalculator />
      </Section>

      {/* ── PKO-Bounty ────────────────────────────────────────────────────── */}
      <Section title="PKO-Bounty-Rechner">
        <PkoBountyPanel />
      </Section>

      {/* ── Push/Fold-Referenz ────────────────────────────────────────────── */}
      <Section title="Push/Fold-Referenz">
        <PushFoldPanel />
      </Section>
    </div>
  )
}
