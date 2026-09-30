import { expect, it } from 'vitest'
import { addItem, emptyBeam } from './actions'
import { decodeBeam, encodeBeam } from './share'

it('round-trips a beam', () => {
  let b = addItem(emptyBeam(6), 'pin').beam
  b = addItem(b, 'point', 3).beam
  expect(decodeBeam(encodeBeam(b))).toEqual(b)
})
it('rejects junk', () => {
  expect(decodeBeam('not-a-beam')).toBeNull()
  expect(decodeBeam(encodeBeam({ schema_version: 1, length: -1, supports: [], loads: [] }))).toBeNull()
})
