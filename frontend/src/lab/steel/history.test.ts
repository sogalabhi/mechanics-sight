import { describe, expect, it } from 'vitest'
import { fresh, gesturePoints, pushStrain, pushUnload, sliderToStrain, strainToSlider, withGesture } from './history'
import type { LabOp } from './types'

const s = (to: number): LabOp => ({ op: 'strain', to })
const unload: LabOp = { op: 'unload_to_zero_stress' }

describe('pushStrain', () => {
  it('starts a history and merges moves in the same direction', () => {
    expect(pushStrain([], 0.01)).toEqual([s(0.01)])
    expect(pushStrain([s(0.01)], 0.02)).toEqual([s(0.02)])
    expect(pushStrain([s(0.01), s(0.02)], 0.05)).toEqual([s(0.01), s(0.05)])
  })

  it('keeps a move the other way: it is a real unloading', () => {
    expect(pushStrain([s(0.05)], 0.03)).toEqual([s(0.05), s(0.03)])
    expect(pushStrain([s(0.05), s(0.03)], 0.01)).toEqual([s(0.05), s(0.01)])
    expect(pushStrain([s(0.05), s(0.03)], 0.04)).toEqual([s(0.05), s(0.03), s(0.04)])
  })

  it('does not repeat the same strain', () => {
    expect(pushStrain([s(0.05)], 0.05)).toEqual([s(0.05)])
  })

  it('treats a move after an unload or a reset as a new upward move', () => {
    expect(pushStrain([s(0.05), unload], 0.06)).toEqual([s(0.05), unload, s(0.06)])
    expect(pushStrain([s(0.05), unload, s(0.06)], 0.07)).toEqual([s(0.05), unload, s(0.07)])
    expect(pushStrain([{ op: 'reset' }, s(0.01)], 0.02)).toEqual([{ op: 'reset' }, s(0.02)])
  })

  it('does not mutate its input', () => {
    const h = [s(0.01)]
    pushStrain(h, 0.02)
    expect(h).toEqual([s(0.01)])
  })

  it('a long monotone drag stays one operation', () => {
    let h: LabOp[] = []
    for (let i = 1; i <= 400; i++) h = pushStrain(h, i / 2000)
    expect(h).toHaveLength(1)
  })
})

describe('pushUnload and fresh', () => {
  it('does not stack unloads', () => {
    expect(pushUnload(pushUnload([s(0.05)]))).toEqual([s(0.05), unload])
    expect(fresh()).toEqual([])
  })
})

describe('gesturePoints', () => {
  const run = (start: number, path: number[], hyst = 4) => path.reduce<number[]>((p, u) => gesturePoints(start, p, u, hyst), [])

  it('a monotone drag is one turning point', () => {
    expect(run(100, [110, 120, 130, 200])).toEqual([200])
  })
  it('ignores jitter smaller than the hysteresis', () => {
    expect(run(100, [200, 199, 198, 201, 250])).toEqual([250])
  })
  it('keeps a real reversal', () => {
    expect(run(100, [300, 290, 280, 270])).toEqual([300, 270])
  })
  it('returning to the start is a reversal too', () => {
    expect(run(100, [300, 100])).toEqual([300, 100])
  })
  it('standing still adds nothing', () => {
    expect(run(100, [100, 100])).toEqual([])
  })
})

describe('slider mapping', () => {
  it('maps the ends and is finer at small strain', () => {
    expect(sliderToStrain(0, 0.25)).toBe(0)
    expect(sliderToStrain(1000, 0.25)).toBeCloseTo(0.25, 12)
    expect(sliderToStrain(100, 0.25) - sliderToStrain(99, 0.25)).toBeLessThan(sliderToStrain(1000, 0.25) - sliderToStrain(999, 0.25))
  })
  it('round-trips through the slider grid', () => {
    for (const u of [0, 1, 17, 177, 500, 1000]) expect(strainToSlider(sliderToStrain(u, 0.25), 0.25)).toBe(u)
    expect(strainToSlider(2, 0.25)).toBe(1000)
    expect(strainToSlider(-1, 0.25)).toBe(0)
  })
  it('builds the request history from a gesture', () => {
    const h = withGesture([], [500, 300], 0.25)
    expect(h).toHaveLength(2)
    expect((h[0] as { to: number }).to).toBeCloseTo(0.03125, 8)
    expect((h[1] as { to: number }).to).toBeCloseTo(0.00675, 8)
  })
})
