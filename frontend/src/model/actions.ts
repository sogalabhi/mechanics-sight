import { newId } from './ids'
import { isSupport, type BeamInput, type DistributedLoad, type Item, type Load, type Support } from './types'

export type PaletteKind = 'pin' | 'roller' | 'fixed' | 'point' | 'moment' | 'udl' | 'uvl' | 'trapezoidal'

export const MIN_LENGTH = 0.1
export const MAX_LENGTH = 1000
const TOL = 1e-6
const MIN_SPAN = 0.001

export const round3 = (v: number) => Math.round(v * 1000) / 1000
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const emptyBeam = (length = 6): BeamInput => ({ schema_version: 1, length, supports: [], loads: [] })

export const allItems = (b: BeamInput): Item[] => [...b.supports, ...(b.loads ?? [])]
export const findItem = (b: BeamInput, id: string): Item | undefined => allItems(b).find((i) => i.id === id)

/** Every position an item occupies, for key points and length limits. */
export function itemPositions(i: Item): number[] {
  return i.type === 'distributed' ? [i.start, i.end] : [i.position]
}

export function addItem(beam: BeamInput, kind: PaletteKind, x?: number): { beam: BeamInput; id: string } {
  const L = beam.length
  const loads = beam.loads ?? []
  if (kind === 'pin' || kind === 'roller' || kind === 'fixed') {
    const taken = (p: number) => beam.supports.some((s) => Math.abs(s.position - p) < TOL)
    let pos: number
    if (kind === 'fixed') {
      const nearest = x !== undefined && x > L / 2 ? [L, 0] : [0, L]
      pos = nearest.find((p) => !taken(p)) ?? nearest[0]
    } else {
      pos = x !== undefined ? round3(clamp(x, 0, L)) : [0, L, L / 2].find((p) => !taken(p)) ?? L / 2
    }
    const s: Support = { id: newId('s'), type: kind, position: round3(pos) }
    return { beam: { ...beam, supports: [...beam.supports, s] }, id: s.id }
  }
  const at = round3(clamp(x ?? L / 2, 0, L))
  let load: Load
  if (kind === 'point') load = { id: newId('l'), type: 'point', position: at, magnitude: -10 }
  else if (kind === 'moment') load = { id: newId('l'), type: 'moment', position: at, magnitude: 10 }
  else {
    const width = Math.min(2, L)
    const start = round3(clamp(at - width / 2, 0, L - width))
    const [w1, w2] = kind === 'udl' ? [-5, -5] : kind === 'uvl' ? [0, -5] : [-2, -5]
    load = { id: newId('l'), type: 'distributed', start, end: round3(start + width), w_start: w1, w_end: w2 }
  }
  return { beam: { ...beam, loads: [...loads, load] }, id: load.id }
}

export function updateItem(beam: BeamInput, id: string, patch: Partial<Support> | Partial<Load>): BeamInput {
  return {
    ...beam,
    supports: beam.supports.map((s) => (s.id === id ? ({ ...s, ...patch } as Support) : s)),
    loads: (beam.loads ?? []).map((l) => (l.id === id ? ({ ...l, ...patch } as Load) : l)),
  }
}

export function removeItem(beam: BeamInput, id: string): BeamInput {
  return {
    ...beam,
    supports: beam.supports.filter((s) => s.id !== id),
    loads: (beam.loads ?? []).filter((l) => l.id !== id),
  }
}

/** Shift an item by dx metres. Fixed supports stay at their end. */
export function moveItem(beam: BeamInput, id: string, dx: number): BeamInput {
  const item = findItem(beam, id)
  if (!item || item.type === 'fixed') return beam
  if (item.type === 'distributed') {
    return updateItem(beam, id, { start: round3(item.start + dx), end: round3(item.end + dx) })
  }
  return updateItem(beam, id, { position: round3(item.position + dx) })
}

/** Returns a message if the beam is invalid, otherwise null. */
export function validateBeam(beam: BeamInput): string | null {
  const L = beam.length
  if (!(L >= MIN_LENGTH && L <= MAX_LENGTH)) return `Length must be between ${MIN_LENGTH} and ${MAX_LENGTH} m`
  for (const i of allItems(beam)) {
    for (const p of itemPositions(i)) {
      if (p < -TOL || p > L + TOL) return `Position must be between 0 and ${L} m`
    }
    if (i.type === 'distributed' && i.end - i.start < MIN_SPAN) return 'Load must span at least 1 mm'
    if (i.type === 'distributed' && i.w_start === 0 && i.w_end === 0) return 'Load intensity cannot be zero'
    if (i.type === 'fixed' && i.position > TOL && Math.abs(i.position - L) > TOL) return 'Fixed supports go at a beam end'
  }
  const sup = [...beam.supports].sort((a, b) => a.position - b.position)
  for (let k = 1; k < sup.length; k++) {
    if (sup[k].position - sup[k - 1].position < TOL)
      return `A support is already at ${sup[k].position.toFixed(3)} m`
  }
  return null
}

/**
 * Change the length. Items at x = L (within tolerance) stay attached to the right end;
 * all others keep their absolute x. L is clamped so no free item is pushed off the beam.
 */
export function setLength(beam: BeamInput, requested: number): BeamInput {
  const old = beam.length
  const atEnd = (p: number) => Math.abs(p - old) < TOL
  let minL = MIN_LENGTH
  for (const i of allItems(beam)) {
    for (const p of itemPositions(i)) if (!atEnd(p)) minL = Math.max(minL, p + 0.1)
  }
  const L = round3(clamp(requested, Math.min(minL, MAX_LENGTH), MAX_LENGTH))
  const move = (p: number) => (atEnd(p) ? L : p)
  return {
    ...beam,
    length: L,
    supports: beam.supports.map((s) => ({ ...s, position: move(s.position) })),
    loads: (beam.loads ?? []).map((l) =>
      l.type === 'distributed' ? ({ ...l, end: move(l.end) } as DistributedLoad) : { ...l, position: move(l.position) },
    ),
  }
}

/** Sorted, de-duplicated key positions (m): 0, L, supports, load positions and ends. */
export function keyPoints(beam: BeamInput): number[] {
  const all = [0, beam.length, ...allItems(beam).flatMap(itemPositions)].sort((a, b) => a - b)
  return all.filter((p, k) => k === 0 || p - all[k - 1] > TOL)
}

export { isSupport }
