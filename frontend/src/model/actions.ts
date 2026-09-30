import { newId } from './ids'
import {
  isHinge,
  isSupport,
  type BeamInput,
  type DistributedLoad,
  type Hinge,
  type Item,
  type Load,
  type Support,
} from './types'

export type PaletteKind =
  | 'pin'
  | 'roller'
  | 'fixed'
  | 'hinge'
  | 'point'
  | 'moment'
  | 'udl'
  | 'uvl'
  | 'trapezoidal'

export const MIN_LENGTH = 0.1
export const MAX_LENGTH = 1000
const TOL = 1e-6
const MIN_SPAN = 0.001

export const round3 = (v: number) => Math.round(v * 1000) / 1000
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const emptyBeam = (length = 6): BeamInput => ({
  schema_version: 1,
  length,
  supports: [],
  loads: [],
  hinges: [],
})

export const allItems = (b: BeamInput): Item[] => [
  ...b.supports,
  ...(b.loads ?? []),
  ...(b.hinges ?? []).map((x, i) => ({ id: `hinge-${i}`, type: 'hinge' as const, position: x })),
]
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
  if (kind === 'hinge') {
    const hinges = beam.hinges ?? []
    const at = round3(clamp(x ?? L / 2, 0.1, L - 0.1))
    const nextHinges = [...hinges, at]
    const id = `hinge-${nextHinges.length - 1}`
    return { beam: { ...beam, hinges: nextHinges }, id }
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

export function updateItem(
  beam: BeamInput,
  id: string,
  patch: Partial<Support> | Partial<Load> | Partial<Hinge>,
): BeamInput {
  if (id.startsWith('hinge-')) {
    const index = parseInt(id.replace('hinge-', ''), 10)
    const hinges = [...(beam.hinges ?? [])]
    if (index >= 0 && index < hinges.length && 'position' in patch && typeof patch.position === 'number') {
      hinges[index] = round3(patch.position)
    }
    return { ...beam, hinges }
  }
  return {
    ...beam,
    supports: beam.supports.map((s) => (s.id === id ? ({ ...s, ...patch } as Support) : s)),
    loads: (beam.loads ?? []).map((l) => (l.id === id ? ({ ...l, ...patch } as Load) : l)),
  }
}

export function removeItem(beam: BeamInput, id: string): BeamInput {
  if (id.startsWith('hinge-')) {
    const index = parseInt(id.replace('hinge-', ''), 10)
    const hinges = (beam.hinges ?? []).filter((_, i) => i !== index)
    return { ...beam, hinges }
  }
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
  if (item.type === 'hinge') {
    return updateItem(beam, id, { position: round3(clamp(item.position + dx, 0.05, beam.length - 0.05)) })
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
  const hinges = beam.hinges ?? []
  for (let k = 0; k < hinges.length; k++) {
    const h = hinges[k]
    if (h <= TOL || h >= L - TOL) return 'Internal hinges must be strictly inside (0, L)'
    for (let j = k + 1; j < hinges.length; j++) {
      if (Math.abs(h - hinges[j]) < TOL) return `Duplicate internal hinges at ${h.toFixed(3)} m`
    }
    for (const s of beam.supports) {
      if (s.type === 'fixed' && Math.abs(s.position - h) < TOL) {
        return 'Cannot place an internal hinge at a fixed support'
      }
    }
    for (const l of beam.loads ?? []) {
      if (l.type === 'moment' && Math.abs(l.position - h) < TOL) {
        return 'Cannot place an applied moment couple directly at an internal hinge'
      }
    }
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
    hinges: (beam.hinges ?? []).map((h) => (h >= L - TOL ? round3(L - 0.05) : h)),
  }
}

/** Sorted, de-duplicated key positions (m): 0, L, supports, load positions and ends. */
export function keyPoints(beam: BeamInput): number[] {
  const all = [0, beam.length, ...allItems(beam).flatMap(itemPositions)].sort((a, b) => a - b)
  return all.filter((p, k) => k === 0 || p - all[k - 1] > TOL)
}

export { isHinge, isSupport }
