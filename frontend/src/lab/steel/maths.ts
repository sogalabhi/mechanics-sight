import { formatNumber } from '@/math/format'
import type { DisplayState, TensionOut } from './types'

/** A titled group of LaTeX lines (rendered with KaTeX). */
export interface MathsBlock {
  title: string
  lines: string[]
}

const n = (v: number, d = 3) => formatNumber(v, { decimals: d }).replace('−', '-')
const s5 = (v: number) => n(v, 5)
/** 2e-7 -> "2\times10^{-7}" */
const sci = (v: number): string => {
  const [m, e] = v.toExponential(3).split('e')
  return `${Number(m)}\\times10^{${Number(e)}}`
}
const tex = String.raw

/** The working behind the numbers on screen, as LaTeX. Every value comes from the backend response. */
export function mathsFor(state: DisplayState, out: TensionOut): MathsBlock[] {
  const p = out.model.parameters
  const E = out.model.young_modulus_gpa * 1000
  const area = out.specimen.area_mm2
  const L0 = out.specimen.gauge_length_mm
  const lm = (id: string) => out.landmarks.find((m) => m.id === id)
  const B = lm('B')
  const C = lm('C')
  const D = lm('D')
  const sigma = state.stress_mpa
  const MPa = String.raw`\ \text{MPa}`

  const piece: string[] = (() => {
    switch (state.region) {
      case 'elastic':
        return [tex`\sigma = E\,\varepsilon = ${n(E, 0)} \times ${s5(state.strain)} = ${n(sigma, 2)}${MPa}`]
      case 'elastic_curving':
        return [
          tex`\varepsilon = \dfrac{\sigma}{E} + \kappa\,(\sigma-\sigma_A)^2,\qquad \kappa = ${sci(p.curving_per_mpa2)}\ \text{MPa}^{-2}`,
          tex`\sigma = ${n(sigma, 2)}${MPa}\quad\text{(recoverable: unloading retraces this curve)}`,
        ]
      case 'yield_onset':
        return B && C
          ? [
              tex`\text{B to C: a straight line from }(${n(B.strain * 100)}\,\%,\ ${n(B.stress_mpa, 0)})\text{ to }(${n(C.strain * 100)}\,\%,\ ${n(C.stress_mpa, 0)})`,
              tex`\sigma = ${n(sigma, 2)}${MPa}`,
            ]
          : [tex`\sigma = ${n(sigma, 2)}${MPa}`]
      case 'yield_drop':
        return C && D
          ? [
              tex`\text{C to D: a straight line from }(${n(C.strain * 100)}\,\%,\ ${n(C.stress_mpa, 0)})\text{ to }(${n(D.strain * 100)}\,\%,\ ${n(D.stress_mpa, 0)})`,
              tex`\sigma = ${n(sigma, 2)}${MPa}`,
            ]
          : [tex`\sigma = ${n(sigma, 2)}${MPa}`]
      case 'yield_plateau':
        return [tex`\text{D to }\varepsilon_{sh}:\quad \sigma = f_y = ${n(p.lower_yield_mpa, 0)}${MPa}`]
      case 'strain_hardening':
        return [
          tex`\sigma = f_u - (f_u-f_y)\left(\dfrac{\varepsilon_u-\varepsilon}{\varepsilon_u-\varepsilon_{sh}}\right)^{2}`,
          tex`\sigma = ${n(p.peak_mpa, 0)} - ${n(p.peak_mpa - p.lower_yield_mpa, 0)}\left(\dfrac{${s5(p.strain_peak)}-${s5(state.strain)}}{${s5(p.strain_peak - p.strain_hardening)}}\right)^{2} = ${n(sigma, 2)}${MPa}`,
        ]
      case 'necking':
        return [
          tex`\sigma = f_u - (f_u-\sigma_f)\left(\dfrac{\varepsilon-\varepsilon_u}{\varepsilon_f-\varepsilon_u}\right)^{2}`,
          tex`\sigma = ${n(p.peak_mpa, 0)} - ${n(p.peak_mpa - p.fracture_mpa, 0)}\left(\dfrac{${s5(state.strain)}-${s5(p.strain_peak)}}{${s5(p.strain_fracture - p.strain_peak)}}\right)^{2} = ${n(sigma, 2)}${MPa}`,
        ]
      case 'unloading':
      case 'reloading':
        return [
          tex`\sigma = E\,(\varepsilon-\varepsilon_p) = ${n(E, 0)}\,(${s5(state.strain)}-${s5(state.plastic_strain)}) = ${n(sigma, 2)}${MPa}`,
          tex`\varepsilon_p = \varepsilon_{\max} - \dfrac{\sigma_{\max}}{E} = ${s5(state.plastic_strain)}`,
        ]
      case 'fractured':
        return [tex`\sigma = 0,\qquad \varepsilon_p = \varepsilon_f - \dfrac{\sigma_f}{E} = ${s5(state.plastic_strain)}`]
    }
  })()

  const proof = out.proof
  return [
    {
      title: 'Definitions',
      lines: [
        tex`\varepsilon = \dfrac{\Delta L}{L_0} = \dfrac{${n(state.extension_mm)}\ \text{mm}}{${n(L0, 0)}\ \text{mm}} = ${s5(state.strain)}`,
        tex`\sigma = \dfrac{F}{A_0} = \dfrac{${n(state.force_kn * 1000, 0)}\ \text{N}}{${n(area)}\ \text{mm}^2} = ${n(sigma, 1)}${MPa}`,
      ],
    },
    { title: 'Curve piece in use', lines: piece },
    { title: 'Force', lines: [tex`F = \sigma A_0 = ${n(sigma, 1)} \times ${n(area)} = ${n(state.force_kn * 1000, 0)}\ \text{N} = ${n(state.force_kn)}\ \text{kN}`] },
    {
      title: 'Proof strength (0.2 % offset)',
      lines: [
        tex`\sigma_{\text{curve}}(\varepsilon) = E\,(\varepsilon - ${n(proof.offset_strain, 3)})`,
        tex`\varepsilon = ${s5(proof.strain)},\qquad \sigma_{0.2} = ${n(proof.stress_mpa, 1)}${MPa}`,
        tex`\varepsilon_p = \varepsilon - \dfrac{\sigma}{E} = ${s5(proof.strain)} - \dfrac{${n(proof.stress_mpa, 1)}}{${n(E, 0)}} = ${n(proof.strain - proof.stress_mpa / E, 5)}`,
      ],
    },
  ]
}
