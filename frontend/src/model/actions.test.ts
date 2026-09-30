import { describe, expect, it } from 'vitest'
import { addItem, emptyBeam, keyPoints, moveItem, setLength, validateBeam } from './actions'

describe('addItem', () => {
  it('puts pin at left end first, then right end', () => {
    let b = addItem(emptyBeam(6), 'pin').beam
    expect(b.supports[0].position).toBe(0)
    b = addItem(b, 'roller').beam
    expect(b.supports[1].position).toBe(6)
  })
  it('snaps fixed to nearest end', () => {
    expect(addItem(emptyBeam(6), 'fixed', 5).beam.supports[0].position).toBe(6)
  })
  it('creates a 2 m UDL centred and clamped', () => {
    const l = addItem(emptyBeam(6), 'udl', 0).beam.loads![0]
    expect(l).toMatchObject({ start: 0, end: 2, w_start: -5, w_end: -5 })
  })
})

describe('setLength', () => {
  const base = () => {
    let b = addItem(emptyBeam(6), 'pin').beam
    b = addItem(b, 'roller').beam
    b = addItem(b, 'point', 3).beam
    return b
  }
  it('moves items at the right end and keeps others', () => {
    const b = setLength(base(), 8)
    expect(b.length).toBe(8)
    expect(b.supports.map((s) => s.position)).toEqual([0, 8])
    expect(b.loads![0]).toMatchObject({ position: 3 })
  })
  it('stops 0.1 m past the right-most free item', () => {
    expect(setLength(base(), 1).length).toBe(3.1)
  })
  it('stretches a load ending at L', () => {
    let b = addItem(emptyBeam(6), 'udl', 5).beam
    b = setLength(b, 9)
    expect(b.loads![0]).toMatchObject({ start: 4, end: 9 })
  })
  it('clamps to 1000 m', () => {
    expect(setLength(emptyBeam(6), 5000).length).toBe(1000)
  })
})

describe('validateBeam', () => {
  it('rejects two supports at the same place', () => {
    let b = addItem(emptyBeam(6), 'pin', 2).beam
    b = addItem(b, 'roller', 2).beam
    expect(validateBeam(b)).toMatch(/already at 2.000/)
  })
  it('rejects a fixed support away from an end', () => {
    const b = emptyBeam(6)
    b.supports = [{ id: 's', type: 'fixed', position: 3 }]
    expect(validateBeam(b)).toMatch(/beam end/)
  })
})

describe('keyPoints', () => {
  it('is sorted and unique', () => {
    const b = addItem(addItem(emptyBeam(6), 'pin').beam, 'point', 0).beam
    expect(keyPoints(b)).toEqual([0, 6])
  })
})

describe('moveItem', () => {
  it('shifts a distributed load as a whole', () => {
    const r = addItem(emptyBeam(6), 'udl', 3)
    const b = moveItem(r.beam, r.id, 0.5)
    expect(b.loads![0]).toMatchObject({ start: 2.5, end: 4.5 })
  })
  it('leaves fixed supports alone', () => {
    const r = addItem(emptyBeam(6), 'fixed')
    expect(moveItem(r.beam, r.id, 1)).toBe(r.beam)
  })
})
