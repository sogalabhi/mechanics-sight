import { create } from 'zustand'
import { emptyBeam } from '@/model/actions'
import { beamFromHash } from '@/model/share'
import type { AnalysisResult, BeamInput } from '@/model/types'

export interface AnalysisError {
  kind: 'beam' | 'network'
  message: string
}

interface State {
  beam: BeamInput
  past: BeamInput[]
  future: BeamInput[]
  selectedId: string | null
  /** Last good result. Kept while `error` is set so the diagrams can be greyed out. */
  result: AnalysisResult | null
  error: AnalysisError | null
  /** Ask the solver for worked steps too. Off unless the Working panel is open. */
  showWorking: boolean
  /** The solver answered a steps request without steps (an older server). */
  stepsUnsupported: boolean
  showReactions: boolean
  showGuides: boolean
  showCalculus: boolean
  showDeflection: boolean
  hoverX: number | null
  pinnedX: number | null
  sawCutX: number | null
  integrationRange: [number, number] | null
  /** One call = one undo step. */
  commit: (beam: BeamInput, selectId?: string | null) => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  setResult: (r: AnalysisResult | null) => void
  setError: (e: AnalysisError) => void
  setHover: (x: number | null) => void
  setPinned: (x: number | null) => void
  setSawCutX: (x: number | null) => void
  setIntegrationRange: (range: [number, number] | null) => void
  setShowWorking: (on: boolean) => void
  setStepsUnsupported: (v: boolean) => void
  setShowReactions: (v: boolean) => void
  setShowGuides: (v: boolean) => void
  setShowCalculus: (v: boolean) => void
  setShowDeflection: (v: boolean) => void
}

export const useStore = create<State>((set) => ({
  beam: beamFromHash(window.location.hash) ?? emptyBeam(6),
  past: [],
  future: [],
  selectedId: null,
  result: null,
  error: null,
  showWorking: false,
  stepsUnsupported: false,
  showReactions: true,
  showGuides: true,
  showCalculus: true,
  showDeflection: true,
  hoverX: null,
  pinnedX: null,
  sawCutX: null,
  integrationRange: null,
  commit: (beam, selectId) =>
    set((s) => ({
      beam,
      past: [...s.past, s.beam],
      future: [],
      selectedId: selectId === undefined ? s.selectedId : selectId,
    })),
  undo: () =>
    set((s) => (s.past.length ? { beam: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.beam, ...s.future] } : s)),
  redo: () =>
    set((s) => (s.future.length ? { beam: s.future[0], past: [...s.past, s.beam], future: s.future.slice(1) } : s)),
  select: (id) => set({ selectedId: id }),
  setResult: (result) => set({ result, error: null }),
  setError: (error) => set({ error }),
  setHover: (hoverX) => set({ hoverX }),
  setPinned: (pinnedX) => set({ pinnedX }),
  setSawCutX: (sawCutX) => set({ sawCutX }),
  setIntegrationRange: (integrationRange) => set({ integrationRange }),
  setShowWorking: (showWorking) => set({ showWorking, stepsUnsupported: false }),
  setStepsUnsupported: (stepsUnsupported) => set({ stepsUnsupported }),
  setShowReactions: (showReactions) => set({ showReactions }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setShowCalculus: (showCalculus) => set({ showCalculus }),
  setShowDeflection: (showDeflection) => set({ showDeflection }),
}))
