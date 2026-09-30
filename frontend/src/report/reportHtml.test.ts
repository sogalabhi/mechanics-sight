import { describe, expect, it } from 'vitest'
import type { AnalysisResult, BeamInput } from '@/model/types'
import { formatQty } from '@/math/format'
import { buildReportHtml, esc } from './reportHtml'

const fixtures = import.meta.glob('../../../shared/fixtures/01_ss_central_point.json', { eager: true }) as Record<
  string,
  { default: { input: BeamInput; output: AnalysisResult } }
>
const { input, output } = Object.values(fixtures)[0].default

const html = buildReportHtml({
  beam: input,
  result: output,
  steps: [
    { kind: 'force_balance', group: 'reactions', title: 'Vertical <equilibrium>', symbolic: 'R_A + R_B = 10', notes: ['A: pin'] },
    { kind: 'shear', group: 'diagrams', title: 'Shear', result: 'V(x) = 5' },
  ],
  figures: { beam: '<svg id="b"></svg>', sfd: '<svg id="s"></svg>', bmd: '<svg id="m"></svg>' },
  date: '2026-09-30',
})

describe('report html', () => {
  it('has every section and the three figures', () => {
    for (const t of ['Input beam', 'Results', 'Shear force diagram', 'Bending moment diagram', 'Calculation steps']) {
      expect(html).toContain(t)
    }
    for (const id of ['b', 's', 'm']) expect(html).toContain(`<svg id="${id}">`)
  })
  it('lists critical point values and reactions', () => {
    expect(html).toContain('Values at critical points')
    expect(html).toContain('+15.000')
    expect(html).toContain('<td>A</td>')
  })
  it('renders math as MathML and escapes titles', () => {
    expect(html).toContain('<math')
    expect(html).toContain('Vertical &lt;equilibrium&gt;')
  })
  it('is standalone: light tokens inlined, beam embedded, no external links', () => {
    expect(html).toContain('--ink:')
    expect(html).toContain('id="beam-input"')
    expect(html).not.toMatch(/<link |src="http/)
    expect(esc('a<b')).toBe('a&lt;b')
  })
})

it('includes axial input, extremes, exact values and AFD in reports', () => {
  const report = buildReportHtml({
    beam: { ...input, loads: [{ id: 'p', type: 'point', position: 3, magnitude: -10, fx: 6 }] },
    result: { ...output, extremes: { ...output.extremes, max_tension: { x: 0, value: 6 } } },
    steps: [],
    figures: { beam: '', afd: '<svg id="axial"></svg>', sfd: '', bmd: '' },
    date: '2026-09-30',
  })
  expect(report).toContain('Axial force diagram')
  expect(report).toContain('id="axial"')
  expect(report).toContain(`Fx = ${formatQty(6, 'kN')} right`)
  expect(report).toContain('Max tension')
  expect(report).toContain('N left (kN)')
})
