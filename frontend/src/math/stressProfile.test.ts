import { describe, expect, it } from 'vitest'
import { computeStressProfile } from './stressProfile'

describe('computeStressProfile', () => {
  it('calculates linear bending stress and parabolic shear stress for rectangular section', () => {
    // 0.1m x 0.2m rectangle under M = 12.5 kN*m, V = 8 kN
    const res = computeStressProfile(
      { type: 'rectangle', width: 0.1, height: 0.2 },
      12.5,
      8.0,
      11,
    )

    // I = 0.1 * 0.2^3 / 12 = 6.6667e-5
    // sigma_top = -12.5 * 0.1 / 6.6667e-5 = -18750 kPa (compression)
    // sigma_bottom = -12.5 * (-0.1) / 6.6667e-5 = +18750 kPa (tension)
    expect(res.sigmaTop).toBeCloseTo(-18750, 0)
    expect(res.sigmaBottom).toBeCloseTo(18750, 0)

    // tau_max = 1.5 * V / A = 1.5 * 8 / 0.02 = 600 kPa
    expect(res.tauMax).toBeCloseTo(600, 0)

    // At neutral axis (middle point)
    const midPoint = res.points[5]
    expect(midPoint.y).toBeCloseTo(0, 5)
    expect(midPoint.sigma).toBeCloseTo(0, 1)
    expect(midPoint.tau).toBeCloseTo(600, 0)

    // At top and bottom outer edges, tau should be 0
    expect(res.points[0].tau).toBeCloseTo(0, 1)
    expect(res.points[10].tau).toBeCloseTo(0, 1)
  })
})
