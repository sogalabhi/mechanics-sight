import { create } from 'zustand'
import { fresh, gesturePoints, pushStrain, pushUnload, sliderToStrain, strainToSlider, withGesture } from './history'
import { historyFromHash } from './share'
import type { DisplayState, LabOp, TensionOut } from './types'

export type LabTab = 'preset' | 'explain' | 'maths'
export type LabView = 'specimen' | 'curve'
export interface LabError {
  kind: 'solver' | 'network'
  message: string
}

/** Slider units of movement back that count as a real reversal, not jitter. */
export const HYSTERESIS = 4
const DEFAULT_FRACTURE_STRAIN = 0.25

interface LabState {
  /** The committed loading history. The server replays it from a fresh specimen. */
  history: LabOp[]
  /** A slider gesture in progress: its start and turning points, in slider units. */
  gesture: { start: number; points: number[] } | null
  response: TensionOut | null
  /** Full loading to fracture: the faint material curve, and the frames of a playback. */
  reference: TensionOut | null
  error: LabError | null
  analyzing: boolean
  playing: boolean
  /** A replayed point of the reference trace while playing. */
  overlay: DisplayState | null
  /** A short explanation of something the lab did on its own (for example starting a fresh specimen). */
  note: string | null
  zoom: boolean
  /** Show the 0.2 % offset line and proof point on the curve. */
  proof: boolean
  tab: LabTab
  view: LabView

  moveTo: (strain: number) => void
  unload: () => void
  reset: () => void
  setHistory: (history: LabOp[]) => void
  beginGesture: (startU: number) => void
  dragTo: (u: number) => void
  endGesture: () => void
  setResponse: (r: TensionOut) => void
  setReference: (r: TensionOut) => void
  setError: (e: LabError) => void
  setAnalyzing: (on: boolean) => void
  setOverlay: (o: DisplayState | null) => void
  setPlaying: (on: boolean) => void
  setNote: (note: string | null) => void
  setZoom: (zoom: boolean) => void
  setProof: (on: boolean) => void
  setTab: (tab: LabTab) => void
  setView: (view: LabView) => void
}

export const useLab = create<LabState>((set) => ({
  history: historyFromHash(window.location.hash) ?? fresh(),
  gesture: null,
  response: null,
  reference: null,
  error: null,
  analyzing: false,
  playing: false,
  overlay: null,
  note: null,
  zoom: false,
  proof: false,
  tab: 'preset',
  view: 'specimen',

  moveTo: (strain) => set((s) => ({ history: pushStrain(s.history, strain), playing: false, note: null })),
  unload: () => set((s) => ({ history: pushUnload(s.history), playing: false })),
  reset: () => set({ history: fresh(), gesture: null, overlay: null, playing: false, note: null }),
  setHistory: (history) => set({ history, gesture: null, overlay: null, playing: false, note: null }),
  beginGesture: (start) => set({ gesture: { start, points: [] }, playing: false }),
  dragTo: (u) =>
    set((s) => {
      const g = s.gesture ?? { start: u, points: [] }
      return { gesture: { start: g.start, points: gesturePoints(g.start, g.points, u, HYSTERESIS) } }
    }),
  endGesture: () =>
    set((s) => {
      if (!s.gesture) return s
      const history = withGesture(s.history, s.gesture.points, fractureStrainOf(s))
      return { history, gesture: null }
    }),
  setResponse: (response) => set({ response, error: null, analyzing: false, overlay: null }),
  setReference: (reference) => set({ reference }),
  setError: (error) => set({ error, analyzing: false }),
  setAnalyzing: (analyzing) => set({ analyzing }),
  setOverlay: (overlay) => set({ overlay }),
  setPlaying: (playing) => set({ playing }),
  setNote: (note) => set({ note }),
  setZoom: (zoom) => set({ zoom }),
  // the offset line lives in the first fraction of a percent of strain, so showing it zooms in
  setProof: (proof) => set(proof ? { proof, zoom: true } : { proof }),
  setTab: (tab) => set({ tab }),
  setView: (view) => set({ view }),
}))

type Slice<T, K extends keyof T> = { [P in K]: T[P] }
type Responses = Slice<LabState, 'response' | 'reference'>

/** The strain at fracture (point F). Known once the first response has arrived. */
export function fractureStrainOf(s: Responses): number {
  const f = (s.response ?? s.reference)?.landmarks.find((m) => m.id === 'F')
  return f?.strain ?? DEFAULT_FRACTURE_STRAIN
}

/** What the server is asked: the committed history plus a gesture in progress. */
export function effectiveHistory(s: Responses & Slice<LabState, 'history' | 'gesture'>): LabOp[] {
  return s.gesture ? withGesture(s.history, s.gesture.points, fractureStrainOf(s)) : s.history
}

/** Slider position of the current state. */
export function sliderPosition(s: Responses & Slice<LabState, 'overlay'>): number {
  const strain = (s.overlay ?? s.response?.state)?.strain ?? 0
  return strainToSlider(strain, fractureStrainOf(s))
}

export const strainFromSlider = (u: number, s: Responses): number => sliderToStrain(u, fractureStrainOf(s))

/** The state the views draw: a replayed point while playing, otherwise the server's state. */
export const displayState = (s: Slice<LabState, 'response' | 'overlay'>): DisplayState | null =>
  s.overlay ?? s.response?.state ?? null

export const isFractured = (s: Slice<LabState, 'response'>): boolean => s.response?.state.region === 'fractured'
