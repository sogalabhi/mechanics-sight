import type { LabOp } from './types'

type StrainOp = LabOp & { op: 'strain'; to: number }
const isStrain = (o: LabOp | undefined): o is StrainOp => o?.op === 'strain'

/**
 * Append "move strain to `to`". A run of moves in the same direction is one move, so a long
 * drag does not grow the history. A move the other way is kept: it is a real unloading.
 * The first move after the start, a reset or an unload is always upward (strain cannot go
 * below the permanent strain).
 */
export function pushStrain(history: LabOp[], to: number): LabOp[] {
  const last = history[history.length - 1]
  if (isStrain(last)) {
    const before = history[history.length - 2]
    const lastDir = isStrain(before) ? Math.sign(last.to - before.to) : 1
    const newDir = Math.sign(to - last.to)
    if (newDir === 0) return history
    if (newDir === lastDir) return [...history.slice(0, -1), { op: 'strain', to }]
  }
  return [...history, { op: 'strain', to }]
}

export const pushUnload = (history: LabOp[]): LabOp[] => {
  const last = history[history.length - 1]
  return last?.op === 'unload_to_zero_stress' ? history : [...history, { op: 'unload_to_zero_stress' }]
}

/** A fresh specimen. The server treats an empty history as a fresh one. */
export const fresh = (): LabOp[] => []

/**
 * Turning points of a slider gesture (slider units, the start excluded). Movement back the other
 * way by less than `hysteresis` is jitter and is ignored; a longer one is a real reversal.
 */
export function gesturePoints(start: number, points: number[], u: number, hysteresis: number): number[] {
  if (points.length === 0) return u === start ? [] : [u]
  const last = points[points.length - 1]
  const prev = points.length > 1 ? points[points.length - 2] : start
  const dir = Math.sign(last - prev)
  if (u === last) return points
  if (Math.sign(u - last) === dir) return [...points.slice(0, -1), u]
  if (Math.abs(u - last) < hysteresis) return points
  return [...points, u]
}

/** Slider position (0..1000) to strain: finer at small strain, where the elastic part lives. */
export const sliderToStrain = (u: number, fractureStrain: number): number => fractureStrain * (u / 1000) ** 3
export const strainToSlider = (strain: number, fractureStrain: number): number =>
  Math.round(1000 * Math.cbrt(Math.max(0, Math.min(1, strain / fractureStrain))))

/** History for a request: the committed one plus the turning points of a gesture in progress. */
export function withGesture(history: LabOp[], points: number[], fractureStrain: number): LabOp[] {
  return points.reduce((h, u) => pushStrain(h, sliderToStrain(u, fractureStrain)), history)
}
