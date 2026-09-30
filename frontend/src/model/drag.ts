import { itemPositions, round3, updateItem, type PaletteKind } from './actions'
import type { BeamInput, Item } from './types'
import { snapPosition } from '@/math/snap'

export type DragPart = 'body' | 'start' | 'end'
export type DragSource = { item: Item; part?: DragPart } | { kind: PaletteKind }

/** Move from the original beam on every frame so rounding never accumulates. */
export function dragItem(beam: BeamInput, item: Item, position: number, pxPerM: number, alt: boolean, part: DragPart = 'body'): BeamInput {
  const points = [0, beam.length, ...beam.supports.filter((s) => s.id !== item.id).map((s) => s.position),
    ...(beam.loads ?? []).filter((l) => l.id !== item.id).flatMap(itemPositions),
    ...(beam.hinges ?? []).filter((_, i) => `hinge-${i}` !== item.id)]
  const snap = (v: number) => snapPosition(v, beam.length, points, pxPerM, alt)
  const clamp = (v: number, lo: number, hi: number) => round3(Math.max(lo, Math.min(hi, v)))
  if (item.type === 'fixed') return beam
  if (item.type === 'distributed') {
    if (part === 'start') return updateItem(beam, item.id, { start: clamp(snap(position), 0, item.end - 0.001) })
    if (part === 'end') return updateItem(beam, item.id, { end: clamp(snap(position), item.start + 0.001, beam.length) })
    const span = item.end - item.start
    const start = clamp(snap(position), 0, beam.length - span)
    return updateItem(beam, item.id, { start, end: round3(start + span) })
  }
  const at = snap(position)
  return updateItem(beam, item.id, { position: item.type === 'hinge' ? clamp(at, 0.001, beam.length - 0.001) : at })
}
