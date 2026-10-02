import { create } from 'zustand'
import { emptyBeam } from '@/model/actions'
import { beamFromHash } from '@/model/share'
import type { AnalysisResult, BeamInput } from '@/model/types'

export type PaneTab = 'inspect' | 'results'

export interface AnalysisError {
  kind: 'beam' | 'network'
  message: string
}

interface State {
  beam: BeamInput
  draft: BeamInput | null
  setDraft: (draft: BeamInput | null) => void
  finishDrag: () => void
  past: BeamInput[]
  future: BeamInput[]
  selectedId: string | null
  /** Active tab of the right-hand pane. */
  paneTab: PaneTab
  /** Width of the right pane in px (desktop). The canvas takes the rest. */
  paneWidth: number
  /** Last good result. Kept while `error` is set so the diagrams can be greyed out. */
  result: AnalysisResult | null
  error: AnalysisError | null
  /** Ask the solver for worked steps too. Off unless the Working panel is open. */
  showWorking: boolean
  /** Solution method requested for indeterminate beams */
  selectedMethod: string | null
  /** The solver answered a steps request without steps (an older server). */
  stepsUnsupported: boolean
  showReactions: boolean
  showGuides: boolean
  showCalculus: boolean
  showAxial: boolean | null
  showDeflection: boolean
  showStress: boolean
  hoverX: number | null
  pinnedX: number | null
  sawCutX: number | null
  integrationRange: [number, number] | null
  dockHud: boolean
  /** One call = one undo step. */
  commit: (beam: BeamInput, selectId?: string | null) => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  setPaneTab: (tab: PaneTab) => void
  setPaneWidth: (w: number) => void
  setResult: (r: AnalysisResult | null) => void
  setError: (e: AnalysisError) => void
  setHover: (x: number | null) => void
  setPinned: (x: number | null) => void
  setSawCutX: (x: number | null) => void
  setIntegrationRange: (range: [number, number] | null) => void
  setDockHud: (dock: boolean) => void
  setShowWorking: (on: boolean) => void
  setSelectedMethod: (method: string | null) => void
  setStepsUnsupported: (v: boolean) => void
  setShowReactions: (v: boolean) => void
  setShowGuides: (v: boolean) => void
  setShowCalculus: (v: boolean) => void
  setShowAxial: (v: boolean | null) => void
  setShowDeflection: (v: boolean) => void
  setShowStress: (v: boolean) => void
}

export const PANE_W_DEFAULT = 360
export const PANE_W_MIN = 280
export const PANE_W_WIDE = 600
const PANE_W_KEY = 'ms_pane_w'
/** Widest the pane may get while the canvas keeps at least 320 px (palette is 184 px). */
export const paneWidthMax = () =>
  Math.max(PANE_W_MIN, Math.min(760, (typeof window === 'undefined' ? 1440 : window.innerWidth) - 184 - 320))
const clampPane = (w: number) => Math.round(Math.min(paneWidthMax(), Math.max(PANE_W_MIN, w)))
const getStoredPaneWidth = () => {
  try {
    const v = Number(window.localStorage.getItem(PANE_W_KEY))
    return Number.isFinite(v) && v > 0 ? clampPane(v) : PANE_W_DEFAULT
  } catch {
    return PANE_W_DEFAULT
  }
}

const DOCK_HUD_KEY = 'ms_dock_hud'
const getStoredDockHud = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      window.localStorage.getItem(DOCK_HUD_KEY) === 'true'
    )
  } catch {
    return false
  }
}

export const useStore = create<State>((set) => ({
  beam: beamFromHash(window.location.hash) ?? emptyBeam(6),
  draft: null,
  setDraft: (draft) => set({ draft }),
  finishDrag: () => set((s) => {
    if (!s.draft) return s
    if (JSON.stringify(s.draft) === JSON.stringify(s.beam)) return { draft: null }
    return { beam: s.draft, draft: null, past: [...s.past, s.beam], future: [] }
  }),
  past: [],
  future: [],
  selectedId: null,
  paneTab: 'inspect',
  paneWidth: getStoredPaneWidth(),
  result: null,
  error: null,
  showWorking: false,
  selectedMethod: null,
  stepsUnsupported: false,
  showReactions: true,
  showGuides: true,
  showCalculus: true,
  showAxial: null,
  showDeflection: true,
  showStress: true,
  hoverX: null,
  pinnedX: null,
  sawCutX: null,
  integrationRange: null,
  dockHud: getStoredDockHud(),
  commit: (beam, selectId) =>
    set((s) => ({
      beam,
      draft: null,
      past: [...s.past, s.beam],
      future: [],
      selectedId: selectId === undefined ? s.selectedId : selectId,
    })),
  undo: () =>
    set((s) => (s.draft ? { draft: null } : s.past.length ? { beam: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.beam, ...s.future] } : s)),
  redo: () =>
    set((s) => (s.draft ? { draft: null } : s.future.length ? { beam: s.future[0], past: [...s.past, s.beam], future: s.future.slice(1) } : s)),
  select: (id) => set(id === null ? { selectedId: null } : { selectedId: id, paneTab: 'inspect' }),
  setPaneTab: (paneTab) => set({ paneTab }),
  setPaneWidth: (w) => {
    const paneWidth = clampPane(w)
    try {
      window.localStorage.setItem(PANE_W_KEY, String(paneWidth))
    } catch {}
    set({ paneWidth })
  },
  setResult: (result) => set({ result, error: null }),
  setError: (error) => set({ error }),
  setHover: (hoverX) => set({ hoverX }),
  setPinned: (pinnedX) => set({ pinnedX }),
  setSawCutX: (sawCutX) => set({ sawCutX }),
  setIntegrationRange: (integrationRange) => set({ integrationRange }),
  setDockHud: (dockHud) => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(DOCK_HUD_KEY, String(dockHud))
      }
    } catch {}
    set({ dockHud })
  },
  setShowWorking: (showWorking) => set({ showWorking, stepsUnsupported: false }),
  setSelectedMethod: (selectedMethod) => set({ selectedMethod }),
  setStepsUnsupported: (stepsUnsupported) => set({ stepsUnsupported }),
  setShowReactions: (showReactions) => set({ showReactions }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setShowCalculus: (showCalculus) => set({ showCalculus }),
  setShowAxial: (showAxial) => set({ showAxial }),
  setShowDeflection: (showDeflection) => set({ showDeflection }),
  setShowStress: (showStress) => set({ showStress }),
}))
