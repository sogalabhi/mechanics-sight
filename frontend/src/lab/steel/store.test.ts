import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TensionOut, TracePoint } from './types'

// The store reads `window` when it loads, and the unit tests run in node.
let useLab: typeof import('./store').useLab
let effectiveHistory: typeof import('./store').effectiveHistory
let fractureStrainOf: typeof import('./store').fractureStrainOf
let interpolate: typeof import('./playback').interpolate
beforeAll(async () => {
  vi.stubGlobal('window', { location: { hash: '' } })
  ;({ useLab, effectiveHistory, fractureStrainOf } = await import('./store'))
  ;({ interpolate } = await import('./playback'))
})
afterEach(() => useLab.getState().reset())

const withF = { landmarks: [{ id: 'F', strain: 0.25 }] } as unknown as TensionOut

describe('lab store', () => {
  it('merges moves in one direction and keeps a reversal', () => {
    const { moveTo } = useLab.getState()
    moveTo(0.01)
    moveTo(0.05)
    expect(useLab.getState().history).toEqual([{ op: 'strain', to: 0.05 }])
    moveTo(0.03)
    expect(useLab.getState().history).toEqual([{ op: 'strain', to: 0.05 }, { op: 'strain', to: 0.03 }])
  })

  it('a slider gesture is one committed move however long the drag', () => {
    const s = useLab.getState()
    s.setResponse(withF)
    s.beginGesture(0)
    for (let u = 1; u <= 500; u++) useLab.getState().dragTo(u)
    expect(useLab.getState().history).toEqual([]) // nothing is committed while dragging
    expect(effectiveHistory(useLab.getState())).toHaveLength(1) // but the server is asked about it
    useLab.getState().endGesture()
    expect(useLab.getState().gesture).toBeNull()
    expect(useLab.getState().history).toHaveLength(1)
    expect((useLab.getState().history[0] as { to: number }).to).toBeCloseTo(0.25 * 0.125, 10)
  })

  it('a reversal inside a gesture is kept as an unloading', () => {
    const s = useLab.getState()
    s.setResponse(withF)
    s.beginGesture(0)
    useLab.getState().dragTo(800)
    useLab.getState().dragTo(600)
    useLab.getState().endGesture()
    expect(useLab.getState().history).toHaveLength(2)
  })

  it('reset gives a fresh specimen and clears playback and notes', () => {
    const s = useLab.getState()
    s.moveTo(0.05)
    s.unload()
    s.setNote('x')
    s.reset()
    const after = useLab.getState()
    expect(after.history).toEqual([])
    expect(after.note).toBeNull()
    expect(after.playing).toBe(false)
  })

  it('knows the fracture strain once a response is in, and falls back before', () => {
    expect(fractureStrainOf({ response: null, reference: null })).toBe(0.25)
    expect(fractureStrainOf({ response: { landmarks: [{ id: 'F', strain: 0.3 }] } as unknown as TensionOut, reference: null })).toBe(0.3)
  })
})

describe('playback interpolation', () => {
  const pt = (strain: number, stress_mpa: number, plastic_strain: number, region: TracePoint['region']): TracePoint => ({ strain, stress_mpa, plastic_strain, region })
  const trace = [pt(0, 0, 0, 'elastic'), pt(0.01, 250, 0.00875, 'yield_plateau'), pt(0.02, 260, 0.0187, 'strain_hardening')]

  it('interpolates stress and plastic strain between exact trace points', () => {
    const d = interpolate(trace, 0.005, 78.54, 50)
    expect(d.stress_mpa).toBeCloseTo(125, 9)
    expect(d.plastic_strain).toBeCloseTo(0.004375, 9)
    expect(d.force_kn).toBeCloseTo((125 * 78.54) / 1000, 9)
    expect(d.extension_mm).toBeCloseTo(0.25, 9)
    expect(d.elastic_strain).toBeCloseTo(0.005 - 0.004375, 9)
  })
  it('is exact on a trace point and takes the region from the segment', () => {
    expect(interpolate(trace, 0.01, 78.54, 50).stress_mpa).toBe(250)
    expect(interpolate(trace, 0.0, 78.54, 50).region).toBe('elastic')
    expect(interpolate(trace, 0.015, 78.54, 50).region).toBe('yield_plateau')
  })
})
