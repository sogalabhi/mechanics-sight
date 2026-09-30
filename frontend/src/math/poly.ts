import type { AnalysisResult, Segment } from '@/model/types'

export type Kind = 'shear' | 'moment'

const EPS = 1e-9

/** Horner evaluation; coefficients ascending in t. */
export function horner(c: number[], t: number): number {
  let r = 0
  for (let i = c.length - 1; i >= 0; i--) r = r * t + c[i]
  return r
}

export function degree(c: number[]): number {
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

export interface AreaRegion {
  sign: 1 | -1
  x0: number
  x1: number
  area: number // kN·m
  pts: [number, number][] // points in (x, V) coordinates around zero line
}

export interface ShearIntegrationResult {
  xStart: number
  xEnd: number
  totalArea: number
  positiveArea: number
  negativeArea: number
  momentStart: number
  momentEnd: number
  deltaMoment: number
  momentJumpSum: number
  regions: AreaRegion[]
}

/** Anti-derivative evaluation of Horner polynomial: Q(t) where dQ/dt = P(t). */
export function integrateHorner(c: number[], t: number): number {
  let r = 0
  for (let i = c.length - 1; i >= 0; i--) {
    r = r * t + c[i] / (i + 1)
  }
  return r * t
}

/** Find real roots of polynomial strictly inside (t0, t1). */
function findShearRoots(c: number[], t0: number, t1: number): number[] {
  const d = degree(c)
  const roots: number[] = []
  if (d === 1) {
    if (Math.abs(c[1]) > 1e-12) {
      const r = -c[0] / c[1]
      if (r > t0 + 1e-6 && r < t1 - 1e-6) roots.push(r)
    }
  } else if (d === 2) {
    const [c0, c1, c2] = [c[0], c[1], c[2]]
    const disc = c1 * c1 - 4 * c2 * c0
    if (disc >= 0 && Math.abs(c2) > 1e-12) {
      const sq = Math.sqrt(disc)
      const r1 = (-c1 - sq) / (2 * c2)
      const r2 = (-c1 + sq) / (2 * c2)
      if (r1 > t0 + 1e-6 && r1 < t1 - 1e-6) roots.push(r1)
      if (r2 > t0 + 1e-6 && r2 < t1 - 1e-6) roots.push(r2)
    }
  }
  return roots.sort((a, b) => a - b)
}

/**
 * Computes exact closed-form integral of shear force: Area = ∫_{x_a}^{x_b} V(x) dx.
 * Decomposes into positive and negative regions and correlates with ΔM = M(x_b) - M(x_a).
 */
export function integrateShear(
  result: AnalysisResult,
  xStart: number,
  xEnd: number,
  pxPerM: number = 100,
): ShearIntegrationResult | null {
  const segs = result.segments
  if (!segs.length) return null

  const L = segs[segs.length - 1].x_end
  const a = Math.max(0, Math.min(xStart, xEnd, L))
  const b = Math.min(L, Math.max(xStart, xEnd, 0))
  if (b - a < 1e-5) return null

  let totalArea = 0
  let positiveArea = 0
  let negativeArea = 0
  const regions: AreaRegion[] = []

  for (const s of segs) {
    if (s.x_end <= a + EPS || s.x_start >= b - EPS) continue

    const xLo = Math.max(a, s.x_start)
    const xHi = Math.min(b, s.x_end)
    const tLo = xLo - s.x_start
    const tHi = xHi - s.x_start

    const c = coeffs(s, 'shear')
    const roots = findShearRoots(c, tLo, tHi)
    const subBreaks = [tLo, ...roots, tHi]

    for (let i = 0; i < subBreaks.length - 1; i++) {
      const t0 = subBreaks[i]
      const t1 = subBreaks[i + 1]
      if (t1 - t0 < 1e-7) continue

      const area = integrateHorner(c, t1) - integrateHorner(c, t0)
      const tMid = (t0 + t1) / 2
      const vMid = horner(c, tMid)
      const sign: 1 | -1 = vMid >= 0 ? 1 : -1

      if (sign > 0) positiveArea += area
      else negativeArea += area
      totalArea += area

      // Build polygon coordinates: (x, 0) -> (x(t), V(t)) -> (x1, 0)
      const x0 = s.x_start + t0
      const x1 = s.x_start + t1
      const nSteps = Math.max(2, Math.ceil(((x1 - x0) * pxPerM) / 4))
      const pts: [number, number][] = [[x0, 0]]
      for (let k = 0; k <= nSteps; k++) {
        const tau = t0 + ((t1 - t0) * k) / nSteps
        pts.push([s.x_start + tau, horner(c, tau)])
      }
      pts.push([x1, 0])

      regions.push({ sign, x0, x1, area, pts })
    }
  }

  const mStart = valueAt(result, a, 'moment').right
  const mEnd = valueAt(result, b, 'moment').left
  const deltaMoment = mEnd - mStart

  // Jumps in moment diagram caused by applied couples inside (a, b)
  let momentJumpSum = 0
  for (const cp of result.critical_points) {
    if (cp.x > a + 1e-5 && cp.x < b - 1e-5) {
      momentJumpSum += cp.moment_right - cp.moment_left
    }
  }

  return {
    xStart: a,
    xEnd: b,
    totalArea,
    positiveArea,
    negativeArea,
    momentStart: mStart,
    momentEnd: mEnd,
    deltaMoment,
    momentJumpSum,
    regions,
  }
}


