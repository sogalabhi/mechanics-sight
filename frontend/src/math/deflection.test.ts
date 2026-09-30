import { describe, expect, it } from 'vitest'
import type { AnalysisResult, BeamInput } from '@/model/types'
import { solveElasticCurve } from './deflection'

const fixtures = import.meta.glob('../../../shared/fixtures/*.json', { eager: true }) as Record<
  string,
  { default: { name: string; input: BeamInput; output: AnalysisResult } }
>

describe('solveElasticCurve (Qualitative Elastic Curve & Fiber Stresses)', () => {
  it('uses physical backend polynomials when present', () => {
    const beam = { schema_version: 1 as const, length: 2, supports: [], loads: [] }
    const result = {
      segments: [{ x_start: 0, x_end: 2, moment: [1], shear: [0], axial: [0] }],
      critical_points: [],
      deflection: {
        segments: [{ x_start: 0, x_end: 2, slope: [0, 1], deflection: [0, 0, 0.5] }],
        max_upward: { x: 2, value: 2 },
        max_downward: null,
        max_absolute: { x: 2, value: 2 },
      },
    } as unknown as AnalysisResult
    const curve = solveElasticCurve(beam, result, 5)
    expect(curve?.isPhysical).toBe(true)
    expect(curve?.maxDeflection).toEqual({ x: 2, yRaw: 2, yNorm: -1 })
    expect(curve?.points.at(-1)).toMatchObject({ x: 2, yRaw: 2, yNorm: -1, slope: 2 })
  })
  it('02_ss_full_udl: zero at supports, peak sagging at midspan', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('full_udl'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const res = solveElasticCurve(fixture.input, fixture.output)
    expect(res).not.toBeNull()
    if (!res) return

    // Deflections at supports x = 0 and x = 6 must be 0
    const pt0 = res.points.find((p) => Math.abs(p.x - 0) < 1e-4)
    const pt6 = res.points.find((p) => Math.abs(p.x - 6) < 1e-4)
    expect(pt0?.yRaw).toBeCloseTo(0, 5)
    expect(pt6?.yRaw).toBeCloseTo(0, 5)

    // Max deflection must occur at midspan x = 3.0 m
    expect(res.maxDeflection?.x).toBeCloseTo(3.0, 1)
    expect(res.maxDeflection?.yNorm).toBeCloseTo(1.0, 5)

    // Under downward UDL, beam is sagging everywhere
    expect(res.points.every((p) => p.isSagging || Math.abs(p.moment) < 1e-6)).toBe(true)
  })

  it('01_ss_central_point: symmetrical deflection, zero at supports', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('central_point'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const res = solveElasticCurve(fixture.input, fixture.output)
    expect(res).not.toBeNull()
    if (!res) return

    expect(res.maxDeflection?.x).toBeCloseTo(3.0, 1)
    expect(res.maxDeflection?.yNorm).toBeCloseTo(1.0, 5)
  })

  it('03_cantilever_left_udl: zero deflection and zero slope at fixed support', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('cantilever_left_udl'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const res = solveElasticCurve(fixture.input, fixture.output)
    expect(res).not.toBeNull()
    if (!res) return

    // Fixed support at x = 0
    const atFixed = res.points[0]
    expect(atFixed.yRaw).toBeCloseTo(0, 5)
    expect(atFixed.slope).toBeCloseTo(0, 5)

    // Max deflection is at the free end (last point)
    const atEnd = res.points[res.points.length - 1]
    expect(res.maxDeflection?.x).toBeCloseTo(atEnd.x, 1)
  })

  it('05_overhang_point: exact zero at both supports, upward span and downward overhang', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('overhang_point'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const res = solveElasticCurve(fixture.input, fixture.output)
    expect(res).not.toBeNull()
    if (!res) return

    // Deflections at supports must be exactly zero
    const s1 = fixture.input.supports[0].position
    const s2 = fixture.input.supports[1].position
    const ptS1 = res.points.find((p) => Math.abs(p.x - s1) < 1e-5)
    const ptS2 = res.points.find((p) => Math.abs(p.x - s2) < 1e-5)
    expect(ptS1?.yRaw).toBeCloseTo(0, 5)
    expect(ptS2?.yRaw).toBeCloseTo(0, 5)

    // Overhang tip (x = 6) deflects downward (yRaw > 0)
    const ptTip = res.points.find((p) => Math.abs(p.x - 6) < 1e-5)
    expect(ptTip?.yRaw).toBeGreaterThan(0)
  })

  it('06_ss_clockwise_couple: contains both sagging and hogging fiber stress regions', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('clockwise_couple'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const res = solveElasticCurve(fixture.input, fixture.output)
    expect(res).not.toBeNull()
    if (!res) return

    // Has both sagging and hogging zones
    expect(res.points.some((p) => p.isSagging)).toBe(true)
    expect(res.points.some((p) => p.isHogging)).toBe(true)
    expect(res.inflectionPoints.length).toBeGreaterThanOrEqual(1)
  })

  it('04_cantilever_right_point: zero deflection and zero slope at right fixed support', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('cantilever_right_point'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const res = solveElasticCurve(fixture.input, fixture.output)
    expect(res).not.toBeNull()
    if (!res) return

    const rightSupportX = fixture.input.supports[0].position
    const atFixed = res.points.find((p) => Math.abs(p.x - rightSupportX) < 1e-4)
    expect(atFixed?.yRaw).toBeCloseTo(0, 5)
    expect(atFixed?.slope).toBeCloseTo(0, 5)
  })

  it('11_no_loads: returns null or zero deflection everywhere', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('no_loads'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const res = solveElasticCurve(fixture.input, fixture.output)
    if (res) {
      expect(res.maxDeflection?.yRaw).toBeCloseTo(0, 6)
    }
  })
})
