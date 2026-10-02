import type { Region } from './types'

export type Tone = 'elastic' | 'plastic' | 'unload'

/** Short explanation per region. Mechanics live on the backend; this is the teaching text. */
export const REGION_TEXT: Record<Region, { title: string; tone: Tone; text: string }> = {
  elastic: {
    title: 'Elastic (straight line)',
    tone: 'elastic',
    text: 'Stress is proportional to strain, σ = E·ε. Remove the load and the bar returns to its original length.',
  },
  elastic_curving: {
    title: 'Elastic, curving (A to B)',
    tone: 'elastic',
    text: 'The line has started to bend, but the bar still recovers fully when unloaded. This is the zone between the proportional limit and the elastic limit.',
  },
  yield_onset: {
    title: 'Yielding starts (B to C)',
    tone: 'plastic',
    text: 'Past the elastic limit some strain is permanent. The stress keeps rising towards the upper yield point.',
  },
  yield_drop: {
    title: 'Yield drop (C to D)',
    tone: 'plastic',
    text: 'The stress falls from the upper to the lower yield point as the pinned atomic planes break free.',
  },
  yield_plateau: {
    title: 'Yield plateau',
    tone: 'plastic',
    text: 'The steel stretches at an almost constant lower-yield stress, and most of the strain is permanent.',
  },
  strain_hardening: {
    title: 'Strain hardening (D to E)',
    tone: 'plastic',
    text: 'The steel now needs more stress for more strain. The curve rises towards the peak, the ultimate tensile strength.',
  },
  necking: {
    title: 'Necking (E to F)',
    tone: 'plastic',
    text: 'Past the peak, deformation concentrates in a neck. Engineering stress (force over the original area) falls, because the real area at the neck is shrinking.',
  },
  unloading: {
    title: 'Unloading',
    tone: 'unload',
    text: 'The path is a straight line parallel to the first elastic line. Only the elastic part is recovered. The permanent strain stays.',
  },
  reloading: {
    title: 'Reloading',
    tone: 'unload',
    text: 'Reloading follows the same elastic line up to the stress you reached before, then rejoins the original curve.',
  },
  fractured: {
    title: 'Fractured (F)',
    tone: 'plastic',
    text: 'The specimen has broken. The test has ended. Reset starts a fresh specimen.',
  },
}

/** What each lettered point means. */
export const LANDMARK_TEXT: Record<string, { title: string; text: string }> = {
  A: {
    title: 'Proportional limit',
    text: 'The end of the strictly straight line. Up to here σ = E·ε (Hooke’s law) and the slope is Young’s modulus E.',
  },
  B: {
    title: 'Elastic limit',
    text: 'The largest stress that is still fully recoverable. Release the load before B and the bar returns exactly to its original length.',
  },
  C: {
    title: 'Upper yield point',
    text: 'The crystal structure first breaks away from its pinned state and plastic flow starts. The load peaks, then drops.',
  },
  D: {
    title: 'Lower yield point',
    text: 'The stress settles at the lower yield level, the value used as the yield strength in design. The bar now stretches with almost no rise in load.',
  },
  E: {
    title: 'Ultimate tensile strength',
    text: 'The highest engineering stress the steel reaches. After strain hardening the curve peaks here, and necking begins.',
  },
  F: {
    title: 'Fracture',
    text: 'The neck can no longer carry load and the bar breaks. The test ends.',
  },
}

export const LANDMARK_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'] as const
