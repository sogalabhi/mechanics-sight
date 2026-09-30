import type { AnalysisResult, Segment } from '@/model/types'

export type Kind = 'shear' | 'moment'

const EPS = 1e-9

/** Horner evaluation; coefficients ascending in t. */
export function horner(c: number[], t: number): number {
  let r = 0
  for (let i = c.length - 1; i >= 0; i--) r = r * t + c[i]
  return r
}

function degree(c: number[]): number {
  let d = c.length - 1
  while (d > 0 && Math.abs(c[d]) < 1e-12) d--
  return Math.max(d, 0)
}

const coeffs = (s: Segment, kind: Kind) => (kind === 'shear' ? s.shear : s.moment)

/**
 * Points (x in m, value) of the diagram, starting and ending on the zero line.
 * Jumps come out as two points at the same x. Straight segments get 2 points,
 * curves get about one point per 2 px.
 */
export function curvePoints(segments: Segment[], kind: Kind, pxPerM: number): [number, number][] {
  if (!segments.length) return []
  const pts: [number, number][] = [[segments[0].x_start, 0]]
  for (const s of segments) {
    const c = coeffs(s, kind)
    const len = s.x_end - s.x_start
    const n = degree(c) <= 1 ? 1 : Math.max(2, Math.ceil((len * pxPerM) / 2))
    for (let k = 0; k <= n; k++) {
      const t = (len * k) / n
      pts.push([s.x_start + t, horner(c, t)])
    }
  }
  pts.push([segments[segments.length - 1].x_end, 0])
  return pts
}

/** Values just left and right of x. Outside the beam both are 0. */
export function valueAt(result: AnalysisResult, x: number, kind: Kind): { left: number; right: number } {
  const segs = result.segments
  if (!segs.length) return { left: 0, right: 0 }
  const first = segs[0].x_start
  const last = segs[segs.length - 1].x_end
  const at = (s: Segment) => horner(coeffs(s, kind), Math.min(Math.max(x - s.x_start, 0), s.x_end - s.x_start))
  const leftSeg = segs.find((s) => s.x_start < x - EPS && x <= s.x_end + EPS)
  const rightSeg = segs.find((s) => s.x_start <= x + EPS && x < s.x_end - EPS)
  return {
    left: x <= first + EPS || !leftSeg ? 0 : at(leftSeg),
    right: x >= last - EPS || !rightSeg ? 0 : at(rightSeg),
  }
}

export const isJump = (v: { left: number; right: number }) => Math.abs(v.left - v.right) > 1e-9
