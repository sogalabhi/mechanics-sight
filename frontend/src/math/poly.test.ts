import { describe, expect, it } from 'vitest'
import type { AnalysisResult } from '@/model/types'
import { curvePoints, horner, valueAt } from './poly'
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
