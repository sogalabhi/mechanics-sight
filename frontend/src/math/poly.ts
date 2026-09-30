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

export interface Region {
  sign: 1 | -1
  x0: number
  x1: number
  peak: number
}

/** Runs of the curve above / below the zero line, for the + / − markers. */
export function signRegions(pts: [number, number][]): Region[] {
  const out: Region[] = []
  let cur: Region | null = null
  for (const [x, v] of pts) {
    const sign = Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : -1
    if (sign === 0) {
      cur = null
    } else if (cur && cur.sign === sign) {
      cur.x1 = x
      cur.peak = Math.max(cur.peak, Math.abs(v))
    } else {
      cur = { sign, x0: x, x1: x, peak: Math.abs(v) }
      out.push(cur)
    }
  }
  return out
}

/** The widest-and-tallest region of each sign (largest width × peak). */
export function largestRegions(regions: Region[]): Region[] {
  return ([1, -1] as const)
    .map((sign) =>
      regions
        .filter((r) => r.sign === sign && r.x1 > r.x0)
        .sort((a, b) => (b.x1 - b.x0) * b.peak - (a.x1 - a.x0) * a.peak)[0],
    )
    .filter((r): r is Region => r !== undefined)
}

export interface TangentRay {
  x1: number
  y1: number
  x2: number
  y2: number
  slope: number // dM/dx in kN
  angleRad: number
}

export interface TangentInfo {
  x: number
  px: number
  py: number
  moment: { left: number; right: number }
  shear: { left: number; right: number }
  isKink: boolean
  isMomentJump: boolean
  isZeroShear: boolean
  isZeroCrossing: boolean
  leftRay: TangentRay
  rightRay: TangentRay
  fullSegment: { x1: number; y1: number; x2: number; y2: number }
}

function computeTangentRay(
  anchorX: number,
  anchorY: number,
  shearValue: number,
  side: 'left' | 'right',
  forceZero: boolean,
  pxPerM: number,
  sy: number,
  radius: number,
): TangentRay {
  if (forceZero || Math.abs(shearValue) < 1e-6) {
    return side === 'left'
      ? { x1: anchorX - radius, y1: anchorY, x2: anchorX, y2: anchorY, slope: 0, angleRad: 0 }
      : { x1: anchorX, y1: anchorY, x2: anchorX + radius, y2: anchorY, slope: 0, angleRad: 0 }
  }

  const dx = pxPerM
  const dy = sy * shearValue
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const angleRad = Math.atan2(dy, dx)

  return side === 'left'
    ? { x1: anchorX - radius * ux, y1: anchorY - radius * uy, x2: anchorX, y2: anchorY, slope: shearValue, angleRad }
    : { x1: anchorX, y1: anchorY, x2: anchorX + radius * ux, y2: anchorY + radius * uy, slope: shearValue, angleRad }
}

/**
 * Computes exact tangent line geometry on the Bending Moment Diagram.
 * Physical slope dM/dx is strictly evaluated from analytical polynomials (V(x)).
 */
export function tangentAt(
  result: AnalysisResult,
  x: number,
  xScale: (x: number) => number,
  yScale: (m: number) => number,
  radius: number = 42,
): TangentInfo | null {
  const segs = result.segments
  if (!segs.length) return null

  const L = segs[segs.length - 1].x_end
  const clampedX = Math.min(Math.max(x, 0), L)

  const mVal = valueAt(result, clampedX, 'moment')
  const vVal = valueAt(result, clampedX, 'shear')

  const zTol = 1e-4
  const isZeroShearPoint = result.zero_shear_points.some((z) => Math.abs(z - clampedX) < zTol)
  const isSmoothZero = Math.abs(vVal.right) < zTol || Math.abs(vVal.left) < zTol
  const isZeroCrossing = vVal.left * vVal.right < -1e-9
  const isZeroShear = isZeroShearPoint || isSmoothZero || isZeroCrossing

  const isKink = Math.abs(vVal.left - vVal.right) > 1e-6
  const isMomentJump = Math.abs(mVal.left - mVal.right) > 1e-6

  const mLeft = mVal.left
  const mRight = clampedX >= L - EPS ? mVal.left : mVal.right

  const px = xScale(clampedX)
  const py = yScale(mRight)

  const pxPerM = Math.abs(xScale(1) - xScale(0)) || 1
  const sy = yScale(1) - yScale(0) || -1

  const vLeft = clampedX <= EPS ? vVal.right : vVal.left
  const vRight = clampedX >= L - EPS ? vVal.left : vVal.right

  const anchorLeftY = isMomentJump ? yScale(mLeft) : py
  const anchorRightY = py

  const forceZeroLeft = isZeroShear && !isZeroCrossing
  const forceZeroRight = isZeroShear && !isZeroCrossing

  const leftRay = computeTangentRay(px, anchorLeftY, vLeft, 'left', forceZeroLeft, pxPerM, sy, radius)
  const rightRay = computeTangentRay(px, anchorRightY, vRight, 'right', forceZeroRight, pxPerM, sy, radius)

  const fullSegment = {
    x1: leftRay.x1,
    y1: leftRay.y1,
    x2: rightRay.x2,
    y2: rightRay.y2,
  }

  return {
    x: clampedX,
    px,
    py,
    moment: mVal,
    shear: vVal,
    isKink,
    isMomentJump,
    isZeroShear,
    isZeroCrossing,
    leftRay,
    rightRay,
    fullSegment,
  }
}

