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
  it('creates an internal hinge at specified or center position', () => {
    const res = addItem(emptyBeam(10), 'hinge', 4)
    expect(res.beam.hinges).toEqual([4])
    expect(res.id).toBe('hinge-0')
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
  it('requires material and section together', () => {
    const b = emptyBeam(6)
    b.material = { young_modulus_gpa: 200, yield_strength_mpa: 250 }
    expect(validateBeam(b)).toMatch(/supplied together/)
  })
  it('validates physical properties and hollow section geometry', () => {
    const b = emptyBeam(6)
    b.material = { young_modulus_gpa: 200, yield_strength_mpa: 250 }
    b.section = { type: 'rectangle', width: 0.2, height: 0.3, wall_thickness: 0.11 }
    expect(validateBeam(b)).toMatch(/positive inner opening/)
    b.section = { type: 'i', height: 0.3, flange_width: 0.15, flange_thickness: 0.15, web_thickness: 0.01 }
    expect(validateBeam(b)).toMatch(/positive web depth/)
    b.section = { type: 'circle', diameter: 0.1 }
    expect(validateBeam(b)).toBeNull()
  })
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
  it('rejects hinges at boundaries or duplicate hinges', () => {
    let b = emptyBeam(6)
    b.hinges = [0]
    expect(validateBeam(b)).toMatch(/strictly inside/)
    b.hinges = [3, 3]
    expect(validateBeam(b)).toMatch(/Duplicate internal hinges/)
  })
  it('rejects hinges at fixed supports or point moments at hinges', () => {
    let b = emptyBeam(6)
    b.supports = [{ id: 's', type: 'fixed', position: 0 }]
    b.hinges = [0]
    expect(validateBeam(b)).toMatch(/strictly inside/)
    b.hinges = [3]
    b.loads = [{ id: 'm', type: 'moment', position: 3, magnitude: 10 }]
    expect(validateBeam(b)).toMatch(/Cannot place an applied moment couple directly at an internal hinge/)
  })
  it('validates stepped property spans covering [0, L]', () => {
    const b = emptyBeam(6)
    b.spans = [
      { x_start: 0, x_end: 3, material: { young_modulus_gpa: 200, yield_strength_mpa: 250 }, section: { type: 'rectangle', width: 0.2, height: 0.3 } },
      { x_start: 3, x_end: 6, material: { young_modulus_gpa: 200, yield_strength_mpa: 250 }, section: { type: 'rectangle', width: 0.2, height: 0.4 } },
    ]
    expect(validateBeam(b)).toBeNull()

    // Gap
    b.spans[1].x_start = 3.5
    expect(validateBeam(b)).toMatch(/gap or overlap/)

    // Not starting at 0
    b.spans[0].x_start = 1
    b.spans[1].x_start = 3
    expect(validateBeam(b)).toMatch(/start at x = 0/)

    // Not ending at L
    b.spans[0].x_start = 0
    b.spans[1].x_end = 5
    expect(validateBeam(b)).toMatch(/end at x = L/)
  })
  it('rejects both uniform properties and property spans together', () => {
    const b = emptyBeam(6)
    b.material = { young_modulus_gpa: 200, yield_strength_mpa: 250 }
    b.section = { type: 'rectangle', width: 0.2, height: 0.3 }
    b.spans = [
      { x_start: 0, x_end: 6, material: { young_modulus_gpa: 200, yield_strength_mpa: 250 }, section: { type: 'rectangle', width: 0.2, height: 0.3 } },
    ]
    expect(validateBeam(b)).toMatch(/either uniform material\/section or property spans/)
  })
})

describe('keyPoints', () => {
  it('is sorted and unique and includes hinges', () => {
    let b = addItem(addItem(emptyBeam(6), 'pin').beam, 'point', 0).beam
    b = addItem(b, 'hinge', 3).beam
    expect(keyPoints(b)).toEqual([0, 3, 6])
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
  it('moves a hinge within bounds', () => {
    const r = addItem(emptyBeam(6), 'hinge', 3)
    const b = moveItem(r.beam, r.id, 0.5)
    expect(b.hinges).toEqual([3.5])
  })
})
