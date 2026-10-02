import { describe, expect, it } from 'vitest'
import { LANDMARK_ORDER, LANDMARK_TEXT, REGION_TEXT } from './content'
import { mathsFor } from './maths'
import { splitRich } from './rich'
import type { Region, TensionOut } from './types'

// A response shaped like the backend's, with the preset's real numbers.
const out = {
  schema_version: 1,
  state: { strain: 0, stress_mpa: 0, force_kn: 0, extension_mm: 0, plastic_strain: 0, elastic_strain: 0, max_strain: 0, region: 'elastic', landmark: null },
  trace: [],
  landmarks: [
    { id: 'A', name: 'proportional_limit', strain: 0.00115, stress_mpa: 230, reached: false },
    { id: 'B', name: 'elastic_limit', strain: 0.00122, stress_mpa: 240, reached: false },
    { id: 'C', name: 'upper_yield', strain: 0.0014, stress_mpa: 265, reached: false },
    { id: 'D', name: 'lower_yield', strain: 0.0016, stress_mpa: 250, reached: false },
    { id: 'E', name: 'ultimate_tensile_strength', strain: 0.15, stress_mpa: 400, reached: false },
    { id: 'F', name: 'fracture', strain: 0.25, stress_mpa: 300, reached: false },
  ],
  model: {
    preset: 'steel_textbook', name: 'Mild steel, textbook curve', kind: 'idealisation', young_modulus_gpa: 200,
    parameters: { curving_per_mpa2: 2e-7, lower_yield_mpa: 250, peak_mpa: 400, fracture_mpa: 300, strain_hardening: 0.015, strain_peak: 0.15, strain_fracture: 0.25 },
  },
  specimen: { diameter_mm: 10, gauge_length_mm: 50, area_mm2: 78.53981633974483 },
  proof: { offset_strain: 0.002, strain: 0.00325, stress_mpa: 250 },
  warnings: [],
} as unknown as TensionOut

const REGIONS: Region[] = ['elastic', 'elastic_curving', 'yield_onset', 'yield_drop', 'yield_plateau', 'strain_hardening', 'necking', 'unloading', 'reloading', 'fractured']

describe('teaching text', () => {
  it('has text for every region and every lettered point', () => {
    for (const r of REGIONS) {
      expect(REGION_TEXT[r].title.length).toBeGreaterThan(3)
      expect(REGION_TEXT[r].text.length).toBeGreaterThan(20)
    }
    expect(Object.keys(REGION_TEXT).sort()).toEqual([...REGIONS].sort())
    for (const id of LANDMARK_ORDER) expect(LANDMARK_TEXT[id].text.length).toBeGreaterThan(20)
  })
})

describe('maths', () => {
  const at = (region: Region, strain: number, stress: number, plastic = 0) => ({
    strain, stress_mpa: stress, force_kn: (stress * out.specimen.area_mm2) / 1000, extension_mm: strain * 50,
    plastic_strain: plastic, elastic_strain: strain - plastic, max_strain: strain, region, landmark: null,
  })
  const text = (r: Region, e: number, s: number, p = 0) => mathsFor(at(r, e, s, p), out).flatMap((b) => b.lines).join('\n')

  it('works through every region without throwing and shows the backend stress', () => {
    for (const r of REGIONS) expect(text(r, 0.05, 317.7, 0.0484)).toContain('317.7')
  })
  it('writes LaTeX: definitions, the force with units, and the numbers from the response', () => {
    const t = text('strain_hardening', 0.05, 317.69547, 0.04841152)
    expect(t).toContain(String.raw`\sigma = \dfrac{F}{A_0}`)
    expect(t).toContain('78.540\\ \\text{mm}^2')
    expect(t).toContain(String.raw`F = \sigma A_0 = 317.7 \times 78.540 = 24952\ \text{N} = 24.952\ \text{kN}`)
    expect(t).toContain(String.raw`\dfrac{0.15000-0.05000}{0.13500}`)
  })
  it('uses the elastic line for unloading', () => {
    expect(text('unloading', 0.0494, 200, 0.0484)).toContain(String.raw`E\,(\varepsilon-\varepsilon_p) = 200000\,(`)
  })
  it('explains the proof strength with the backend point, and the residual-strain meaning', () => {
    const t = text('elastic', 0, 0)
    expect(t).toContain(String.raw`\sigma_{\text{curve}}(\varepsilon) = E\,(\varepsilon - 0.002)`)
    expect(t).toContain(String.raw`\varepsilon = 0.00325,\qquad \sigma_{0.2} = 250.0`)
    expect(t).toContain(String.raw`\varepsilon_p = \varepsilon - \dfrac{\sigma}{E} = 0.00325 - \dfrac{250.0}{200000} = 0.00200`)
  })
  it('uses valid LaTeX: every line balances its braces and has no unescaped percent', () => {
    for (const r of REGIONS) {
      for (const b of mathsFor(at(r, 0.05, 317.7, 0.0484), out)) {
        for (const l of b.lines) {
          let depth = 0
          for (const ch of l.replace(/\\[{}]/g, '')) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0
          expect(depth, l).toBe(0)
          expect(l.replace(/\\%/g, '')).not.toContain('%')
        }
      }
    }
  })
})

describe('splitRich', () => {
  it('splits text, inline LaTeX, bold and italic', () => {
    expect(splitRich(String.raw`a $x^2$ b **c** *d*`)).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'tex', value: 'x^2' },
      { kind: 'text', value: ' b ' },
      { kind: 'bold', value: 'c' },
      { kind: 'text', value: ' ' },
      { kind: 'italic', value: 'd' },
    ])
  })
  it('leaves plain text alone', () => {
    expect(splitRich('plain')).toEqual([{ kind: 'text', value: 'plain' }])
    expect(splitRich('')).toEqual([])
  })
})
