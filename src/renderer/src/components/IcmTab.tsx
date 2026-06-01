import { useMemo, useState } from 'react'
import { computeBubbleFactors, computePositionEquities } from '../lib/icm'
import { Section } from './Section'
import { IcmCalculator } from './IcmCalculator'
import type { IcmResult } from './IcmCalculator'
import { BubbleFactorMatrix } from './BubbleFactorMatrix'
import { LadderChart } from './LadderChart'
import { IcmCompareChart } from './IcmCompareChart'
import { PushFoldPanel } from './PushFoldPanel'
import { SpotAnalyzer } from './SpotAnalyzer'
import { RoundSimulator } from './RoundSimulator'

// Sub-Tab-Leiste innerhalb der ICM-Ergebnis-Sektion
const RESULT_TABS = [
  { key: 'matrix',  label: 'Bubble-Factor-Matrix' },
  { key: 'ladder',  label: 'Ladder-Analyse' },
  { key: 'compare', label: 'Chip EV vs ICM' },
] as const
type ResultTab = typeof RESULT_TABS[number]['key']

export function IcmTab(): JSX.Element {
  const [result, setResult] = useState<IcmResult | null>(null)
  const [resultTab, setResultTab] = useState<ResultTab>('matrix')

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
              {resultTab === 'ladder' && (
                <LadderChart positionEquities={posEq} payouts={result.payouts} playerCount={result.stacks.length} />
              )}
              {resultTab === 'compare' && (
                <IcmCompareChart equities={result.equities} stacks={result.stacks} payouts={result.payouts} />
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ── Hand-Analyse ─────────────────────────────────────────────────── */}
      <Section title="Hand-Analyse">
        <RoundSimulator />
      </Section>

      {/* ── Spot-Analyse ──────────────────────────────────────────────────── */}
      <Section title="Spot-Analyse">
        <SpotAnalyzer />
      </Section>

      {/* ── Push/Fold-Referenz ────────────────────────────────────────────── */}
      <Section title="Push/Fold-Referenz">
        <PushFoldPanel />
      </Section>
    </div>
  )
}
