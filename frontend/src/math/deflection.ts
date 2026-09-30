import type { AnalysisResult, BeamInput, Segment } from '@/model/types'
import { degree, horner } from './poly'

export interface DeflectionPoint {
  x: number // m
  yRaw: number // raw analytical deflection (EI = 1, sagging/downward positive)
  yNorm: number // normalized in [-1, 1] relative to max deflection
  slope: number // dy/dx
  moment: number // M(x) in kN·m
  isSagging: boolean // M > 0
  isHogging: boolean // M < 0
}

export interface InflectionPoint {
  x: number
  yRaw: number
  yNorm: number
}

export interface ElasticCurveResult {
  points: DeflectionPoint[]
  inflectionPoints: InflectionPoint[]
  maxDeflection: { x: number; yRaw: number; yNorm: number } | null
  maxSagging: { x: number; yRaw: number } | null
  maxHogging: { x: number; yRaw: number } | null
}

interface SegmentAccumulator {
  s: Segment
  h: number
  thetaStart: number
  yStart: number
  thetaLocal: (t: number) => number
  yLocal: (t: number) => number
}

/**
 * Computes the exact analytical elastic curve (deflection y(x) and slope θ(x))
 * by integrating Euler-Bernoulli equation EI y'' = M(x) twice in closed form.
 */
export function solveElasticCurve(
  beam: BeamInput,
  result: AnalysisResult,
  nPoints: number = 200,
): ElasticCurveResult | null {
  const segs = result.segments
  if (!segs.length) return null

  const L = beam.length
  if (L <= 0) return null

  // 1. Build piecewise cumulative double integrals
  const accum: SegmentAccumulator[] = []
  let runningTheta = 0
  let runningY = 0

  for (const s of segs) {
    const h = s.x_end - s.x_start
    // Downward deflection positive: EI * y'' = -M(x)
    // Sagging (M > 0) curves concave downward in y (positive downward displacement)
    const m = s.moment.map((v) => -v)
    const thetaLocal = (t: number) => {
      let r = 0
      for (let k = m.length - 1; k >= 0; k--) r = r * t + m[k] / (k + 1)
      return r * t
    }
    const yLocal = (t: number) => {
      let r = 0
      for (let k = m.length - 1; k >= 0; k--) r = r * t + m[k] / ((k + 1) * (k + 2))
      return r * t * t
    }

    accum.push({
      s,
      h,
      thetaStart: runningTheta,
      yStart: runningY,
      thetaLocal,
      yLocal,
    })

    const deltaTheta = thetaLocal(h)
    const deltaY = yLocal(h)
    runningY += runningTheta * h + deltaY
    runningTheta += deltaTheta
  }

  // Evaluator for particular integrals y0(x) and theta0(x)
  const evalParticular = (x: number): { y0: number; theta0: number } => {
    const clampedX = Math.min(Math.max(x, 0), L)
    for (let i = 0; i < accum.length; i++) {
      const a = accum[i]
      if (clampedX <= a.s.x_end + 1e-9 || i === accum.length - 1) {
        const t = Math.max(0, Math.min(clampedX - a.s.x_start, a.h))
        return {
          theta0: a.thetaStart + a.thetaLocal(t),
          y0: a.yStart + a.thetaStart * t + a.yLocal(t),
        }
      }
    }
    return { y0: 0, theta0: 0 }
  }

  // 2. Solve integration constants C1, C2 from boundary conditions
  let C1 = 0
  let C2 = 0

  const fixed = beam.supports.find((s) => s.type === 'fixed')
  if (fixed) {
    // Fixed support at x_f: y(x_f) = 0 and theta(x_f) = 0
    const xf = fixed.position
    const p = evalParticular(xf)
    C1 = -p.theta0
    C2 = -p.y0 - C1 * xf
  } else {
    // Pins and Rollers: y(x1) = 0, y(x2) = 0
    const vert = beam.supports
      .filter((s) => s.type === 'pin' || s.type === 'roller')
      .sort((a, b) => a.position - b.position)

    if (vert.length >= 2) {
      const x1 = vert[0].position
      const x2 = vert[vert.length - 1].position
      if (Math.abs(x2 - x1) > 1e-6) {
        const p1 = evalParticular(x1)
        const p2 = evalParticular(x2)
        C1 = -(p2.y0 - p1.y0) / (x2 - x1)
        C2 = -p1.y0 - C1 * x1
      }
    }
  }

  // Deflection function: y(x) = y0(x) + C1*x + C2
  const evalDeflection = (x: number) => {
    const p = evalParticular(x)
    return {
      y: p.y0 + C1 * x + C2,
      theta: p.theta0 + C1,
    }
  }

  // 3. Detect inflection points (points of contraflexure where M = 0)
  const inflectionPoints: InflectionPoint[] = []
  for (const s of segs) {
    const m = s.moment
    const d = degree(m)
    const roots: number[] = []
    if (d === 1) {
      if (Math.abs(m[1]) > 1e-12) {
        const r = -m[0] / m[1]
        if (r > 1e-5 && r < s.x_end - s.x_start - 1e-5) roots.push(r)
      }
    } else if (d === 2) {
      const disc = m[1] * m[1] - 4 * m[2] * m[0]
      if (disc >= 0 && Math.abs(m[2]) > 1e-12) {
        const sq = Math.sqrt(disc)
        const r1 = (-m[1] - sq) / (2 * m[2])
        const r2 = (-m[1] + sq) / (2 * m[2])
        const len = s.x_end - s.x_start
        if (r1 > 1e-5 && r1 < len - 1e-5) roots.push(r1)
        if (r2 > 1e-5 && r2 < len - 1e-5) roots.push(r2)
      }
    }
    for (const r of roots) {
      const xInf = s.x_start + r
      const { y } = evalDeflection(xInf)
      inflectionPoints.push({
        x: xInf,
        yRaw: y,
        yNorm: 0,
      })
    }
  }

  // Also check segment junctions (interior boundaries 0 < x < L)
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]
    const sNext = segs[i + 1]
    const xJunc = s.x_end
    if (xJunc > 1e-4 && xJunc < L - 1e-4) {
      const mLeft = horner(s.moment, s.x_end - s.x_start)
      const mRight = horner(sNext.moment, 0)
      const signChange = (mLeft > 1e-4 && mRight < -1e-4) || (mLeft < -1e-4 && mRight > 1e-4)
      const zeroBoundary = Math.abs(mLeft) < 1e-4 && Math.abs(mRight) < 1e-4
      if (signChange || zeroBoundary) {
        if (!inflectionPoints.some((p) => Math.abs(p.x - xJunc) < 1e-4)) {
          const { y } = evalDeflection(xJunc)
          inflectionPoints.push({
            x: xJunc,
            yRaw: y,
            yNorm: 0,
          })
        }
      }
    }
  }

  // 4. Sample points across the beam including exact support and inflection landmarks
  const landmarkSet = new Set<number>([
    0,
    L,
    ...beam.supports.map((s) => s.position),
    ...result.critical_points.map((c) => c.x),
    ...inflectionPoints.map((p) => p.x),
  ])

  // Uniform grid points
  const uniformStep = L / (nPoints - 1)
  for (let i = 0; i < nPoints; i++) {
    landmarkSet.add(Math.min(L, i * uniformStep))
  }

  const sortedX = Array.from(landmarkSet).sort((a, b) => a - b)
  const points: DeflectionPoint[] = []

  for (const x of sortedX) {
    const { y, theta } = evalDeflection(x)

    // Evaluate moment at x
    const seg = segs.find((s) => s.x_start <= x + 1e-9 && x <= s.x_end + 1e-9) ?? segs[segs.length - 1]
    const t = Math.max(0, Math.min(x - seg.x_start, seg.x_end - seg.x_start))
    const m = horner(seg.moment, t)

    points.push({
      x,
      yRaw: y,
      yNorm: 0,
      slope: theta,
      moment: m,
      isSagging: m > 1e-6,
      isHogging: m < -1e-6,
    })
  }

  // 4. Normalize deflections
  let maxAbs = 0
  let maxSag: { x: number; yRaw: number } | null = null
  let maxHog: { x: number; yRaw: number } | null = null
  let maxPt: { x: number; yRaw: number; yNorm: number } | null = null

  for (const pt of points) {
    const absVal = Math.abs(pt.yRaw)
    if (absVal > maxAbs) {
      maxAbs = absVal
      maxPt = { x: pt.x, yRaw: pt.yRaw, yNorm: 0 }
    }
    if (pt.yRaw > (maxSag?.yRaw ?? 0)) {
      maxSag = { x: pt.x, yRaw: pt.yRaw }
    }
    if (pt.yRaw < (maxHog?.yRaw ?? 0)) {
      maxHog = { x: pt.x, yRaw: pt.yRaw }
    }
  }

  if (maxAbs > 1e-12) {
    for (const pt of points) {
      pt.yNorm = pt.yRaw / maxAbs
    }
    for (const inf of inflectionPoints) {
      inf.yNorm = inf.yRaw / maxAbs
    }
    if (maxPt) {
      maxPt.yNorm = maxPt.yRaw / maxAbs
    }
  } else {
    maxPt = { x: beam.length / 2, yRaw: 0, yNorm: 0 }
  }

  return {
    points,
    inflectionPoints,
    maxDeflection: maxPt,
    maxSagging: maxSag && maxSag.yRaw > 1e-6 ? maxSag : null,
    maxHogging: maxHog && maxHog.yRaw < -1e-6 ? maxHog : null,
  }
}
