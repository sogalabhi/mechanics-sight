import { describe, expect, it } from 'vitest'
import type { AnalysisResult, BeamInput } from '@/model/types'
import { computeSectionCut } from './sectionCut'

const fixtures = import.meta.glob('../../../shared/fixtures/*.json', { eager: true }) as Record<
  string,
  { default: { name: string; input: BeamInput; output: AnalysisResult } }
>

describe('computeSectionCut (Virtual Saw / Method of Sections Equilibrium)', () => {
  it('01_ss_central_point: cuts before and after midspan match SFD and BMD', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('central_point'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    // Cut at x = 1.5 m (before point load at 3.0 m)
    const cut1 = computeSectionCut(fixture.input, fixture.output, 1.5)
    expect(cut1).not.toBeNull()
    if (!cut1) return

    expect(cut1.reactions.length).toBe(1)
    expect(cut1.pointLoads.length).toBe(0)
    expect(cut1.vCut).toBeCloseTo(5.0, 5)
    expect(cut1.mCut).toBeCloseTo(7.5, 5)
    expect(cut1.vCut).toBeCloseTo(cut1.vDiagram, 5)
    expect(cut1.mCut).toBeCloseTo(cut1.mDiagram, 5)

    // Cut at x = 4.5 m (after point load at 3.0 m)
    const cut2 = computeSectionCut(fixture.input, fixture.output, 4.5)
    expect(cut2).not.toBeNull()
    if (!cut2) return

    expect(cut2.reactions.length).toBe(1)
    expect(cut2.pointLoads.length).toBe(1)
    expect(cut2.vCut).toBeCloseTo(-5.0, 5)
    expect(cut2.mCut).toBeCloseTo(7.5, 5)
    expect(cut2.vCut).toBeCloseTo(cut2.vDiagram, 5)
    expect(cut2.mCut).toBeCloseTo(cut2.mDiagram, 5)
  })

  it('02_ss_full_udl: midspan section cut proves V = 0 and M = wL^2 / 8', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('full_udl'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const midCut = computeSectionCut(fixture.input, fixture.output, 3.0)
    expect(midCut).not.toBeNull()
    if (!midCut) return

    // R1 = 6 kN, UDL slice from 0 to 3 has resultant -6 kN
    expect(midCut.sumReactionsFy).toBeCloseTo(6.0, 5)
    expect(midCut.distributedLoads[0].resultantFy).toBeCloseTo(-6.0, 5)
    expect(midCut.vCut).toBeCloseTo(0.0, 5)
    expect(midCut.mCut).toBeCloseTo(9.0, 5)
    expect(midCut.vCut).toBeCloseTo(midCut.vDiagram, 5)
    expect(midCut.mCut).toBeCloseTo(midCut.mDiagram, 5)
    expect(midCut.isSagging).toBe(true)
  })

  it('03_cantilever_left_udl: wall reactions hold slice in equilibrium', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('cantilever_left_udl'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const cut = computeSectionCut(fixture.input, fixture.output, 2.0)
    expect(cut).not.toBeNull()
    if (!cut) return

    // At x = 2, V = 12 - 3*2 = 6 kN
    // M = -24 + 12*2 - 6*1 = -6 kN·m
    expect(cut.vCut).toBeCloseTo(6.0, 5)
    expect(cut.mCut).toBeCloseTo(-6.0, 5)
    expect(cut.vCut).toBeCloseTo(cut.vDiagram, 5)
    expect(cut.mCut).toBeCloseTo(cut.mDiagram, 5)
    expect(cut.isHogging).toBe(true)
  })

  it('06_ss_clockwise_couple: couples contribute to moment equilibrium', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('clockwise_couple'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    // Cut at x = 1.0 m (before couple at 2.0 m)
    const cutBefore = computeSectionCut(fixture.input, fixture.output, 1.0)
    expect(cutBefore).not.toBeNull()
    if (!cutBefore) return
    expect(cutBefore.vCut).toBeCloseTo(cutBefore.vDiagram, 5)
    expect(cutBefore.mCut).toBeCloseTo(cutBefore.mDiagram, 5)

    // Cut at x = 3.0 m (after couple at 2.0 m)
    const cutAfter = computeSectionCut(fixture.input, fixture.output, 3.0)
    expect(cutAfter).not.toBeNull()
    if (!cutAfter) return
    expect(cutAfter.couples.length).toBe(1)
    expect(cutAfter.vCut).toBeCloseTo(cutAfter.vDiagram, 5)
    expect(cutAfter.mCut).toBeCloseTo(cutAfter.mDiagram, 5)
  })

  it('07_ss_triangular: triangular load slice matches SFD and BMD', () => {
    const fixture = Object.values(fixtures).find((f) => f.default.name.includes('ss_triangular'))?.default
    expect(fixture).toBeDefined()
    if (!fixture) return

    const cut = computeSectionCut(fixture.input, fixture.output, 3.0)
    expect(cut).not.toBeNull()
    if (!cut) return

    expect(cut.vCut).toBeCloseTo(cut.vDiagram, 4)
    expect(cut.mCut).toBeCloseTo(cut.mDiagram, 4)
  })
})
