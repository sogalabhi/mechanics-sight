import type { SectionInput } from '@/model/types'

export interface StressProfilePoint {
  y: number // m from neutral axis
  sigma: number // kPa (positive = tension)
  tau: number // kPa
}

export interface StressProfileData {
  section: SectionInput
  height: number
  yTop: number
  yBottom: number
  inertia: number
  area: number
  sigmaTop: number // kPa
  sigmaBottom: number // kPa
  tauMax: number // kPa
  points: StressProfilePoint[]
}

export function computeStressProfile(
  section: SectionInput,
  momentKnm: number,
  shearKn: number,
  numPoints = 21,
): StressProfileData {
  let height = 0
  let yTop = 0
  let yBottom = 0
  let inertia = 0
  let area = 0

  const widthAt = (y: number): number => {
    if (y < yBottom - 1e-6 || y > yTop + 1e-6) return 0
    if (section.type === 'rectangle') {
      const w = section.width
      const t = section.wall_thickness
      if (t != null) {
        const inH = section.height - 2 * t
        if (Math.abs(y) < inH / 2) return 2 * t
      }
      return w
    }
    if (section.type === 'circle') {
      const r = section.diameter / 2
      const t = section.wall_thickness
      let w = 2 * Math.sqrt(Math.max(0, r * r - y * y))
      if (t != null) {
        const rIn = r - t
        if (Math.abs(y) < rIn) w -= 2 * Math.sqrt(Math.max(0, rIn * rIn - y * y))
      }
      return Math.max(0, w)
    }
    if (section.type === 'i') {
      const webH = section.height - 2 * section.flange_thickness
      if (Math.abs(y) < webH / 2) return section.web_thickness
      return section.flange_width
    }
    // T-section
    const flangeBottom = section.web_depth - (-yBottom)
    return y < flangeBottom ? section.web_thickness : section.flange_width
  }

  const firstMomentAbove = (yCut: number): number => {
    if (yCut >= yTop - 1e-6) return 0
    if (yCut <= yBottom + 1e-6) return 0

    if (section.type === 'rectangle') {
      const w = section.width
      const h = section.height
      const t = section.wall_thickness
      const qRect = (width: number, b: number, t: number, cut: number) => {
        if (cut >= t) return 0
        const lo = Math.max(cut, b)
        return (width * (t * t - lo * lo)) / 2
      }
      let q = qRect(w, -h / 2, h / 2, yCut)
      if (t != null) {
        const inW = w - 2 * t
        const inH = h - 2 * t
        q -= qRect(inW, -inH / 2, inH / 2, yCut)
      }
      return Math.max(0, q)
    }

    if (section.type === 'circle') {
      const r = section.diameter / 2
      const t = section.wall_thickness
      const qCirc = (rad: number, cut: number) => {
        if (cut <= -rad || cut >= rad) return 0
        return (2 * Math.pow(Math.max(0, rad * rad - cut * cut), 1.5)) / 3
      }
      let q = qCirc(r, yCut)
      if (t != null) q -= qCirc(r - t, yCut)
      return Math.max(0, q)
    }

    if (section.type === 'i') {
      const h = section.height
      const bf = section.flange_width
      const tf = section.flange_thickness
      const tw = section.web_thickness
      const webHalf = (h - 2 * tf) / 2
      const qRect = (w: number, b: number, t: number, cut: number) => {
        if (cut >= t) return 0
        const lo = Math.max(cut, b)
        return (w * (t * t - lo * lo)) / 2
      }
      return (
        qRect(bf, -h / 2, -webHalf, yCut) +
        qRect(tw, -webHalf, webHalf, yCut) +
        qRect(bf, webHalf, h / 2, yCut)
      )
    }

    // T-section
    const centroid = -yBottom
    const flangeBottom = section.web_depth - centroid
    const qRect = (w: number, b: number, t: number, cut: number) => {
      if (cut >= t) return 0
      const lo = Math.max(cut, b)
      return (w * (t * t - lo * lo)) / 2
    }
    return (
      qRect(section.web_thickness, -centroid, flangeBottom, yCut) +
      qRect(section.flange_width, flangeBottom, yTop, yCut)
    )
  }

  if (section.type === 'rectangle') {
    height = section.height
    yTop = height / 2
    yBottom = -height / 2
    const w = section.width
    const t = section.wall_thickness
    const inW = t != null ? w - 2 * t : 0
    const inH = t != null ? height - 2 * t : 0
    area = w * height - inW * inH
    inertia = (w * Math.pow(height, 3) - inW * Math.pow(inH, 3)) / 12
  } else if (section.type === 'circle') {
    height = section.diameter
    yTop = height / 2
    yBottom = -height / 2
    const dIn = section.wall_thickness != null ? section.diameter - 2 * section.wall_thickness : 0
    area = (Math.PI * (Math.pow(section.diameter, 2) - Math.pow(dIn, 2))) / 4
    inertia = (Math.PI * (Math.pow(section.diameter, 4) - Math.pow(dIn, 4))) / 64
  } else if (section.type === 'i') {
    height = section.height
    yTop = height / 2
    yBottom = -height / 2
    const webDepth = height - 2 * section.flange_thickness
    area = 2 * section.flange_width * section.flange_thickness + section.web_thickness * webDepth
    inertia =
      (section.flange_width * Math.pow(height, 3) -
        (section.flange_width - section.web_thickness) * Math.pow(webDepth, 3)) /
      12
  } else {
    // T-section
    height = section.web_depth + section.flange_thickness
    const webArea = section.web_thickness * section.web_depth
    const flangeArea = section.flange_width * section.flange_thickness
    area = webArea + flangeArea
    const centroidFromBottom =
      (webArea * (section.web_depth / 2) +
        flangeArea * (section.web_depth + section.flange_thickness / 2)) /
      area
    yTop = height - centroidFromBottom
    yBottom = -centroidFromBottom
    inertia =
      (section.web_thickness * Math.pow(section.web_depth, 3)) / 12 +
      webArea * Math.pow(section.web_depth / 2 - centroidFromBottom, 2) +
      (section.flange_width * Math.pow(section.flange_thickness, 3)) / 12 +
      flangeArea * Math.pow(section.web_depth + section.flange_thickness / 2 - centroidFromBottom, 2)
  }

  const sigmaTop = inertia > 0 ? (-momentKnm * yTop) / inertia : 0
  const sigmaBottom = inertia > 0 ? (-momentKnm * yBottom) / inertia : 0

  const qNa = firstMomentAbove(0)
  const bNa = widthAt(0)
  const tauMax = inertia > 0 && bNa > 0 ? (Math.abs(shearKn) * qNa) / (inertia * bNa) : 0

  const points: StressProfilePoint[] = []
  for (let i = 0; i < numPoints; i++) {
    const y = yBottom + ((yTop - yBottom) * i) / (numPoints - 1)
    const sigma = inertia > 0 ? (-momentKnm * y) / inertia : 0
    const b = widthAt(y)
    const q = firstMomentAbove(y)
    const tau = inertia > 0 && b > 0 ? (Math.abs(shearKn) * q) / (inertia * b) : 0
    points.push({ y, sigma, tau })
  }

  return {
    section,
    height,
    yTop,
    yBottom,
    inertia,
    area,
    sigmaTop,
    sigmaBottom,
    tauMax,
    points,
  }
}
