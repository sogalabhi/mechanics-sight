import katex from 'katex'
import tokens from '@/styles/tokens.css?raw'
import type { components } from '@/api/schema'
import { formatNumber, formatQty } from '@/math/format'
import type { AnalysisResult, BeamInput } from '@/model/types'

type Step = components['schemas']['StepOut']

export interface ReportInput {
  beam: BeamInput
  result: AnalysisResult
  steps: Step[]
  /** Serialized <svg> markup. */
  figures: { beam: string; afd?: string; sfd: string; bmd: string; deflection?: string }
  date: string
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const math = (tex: string) => katex.renderToString(tex, { throwOnError: false, output: 'mathml' })

/** The light-theme token block, so inlined SVG (which uses var(--ink) etc.) renders standalone. */
const lightTokens = () => tokens.match(/:root\s*\{[^}]*\}/)?.[0] ?? ':root{}'

const letters = (beam: BeamInput) =>
  new Map([...beam.supports].sort((a, b) => a.position - b.position).map((s, i) => [s.id, String.fromCharCode(65 + i)]))

function inputTables(beam: BeamInput): string {
  const name = letters(beam)
  const sup = [...beam.supports]
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const extras: string[] = []
      if (s.settlement) extras.push(`settlement ${formatNumber(s.settlement * 1000)} mm`)
      if (s.spring_ky) extras.push(`spring ky ${s.spring_ky} kN/m`)
      if (s.spring_ktheta) extras.push(`spring kθ ${s.spring_ktheta} kN·m/rad`)
      const typeStr = extras.length ? `${s.type} (${extras.join(', ')})` : s.type
      return `<tr><td>${name.get(s.id)}</td><td>${typeStr}</td><td class="n">${formatQty(s.position, 'm')}</td></tr>`
    })
    .join('')
  const loads = (beam.loads ?? [])
    .map((l) => {
      if (l.type === 'point')
        return `<tr><td>Point load</td><td class="n">${formatQty(Math.abs(l.magnitude), 'kN')} ${l.magnitude < 0 ? 'down' : 'up'}${l.fx ? `; Fx = ${formatQty(Math.abs(l.fx), 'kN')} ${l.fx < 0 ? 'left' : 'right'}` : ''}</td><td class="n">at ${formatQty(l.position, 'm')}</td></tr>`
      if (l.type === 'moment')
        return `<tr><td>Couple</td><td class="n">${formatQty(Math.abs(l.magnitude), 'kN·m')} ${l.magnitude > 0 ? 'anticlockwise' : 'clockwise'}</td><td class="n">at ${formatQty(l.position, 'm')}</td></tr>`
      const w = l.w_start === l.w_end ? formatQty(Math.abs(l.w_start), 'kN/m') : `${formatNumber(Math.abs(l.w_start))} to ${formatQty(Math.abs(l.w_end), 'kN/m')}`
      const dir = (l.w_start || l.w_end) < 0 ? 'down' : 'up'
      return `<tr><td>Distributed load</td><td class="n">${w} ${dir}</td><td class="n">${formatQty(l.start, 'm')} to ${formatQty(l.end, 'm')}</td></tr>`
    })
  const hingeRows = (beam.hinges ?? [])
    .map((h, i) => `<tr><td>H<sub>${i + 1}</sub></td><td>Internal hinge (M = 0)</td><td class="n">${formatQty(h, 'm')}</td></tr>`)
    .join('')
  const formatSectionText = (s: any) => {
    if (!s) return ''
    if (s.type === 'rectangle') return `${s.wall_thickness == null ? 'Solid' : 'Hollow'} rectangle, ${s.width} × ${s.height} m`
    if (s.type === 'circle') return `${s.wall_thickness == null ? 'Solid circle' : 'Pipe'}, D = ${s.diameter} m`
    if (s.type === 'i') return `I-section, h ${s.height} m, bf ${s.flange_width} m, tf ${s.flange_thickness} m, tw ${s.web_thickness} m`
    return `T-section, bf ${s.flange_width} m, tf ${s.flange_thickness} m, dw ${s.web_depth} m, tw ${s.web_thickness} m`
  }
  const sectionText = formatSectionText(beam.section)
  const material = beam.material
    ? `<table><caption>Material and section</caption><tr><th>Young's modulus</th><td class="n">${formatQty(beam.material.young_modulus_gpa, 'GPa')}</td></tr><tr><th>Yield strength</th><td class="n">${formatQty(beam.material.yield_strength_mpa, 'MPa')}</td></tr><tr><th>Section</th><td>${sectionText}</td></tr></table>`
    : ''
  const spansTable = (beam.spans && beam.spans.length > 0)
    ? `<table><caption>Stepped property spans</caption><tr><th>Span</th><th>Range</th><th>E (GPa)</th><th>Yield (MPa)</th><th>Section</th></tr>${beam.spans.map((sp, idx) => `<tr><td>${idx + 1}</td><td class="n">${formatQty(sp.x_start, 'm')} to ${formatQty(sp.x_end, 'm')}</td><td class="n">${formatNumber(sp.material.young_modulus_gpa)}</td><td class="n">${formatNumber(sp.material.yield_strength_mpa)}</td><td>${formatSectionText(sp.section)}</td></tr>`).join('')}</table>`
    : ''
  return `<div class="two"><table><caption>Supports & Releases</caption><tr><th>Label</th><th>Type</th><th>Position</th></tr>${sup}${hingeRows}</table>
<table><caption>Loads</caption><tr><th>Kind</th><th>Magnitude</th><th>Where</th></tr>${loads || '<tr><td colspan="3">None</td></tr>'}</table></div>${material ? `<div class="two">${material}</div>` : ''}${spansTable ? `<div class="two">${spansTable}</div>` : ''}`
}

function results(result: AnalysisResult, beam: BeamInput): string {
  const name = letters(beam)
  const f = (v: number) => formatNumber(v, { sign: true })
  const react = result.reactions
    .map((r) => `<tr><td>${name.get(r.support_id) ?? r.support_id}</td><td class="n">${f(r.fx)}</td><td class="n">${f(r.fy)}</td><td class="n">${f(r.moment)}</td></tr>`)
    .join('')
  const cps = result.critical_points
    .map((p) => `<tr><td class="n">${formatNumber(p.x)}</td><td class="n">${f(p.axial_left ?? 0)}</td><td class="n">${f(p.axial_right ?? 0)}</td><td class="n">${f(p.shear_left)}</td><td class="n">${f(p.shear_right)}</td><td class="n">${f(p.moment_left)}</td><td class="n">${f(p.moment_right)}</td></tr>`)
    .join('')
  const ex = result.extremes
  const row = (label: string, e: { x: number; value: number } | null, unit: string) =>
    e ? `<tr><td>${label}</td><td class="n">${f(e.value)} ${unit}</td><td class="n">at ${formatQty(e.x, 'm')}</td></tr>` : ''
  const physical = result.deflection
    ? `<table><caption>Physical deflection, upward positive</caption>${row('Maximum upward', result.deflection.max_upward ? { ...result.deflection.max_upward, value: result.deflection.max_upward.value * 1000 } : null, 'mm')}${row('Maximum downward', result.deflection.max_downward ? { ...result.deflection.max_downward, value: result.deflection.max_downward.value * 1000 } : null, 'mm')}${row('Maximum absolute deflection', { ...result.deflection.max_absolute, value: result.deflection.max_absolute.value * 1000 }, 'mm')}</table>`
    : ''
  const bendingStressRows = result.bending_stress
    ? `${row('Max bending tension (σ)', result.bending_stress.max_tension ? { ...result.bending_stress.max_tension, value: result.bending_stress.max_tension.value / 1000 } : null, 'MPa')}${row('Max bending compression (σ)', result.bending_stress.max_compression ? { ...result.bending_stress.max_compression, value: result.bending_stress.max_compression.value / 1000 } : null, 'MPa')}<tr><td>Yield check</td><td class="n">${result.bending_stress.yield_exceeded ? 'Yield exceeded' : 'Within elastic limit'}</td><td class="n">ratio ${(result.bending_stress.yield_ratio * 100).toFixed(1)}%</td></tr>`
    : ''
  const shearStressRows = result.shear_stress?.max_shear_stress
    ? `${row('Max transverse shear (τ)', { ...result.shear_stress.max_shear_stress, value: result.shear_stress.max_shear_stress.value / 1000 }, 'MPa')}`
    : ''
  const stressTable = (bendingStressRows || shearStressRows)
    ? `<table><caption>Stresses (extreme fibres & transverse shear)</caption>${bendingStressRows}${shearStressRows}</table>`
    : ''
  return `<div class="two"><table><caption>Reactions (kN, kN·m)</caption><tr><th></th><th>Fx</th><th>Fy</th><th>M</th></tr>${react}</table>
<table><caption>Extreme values</caption>${row('Max tension', ex.max_tension ?? null, 'kN')}${row('Max compression', ex.max_compression ?? null, 'kN')}${row('Max sagging moment', ex.max_sagging, 'kN·m')}${row('Max hogging moment', ex.max_hogging, 'kN·m')}${row('Max positive shear', ex.max_positive_shear, 'kN')}${row('Max negative shear', ex.max_negative_shear, 'kN')}</table></div>
${physical ? `<div class="two">${physical}</div>` : ''}${stressTable ? `<div class="two">${stressTable}</div>` : ''}<table class="wide"><caption>Values at critical points (just left and right of each point)</caption><tr><th>x (m)</th><th>N left (kN)</th><th>N right (kN)</th><th>V left (kN)</th><th>V right (kN)</th><th>M left (kN·m)</th><th>M right (kN·m)</th></tr>${cps}</table>`
}

const GROUPS: [Step['group'], string][] = [
  ['reactions', 'Reactions'],
  ['diagrams', 'Axial force, shear force and bending moment'],
  ['extremes', 'Extreme values'],
  ['physical', 'Slope and physical deflection'],
]

function stepsHtml(steps: Step[]): string {
  return GROUPS.map(([g, title]) => {
    const list = steps.filter((s) => s.group === g)
    if (!list.length) return ''
    const items = list
      .map(
        (s) => `<li class="step"><h4>${esc(s.title)}</h4>
${(s.notes ?? []).map((n) => `<p class="note">${esc(n)}</p>`).join('')}
${s.symbolic ? `<div class="eq">${math(s.symbolic)}</div>` : ''}
${s.substituted ? `<div class="eq">${math(s.substituted)}</div>` : ''}
${s.result ? `<div class="eq res">${math(s.result)}</div>` : ''}</li>`,
      )
      .join('')
    return `<h3>${title}</h3><ol class="steps">${items}</ol>`
  }).join('')
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:13px/1.45 var(--font-ui)}
main{max-width:940px;margin:0 auto;padding:24px 20px 48px}
h1{margin:0 0 4px;font-size:20px;font-weight:600}
h2{margin:28px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--rule);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
h3{margin:16px 0 4px;font-size:13px}
h4{margin:0 0 2px;font-size:13px}
.meta{color:var(--ink-2)}
svg{display:block;width:100%;height:auto;border:1px solid var(--rule);margin-bottom:8px;background:var(--paper);break-inside:avoid}
table{border-collapse:collapse;margin:8px 0}
caption{padding-bottom:4px;text-align:left;color:var(--ink-2)}
th,td{padding:3px 12px 3px 0;text-align:left;border-bottom:1px solid var(--grid)}
th{font-weight:400;color:var(--ink-2)}
.n{font-family:var(--font-mono);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.two{display:flex;flex-wrap:wrap;gap:8px 40px}
.wide{width:100%}
.steps{margin:0;padding:0;list-style:none}
.step{padding:8px 0;border-top:1px solid var(--grid);break-inside:avoid}
.note{margin:2px 0;color:var(--ink-2)}
.eq{margin:4px 0;overflow-x:auto}
.res{font-weight:500}
math{font-size:1.05em}
footer{margin-top:32px;color:var(--ink-2);font-size:12px}
@page{margin:14mm}
@media print{body{background:#fff}main{padding:0}}
`

const METHOD_LABELS: Record<string, string> = {
  force_method: 'Force Method (Consistent Deformations)',
  slope_deflection: 'Slope-Deflection Method',
  moment_distribution: 'Moment Distribution Method (Hardy Cross)',
  three_moment: 'Theorem of Three Moments (Clapeyron)',
  direct_stiffness: 'Direct Stiffness Method (1D FEM)',
}

export function buildReportHtml(r: ReportInput): string {
  const cls = r.result.classification
  const status =
    cls.status === 'determinate'
      ? 'Statically determinate'
      : cls.bending_degree > 0 && cls.axial_degree > 0
        ? `Statically indeterminate, degree ${cls.degree} (${cls.bending_degree} bending, ${cls.axial_degree} axial)`
        : cls.bending_degree > 0
          ? `Statically indeterminate, degree ${cls.bending_degree} (bending)`
          : `Statically indeterminate, degree ${cls.axial_degree} (axial)`
  const methodTitle = r.result.selected_method
    ? ` — ${METHOD_LABELS[r.result.selected_method] ?? r.result.selected_method}`
    : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Beam report</title>
<style>${lightTokens()}${CSS}</style></head>
<body><main>
<h1>Beam report</h1>
<p class="meta">Mechanics Sight · ${esc(r.date)} · length ${formatQty(r.beam.length, 'm')} · ${status}</p>

<h2>Input beam</h2>
${r.figures.beam}
${inputTables(r.beam)}

<h2>Results</h2>
${results(r.result, r.beam)}

${r.figures.afd ? `<h2>Axial force diagram</h2>${r.figures.afd}` : ''}
${r.figures.deflection ? `<h2>Physical deflection shape</h2>${r.figures.deflection}<p class="meta">Shape is exaggerated for visibility; values are physical and shown in mm.</p>` : ''}
<h2>Shear force diagram</h2>
${r.figures.sfd}
<h2>Bending moment diagram</h2>
${r.figures.bmd}

<h2>Calculation steps${methodTitle}</h2>
${stepsHtml(r.steps)}

<footer>Sign convention: forces and w upward +, couples anticlockwise +, V(x) = sum of vertical forces left of the cut, M(x) sagging +, Fx rightward +, N(x) tension +. Units: m, kN, kN·m, kN/m.</footer>
</main>
<script type="application/json" id="beam-input">${esc(JSON.stringify(r.beam))}</script>
</body></html>`
}
