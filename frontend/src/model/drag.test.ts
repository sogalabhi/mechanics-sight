import { expect, it } from 'vitest'
import type { BeamInput, DistributedLoad } from './types'
import { dragItem } from './drag'
import { snapPosition } from '@/math/snap'

const beam: BeamInput = { schema_version: 1, length: 6, supports: [{ id: 's', type: 'pin', position: 2.123 }], loads: [] }
const load: DistributedLoad = { id: 'd', type: 'distributed', start: 1, end: 3, w_start: -2, w_end: -2 }

it('prefers existing points over the grid, with an 8 px screen threshold', () => {
  expect(snapPosition(2.19, 6, [2.123], 100)).toBe(2.123)
  expect(snapPosition(2.21, 6, [2.123], 100)).toBe(2.2)
  expect(snapPosition(2.19, 6, [2.123], 100, true)).toBe(2.19)
})
it('rounds Alt positions to mm and clamps to beam ends', () => {
  expect(snapPosition(0.30001, 6, [], 100, true)).toBe(0.3)
  expect(snapPosition(-1, 6, [], 100, true)).toBe(0)
  expect(snapPosition(7, 6, [], 100, true)).toBe(6)
})
it('keeps a distributed load inside the beam without changing its span', () => {
  const moved = dragItem({ ...beam, loads: [load] }, load, 5, 100, false).loads?.[0]
  expect(moved).toMatchObject({ start: 4, end: 6, w_start: -2, w_end: -2 })
})
it('resizing cannot reverse or collapse a distributed span', () => {
  expect(dragItem({ ...beam, loads: [load] }, load, 4, 100, false, 'start').loads?.[0]).toMatchObject({ start: 2.999, end: 3 })
  expect(dragItem({ ...beam, loads: [load] }, load, 0, 100, false, 'end').loads?.[0]).toMatchObject({ start: 1, end: 1.001 })
})
