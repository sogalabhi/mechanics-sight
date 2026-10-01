import type { BeamInput } from './types'

const LABELS: Record<string, string> = {
  '01_ss_central_point': 'Simply supported, central point load',
  '02_ss_full_udl': 'Simply supported, full-span UDL',
  '03_cantilever_left_udl': 'Cantilever (left), UDL',
  '04_cantilever_right_point': 'Cantilever (right), point load',
  '05_overhang_point': 'Overhanging beam, point load',
  '06_ss_clockwise_couple': 'Simply supported, clockwise couple',
  '07_ss_triangular': 'Simply supported, triangular load',
  '08_ss_partial_udl': 'Simply supported, partial UDL',
  '09_load_on_support': 'Point load on a support',
  '10_cantilever_couple_free_end': 'Cantilever, couple at free end',
  '11_no_loads': 'Simply supported, no loads',
  '12_pin_pin': 'Pin–pin (axial degree 1)',
  '13_gerber_beam': 'Gerber beam (internal hinge, M = 0)',
  '14_ss_inclined': 'Simply supported, inclined load',
  '15_cantilever_compression': 'Cantilever, axial compression',
  '16_axial_tension_compression': 'Axial tension and compression',
  '17_propped_cantilever_udl': 'Propped cantilever, UDL (degree 1)',
  '18_fixed_fixed_udl': 'Fixed–fixed, UDL (degree 2)',
  '19_continuous_two_span': 'Continuous beam, 2 spans UDL (degree 1)',
  '20_fixed_fixed_point_load': 'Fixed–fixed, point load (degree 2)',
}

const files = import.meta.glob('../../../shared/fixtures/*.json', { eager: true }) as Record<
  string,
  { default: { name: string; input: BeamInput } }
>

export const EXAMPLES = Object.values(files)
  .map((m) => ({
    key: m.default.name,
    label: LABELS[m.default.name] ?? m.default.name,
    beam: m.default.input,
  }))
  .sort((a, b) => a.key.localeCompare(b.key))

