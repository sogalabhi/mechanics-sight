import type { AnalysisResult, BeamInput } from '@/model/types'
import { valueAt } from './poly'

export interface ForceContribution {
  id: string
  label: string
  x: number
  fy: number // kN (positive upward)
  leverArm: number // m (xCut - x, >= 0)
  momentAboutCut: number // kN·m (clockwise positive = sagging contribution)
}

export interface DistributedContribution {
  id: string
  label: string
  xStart: number
  xEnd: number // clamped to xCut
  wStart: number // kN/m (negative downward)
  wEnd: number // kN/m
  resultantFy: number // kN (negative downward)
  centroidX: number // m
  leverArm: number // m (xCut - centroidX)
  momentAboutCut: number // kN·m
}

export interface MomentContribution {
  id: string
  label: string
  x: number
  magnitude: number // input magnitude (negative clockwise)
  momentAboutCut: number // kN·m (clockwise positive)
}

export interface SectionCutResult {
  xCut: number // m
  leftLength: number // m
  reactions: ForceContribution[]
  reactionMoments: MomentContribution[]
  pointLoads: ForceContribution[]
  distributedLoads: DistributedContribution[]
  couples: MomentContribution[]

  // Force equilibrium
  sumReactionsFy: number
  sumLoadsFy: number
  netExternalFy: number // sumReactionsFy + sumLoadsFy
  vCut: number // balancing internal shear on right face: V = netExternalFy

  // Moment equilibrium about cut
  sumReactionsMoment: number
  sumReactionMoments: number
  sumLoadsMoment: number
  sumCouplesMoment: number
  netExternalMoment: number
  mCut: number // balancing internal moment: M = netExternalMoment

  // Diagram cross-checks
  vDiagram: number
  mDiagram: number

  isSagging: boolean
  isHogging: boolean
}

/**
 * Computes exact static equilibrium for the isolated left Free Body Diagram (FBD)
 * of a beam sliced at coordinate xCut.
 *
 * Equilibrium relations:
 *   Σ Fy = 0       => V_cut = Σ Fy_left
 *   Σ M_cut = 0   => M_cut = Σ M_clockwise,left
 */
export function computeSectionCut(
  beam: BeamInput,
  result: AnalysisResult,
  xCut: number,
): SectionCutResult | null {
  if (xCut <= 1e-6 || xCut >= beam.length - 1e-6) {
    return null
  }

  // 1. Reactions to the left of the cut
  const reactions: ForceContribution[] = []
  const reactionMoments: MomentContribution[] = []

  const supports = beam.supports ?? []
  const loads = beam.loads ?? []

  let sumReactionsFy = 0
  let sumReactionsMoment = 0
  let sumReactionMoments = 0

  for (const s of supports) {
    if (s.position < xCut - 1e-6) {
      const r = result.reactions.find((rec) => rec.support_id === s.id)
      if (r) {
        if (Math.abs(r.fy) > 1e-6) {
          const arm = xCut - s.position
          // Upward force (+fy) turns clockwise about the cut (sagging positive)
          const mAboutCut = r.fy * arm
          reactions.push({
            id: s.id,
            label: `Reaction ${s.id.toUpperCase()}`,
            x: s.position,
            fy: r.fy,
            leverArm: arm,
            momentAboutCut: mAboutCut,
          })
          sumReactionsFy += r.fy
          sumReactionsMoment += mAboutCut
        }

        // Fixed support reaction moment
        if (s.type === 'fixed' && Math.abs(r.moment) > 1e-6) {
          // In standard 2D, anticlockwise reaction moment is positive r.moment.
          // On the left slice, an anticlockwise moment tends to bend the beam downwards (hogging negative).
          // Hence its contribution to sagging moment is -r.moment.
          const mContribution = -r.moment
          reactionMoments.push({
            id: `${s.id}-moment`,
            label: `Wall Moment ${s.id.toUpperCase()}`,
            x: s.position,
            magnitude: r.moment,
            momentAboutCut: mContribution,
          })
          sumReactionMoments += mContribution
        }
      }
    }
  }

  // 2. Applied Point Loads to the left of the cut
  const pointLoads: ForceContribution[] = []
  let sumPointLoadsFy = 0
  let sumPointLoadsMoment = 0

  for (const l of loads) {
    if (l.type === 'point' && l.position < xCut - 1e-6) {
      const arm = xCut - l.position
      // Downward load (magnitude < 0) turns anticlockwise about cut (hogging negative)
      const mAboutCut = l.magnitude * arm
      pointLoads.push({
        id: l.id,
        label: `Point Load ${l.id}`,
        x: l.position,
        fy: l.magnitude,
        leverArm: arm,
        momentAboutCut: mAboutCut,
      })
      sumPointLoadsFy += l.magnitude
      sumPointLoadsMoment += mAboutCut
    }
  }

  // 3. Applied Distributed Loads to the left of the cut (clamped to xCut)
  const distributedLoads: DistributedContribution[] = []
  let sumDistributedFy = 0
  let sumDistributedMoment = 0

  for (const l of loads) {
    if (l.type === 'distributed' && l.start < xCut - 1e-6) {
      const xEndClamped = Math.min(l.end, xCut)
      const sliceLen = xEndClamped - l.start
      if (sliceLen > 1e-6) {
        const fullLen = l.end - l.start
        const fracStart = 0
        const fracEnd = sliceLen / fullLen
        const wStart = l.w_start + (l.w_end - l.w_start) * fracStart
        const wEnd = l.w_start + (l.w_end - l.w_start) * fracEnd

        // Trapezoid resultant force
        const resultantFy = ((wStart + wEnd) / 2) * sliceLen

        // Local centroid from slice start
        let xCentroidLocal = sliceLen / 2
        if (Math.abs(wStart + wEnd) > 1e-9) {
          xCentroidLocal = (sliceLen * (wStart + 2 * wEnd)) / (3 * (wStart + wEnd))
        }
        const centroidX = l.start + xCentroidLocal
        const arm = xCut - centroidX
        const mAboutCut = resultantFy * arm

        distributedLoads.push({
          id: l.id,
          label: sliceLen < fullLen - 1e-4 ? `UDL Slice ${l.id}` : `Distributed Load ${l.id}`,
          xStart: l.start,
          xEnd: xEndClamped,
          wStart,
          wEnd,
          resultantFy,
          centroidX,
          leverArm: arm,
          momentAboutCut: mAboutCut,
        })

        sumDistributedFy += resultantFy
        sumDistributedMoment += mAboutCut
      }
    }
  }

  // 4. Applied Point Moments (Couples) to the left of the cut
  const couples: MomentContribution[] = []
  let sumCouplesMoment = 0

  for (const l of loads) {
    if (l.type === 'moment' && l.position < xCut - 1e-6) {
      // Clockwise input is negative magnitude, which produces a positive jump in BMD.
      // Hence clockwise couple contributes -magnitude to sagging moment.
      const mAboutCut = -l.magnitude
      couples.push({
        id: l.id,
        label: `Couple ${l.id}`,
        x: l.position,
        magnitude: l.magnitude,
        momentAboutCut: mAboutCut,
      })
      sumCouplesMoment += mAboutCut
    }
  }

  // 5. Total Net Equilibrium
  const sumLoadsFy = sumPointLoadsFy + sumDistributedFy
  const netExternalFy = sumReactionsFy + sumLoadsFy
  const vCut = netExternalFy

  const sumLoadsMoment = sumPointLoadsMoment + sumDistributedMoment
  const netExternalMoment =
    sumReactionsMoment + sumReactionMoments + sumLoadsMoment + sumCouplesMoment
  const mCut = netExternalMoment

  // 6. Diagram cross-check values at xCut
  const sfdVal = valueAt(result, xCut, 'shear').left
  const bmdVal = valueAt(result, xCut, 'moment').left

  return {
    xCut,
    leftLength: xCut,
    reactions,
    reactionMoments,
    pointLoads,
    distributedLoads,
    couples,

    sumReactionsFy,
    sumLoadsFy,
    netExternalFy,
    vCut,

    sumReactionsMoment,
    sumReactionMoments,
    sumLoadsMoment,
    sumCouplesMoment,
    netExternalMoment,
    mCut,

    vDiagram: sfdVal,
    mDiagram: bmdVal,

    isSagging: mCut > 1e-4,
    isHogging: mCut < -1e-4,
  }
}
