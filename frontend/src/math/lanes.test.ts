import { expect, it } from 'vitest'
import { packLanes } from './lanes'

it('keeps non-overlapping loads in lane 0', () => {
  const m = packLanes([
    { id: 'a', start: 0, end: 10, height: 20 },
    { id: 'b', start: 10, end: 20, height: 30 },
  ])
  expect([m.get('a'), m.get('b')]).toEqual([0, 0])
})
it('lifts an overlapping load by lane height + gap', () => {
  const m = packLanes([
    { id: 'a', start: 0, end: 10, height: 20 },
    { id: 'b', start: 5, end: 15, height: 30 },
  ])
  expect(m.get('b')).toBe(34)
})
