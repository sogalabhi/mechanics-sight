import { describe, expect, it } from 'vitest'
import type { AnalysisResult } from '@/model/types'
import { curvePoints, horner, largestRegions, signRegions, tangentAt, valueAt } from './poly'
import { placeLabels } from './labels'

const fixtures = import.meta.glob('../../../shared/fixtures/*.json', { eager: true }) as Record<
  string,
  { default: { name: string; output: AnalysisResult } }
>

describe('horner', () => {
  it('evaluates ascending coefficients', () => {
    expect(horner([1, 2, 3], 2)).toBe(17)
  })
})

describe('contract fixtures', () => {
  for (const [path, mod] of Object.entries(fixtures)) {
    const { name, output } = mod.default
    it(`${name}: valueAt matches critical points`, () => {
      expect(path).toMatch(/\.json$/)
      for (const cp of output.critical_points) {
        const v = valueAt(output, cp.x, 'shear')
        const m = valueAt(output, cp.x, 'moment')
        expect(v.left).toBeCloseTo(cp.shear_left, 6)
        expect(v.right).toBeCloseTo(cp.shear_right, 6)
        expect(m.left).toBeCloseTo(cp.moment_left, 6)
        expect(m.right).toBeCloseTo(cp.moment_right, 6)
      }
    })
    it(`${name}: curve starts and ends on zero`, () => {
      const pts = curvePoints(output.segments, 'moment', 100)
      if (pts.length) {
        expect(pts[0][1]).toBe(0)
        expect(pts[pts.length - 1][1]).toBe(0)
      }
    })
  }
})

describe('placeLabels', () => {
  it('hides lower-priority overlapping labels in the same band', () => {
    const shown = placeLabels([
      { id: 'a', priority: 1, x0: 0, x1: 50, band: 'up' },
      { id: 'b', priority: 2, x0: 40, x1: 90, band: 'up' },
      { id: 'c', priority: 2, x0: 40, x1: 90, band: 'down' },
    ])
    expect([...shown].sort()).toEqual(['a', 'c'])
  })
})

describe('sign regions', () => {
  it('finds the largest positive and negative regions', () => {
    const pts: [number, number][] = [[0, 0], [0, 2], [3, 2], [3, -1], [4, -1], [4, 0]]
    const r = largestRegions(signRegions(pts))
    expect(r.map((x) => x.sign)).toEqual([1, -1])
    expect(r[0]).toMatchObject({ x0: 0, x1: 3, peak: 2 })
  })
  it('ignores zero-width jumps', () => {
    expect(largestRegions(signRegions([[0, 0], [1, 1], [1, 0]]))).toEqual([])
  })
})

describe('tangentAt (Calculus Tangent Visualizer)', () => {
  const xs = (x: number) => 50 + x * 100 // 100 px per m
  const ys = (m: number) => 150 - m * 2 // sagging positive is up (decreasing Y)

  it('ss_full_udl: midspan tangent is perfectly horizontal at peak moment', () => {
    const udlFixture = Object.values(fixtures).find((f) => f.default.name.includes('full_udl'))?.default.output
    expect(udlFixture).toBeDefined()
    if (!udlFixture) return

    const t = tangentAt(udlFixture, 3.0, xs, ys, 40)
    expect(t).not.toBeNull()
    if (!t) return

    expect(t.isZeroShear).toBe(true)
    expect(t.isKink).toBe(false)
    expect(t.leftRay.slope).toBe(0)
    expect(t.rightRay.slope).toBe(0)
    expect(t.fullSegment.y1).toBe(t.fullSegment.y2) // Perfectly horizontal
    expect(t.fullSegment.x2 - t.fullSegment.x1).toBeCloseTo(80, 5) // 2 * radius
  })

  it('ss_full_udl: non-zero shear point has slope exactly matching V(x)', () => {
    const udlFixture = Object.values(fixtures).find((f) => f.default.name.includes('full_udl'))?.default.output
    if (!udlFixture) return

    const t = tangentAt(udlFixture, 1.0, xs, ys, 40)
    expect(t).not.toBeNull()
    if (!t) return

    expect(t.isZeroShear).toBe(false)
    expect(t.isKink).toBe(false)
    // dM/dx = V(1)
    const vAt1 = valueAt(udlFixture, 1.0, 'shear').right
    expect(t.leftRay.slope).toBeCloseTo(vAt1, 6)
    expect(t.rightRay.slope).toBeCloseTo(vAt1, 6)
    // In SVG space: since V(1) > 0 and ys has negative scale, dy/dx in screen pixels is negative (slopes up-right)
    expect(t.fullSegment.y2).toBeLessThan(t.fullSegment.y1)
  })

  it('ss_central_point: peak moment under point load forms kink meeting at apex', () => {
    const pointFixture = Object.values(fixtures).find((f) => f.default.name.includes('central_point'))?.default.output
    expect(pointFixture).toBeDefined()
    if (!pointFixture) return

    const t = tangentAt(pointFixture, 3.0, xs, ys, 40)
    expect(t).not.toBeNull()
    if (!t) return

    expect(t.isKink).toBe(true)
    expect(t.isZeroCrossing).toBe(true)
    expect(t.isZeroShear).toBe(true)
    expect(t.leftRay.slope).toBeGreaterThan(0)
    expect(t.rightRay.slope).toBeLessThan(0)
    expect(t.leftRay.x2).toBe(t.px)
    expect(t.leftRay.y2).toBe(t.py)
    expect(t.rightRay.x1).toBe(t.px)
    expect(t.rightRay.y1).toBe(t.py)
  })

  it('handles beam boundaries cleanly at x = 0 and x = L', () => {
    const udlFixture = Object.values(fixtures).find((f) => f.default.name.includes('full_udl'))?.default.output
    if (!udlFixture) return

    const t0 = tangentAt(udlFixture, 0, xs, ys, 40)
    expect(t0).not.toBeNull()
    expect(t0?.px).toBe(xs(0))

    const tL = tangentAt(udlFixture, 6, xs, ys, 40)
    expect(tL).not.toBeNull()
    expect(tL?.px).toBe(xs(6))
  })
})

