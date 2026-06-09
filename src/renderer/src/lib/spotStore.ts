// Geteilter Spot-Kontext-Store (Zustand) für die ICM-Analyse-Tools.
// Hält Turnier- und Hero/Board-Kontext sowie den Eingabemodus zentral.
// Phase 1: nur das Fundament — keine Komponente konsumiert diesen Store.

import { create } from 'zustand'
import type { Card } from './cards'

// Default-Stacks/Payouts (eine Quelle — auch von IcmCalculator genutzt; hier statt
// im Komponenten-Modul, um einen zirkulären Import store↔component zu vermeiden).
export function defaultStacks(n: number): number[] {
  return Array.from({ length: n }, () => 1000)
}

export function defaultPayoutInputs(paid: number): string[] {
  if (paid === 1) return ['100']
  if (paid === 2) return ['65', '35']
  if (paid === 3) return ['50', '30', '20']
  return Array.from({ length: paid }, () => '')
}

export interface SpotContextState {
  mode: 'shared' | 'single'
  players: number
  stacks: number[]
  payoutInputs: string[]
  bbSize: number
  ante: number
  heroCards: [Card | null, Card | null]
  board: (Card | null)[]

  setMode: (m: 'shared' | 'single') => void
  setContext: (patch: Partial<SpotContextState>) => void
  setStacks: (stacks: number[]) => void
  setPayout: (i: number, val: string) => void
  setBbSize: (n: number) => void
  setAnte: (n: number) => void
  setPlayers: (n: number) => void
  setHeroCard: (i: 0 | 1, c: Card | null) => void
  setBoardCard: (i: number, c: Card | null) => void
}

export const useSpotStore = create<SpotContextState>((set, get) => ({
  mode: 'shared',
  players: 3,
  stacks: defaultStacks(3),
  payoutInputs: defaultPayoutInputs(3),
  bbSize: 100,
  ante: 0,
  heroCards: [null, null],
  board: [null, null, null, null, null],

  setMode: (mode) => set({ mode }),
  setContext: (patch) => set({ ...patch }),
  setStacks: (stacks) => set({ stacks }),
  setPayout: (i, val) => {
    const next = get().payoutInputs.slice()
    next[i] = val
    set({ payoutInputs: next })
  },
  setBbSize: (bbSize) => set({ bbSize }),
  setAnte: (ante) => set({ ante }),
  setPlayers: (players) => set({ players }),
  setHeroCard: (i, c) => {
    const next: [Card | null, Card | null] = [...get().heroCards]
    next[i] = c
    set({ heroCards: next })
  },
  setBoardCard: (i, c) => {
    const next = get().board.slice()
    next[i] = c
    set({ board: next })
  }
}))

// ─── Auflösungs-Ebene ─────────────────────────────────────────────────────────
// Liefert je Modus den geteilten ODER den lokalen Turnier-Kontext eines Tools.
// Jedes Tool behält immer seinen lokalen State; im Modus 'shared' werden stattdessen
// die Store-Werte/-Setter zurückgegeben, sodass beim Zurückschalten nichts verloren geht.

export interface ToolContext {
  players: number
  stacks: number[]
  payoutInputs: string[]
  bbSize: number
  ante: number
  setPlayers: (n: number) => void
  setStacks: (s: number[]) => void
  setPayoutInputs: (p: string[]) => void
  setBbSize: (n: number) => void
  setAnte: (n: number) => void
}

export function useToolContext(local: ToolContext): ToolContext {
  // Hooks immer unbedingt aufrufen (Rules of Hooks), dann je Modus auswählen.
  const mode = useSpotStore((s) => s.mode)
  const players = useSpotStore((s) => s.players)
  const stacks = useSpotStore((s) => s.stacks)
  const payoutInputs = useSpotStore((s) => s.payoutInputs)
  const bbSize = useSpotStore((s) => s.bbSize)
  const ante = useSpotStore((s) => s.ante)
  const setPlayers = useSpotStore((s) => s.setPlayers)
  const setStacks = useSpotStore((s) => s.setStacks)
  const setBbSize = useSpotStore((s) => s.setBbSize)
  const setAnte = useSpotStore((s) => s.setAnte)
  const setContext = useSpotStore((s) => s.setContext)

  if (mode === 'single') return local
  return {
    players,
    stacks,
    payoutInputs,
    bbSize,
    ante,
    setPlayers,
    setStacks,
    setPayoutInputs: (p) => setContext({ payoutInputs: p }),
    setBbSize,
    setAnte,
  }
}
