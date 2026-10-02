import { useWidth } from '@/canvas/useWidth'
import { formatNumber } from '@/math/format'
import styles from './lab.module.css'
import type { DisplayState, TensionOut } from './types'

/** The elastic part of the stretch is drawn this many times too large so it can be seen. */
export const STRETCH_SCALE = 20
const H = 330
const CY = 165
const HALF = 22

const lm = (out: TensionOut, id: string) => out.landmarks.find((m) => m.id === id)

/** Round tension specimen with gauge marks, dimension line, grips, force arrows, a neck and a break. */
export function Specimen({ state, out }: { state: DisplayState; out: TensionOut }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const width = Math.max(300, w)
  const base = Math.max(90, Math.min((width - 330) / 1.36, 240))
  const cx0 = width / 2 - base * 0.18
  const gx0 = cx0 - base / 2
  const broken = state.region === 'fractured'
  const strainF = lm(out, 'F')?.strain ?? 0.25
  const strainE = lm(out, 'E')?.strain ?? 0.15
  const peakForce = ((lm(out, 'E')?.stress_mpa ?? 400) * out.specimen.area_mm2) / 1000
  const drawn = broken ? strainF : state.plastic_strain + STRETCH_SCALE * state.elastic_strain
  const x1 = gx0 + base + drawn * base
  const neck = Math.max(0, Math.min(1, (state.max_strain - strainE) / (strainF - strainE)))
  const half = (t: number) => HALF * (1 - 0.55 * neck * neck * Math.exp(-(((t - 0.5) / 0.11) ** 2)))
  const N = 48
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N
    return { x: gx0 + (x1 - gx0) * t, h: half(t), t }
  })
  const gap = broken ? 22 : 0
  const left = gx0 - 42
  const right = x1 + 42
  const stress = state.stress_mpa
  const F = state.force_kn
  const arrow = Math.min(1, Math.abs(F) / peakForce) * 46

  const outline = (): string => {
    const top = pts.map((p) => `L${p.x} ${CY - p.h}`).join(' ')
    const bottom = [...pts].reverse().map((p) => `L${p.x} ${CY + p.h}`).join(' ')
    return `M${left} ${CY - 38} L${gx0 - 14} ${CY - 38} Q${gx0 - 4} ${CY - 38} ${gx0} ${CY - pts[0].h} ${top} Q${x1 + 4} ${CY - 38} ${x1 + 14} ${CY - 38} L${right} ${CY - 38} L${right} ${CY + 38} L${x1 + 14} ${CY + 38} Q${x1 + 4} ${CY + 38} ${x1} ${CY + pts[N].h} ${bottom} Q${gx0 - 4} ${CY + 38} ${gx0 - 14} ${CY + 38} L${left} ${CY + 38} Z`
  }
  const half1 = (right_: boolean): string => {
    const sel = pts.filter((p) => (right_ ? p.t >= 0.5 : p.t <= 0.5))
    const dx = right_ ? gap / 2 : -gap / 2
    const top = sel.map((p) => `L${p.x + dx} ${CY - p.h}`).join(' ')
    const bottom = [...sel].reverse().map((p) => `L${p.x + dx} ${CY + p.h}`).join(' ')
    return right_
      ? `M${right + gap / 2} ${CY - 38} L${x1 + 14 + gap / 2} ${CY - 38} ${top} ${bottom} L${x1 + 14 + gap / 2} ${CY + 38} L${right + gap / 2} ${CY + 38} Z`
      : `M${left - gap / 2} ${CY - 38} L${gx0 - 14} ${CY - 38} ${top} ${bottom} L${gx0 - 14} ${CY + 38} L${left - gap / 2} ${CY + 38} Z`
  }
  const dim = CY + 62
  const body = stress > 1e-9 ? 'var(--tension-fill)' : 'var(--panel)'

  return (
    <div ref={ref} className={styles.specimen}>
      <svg viewBox={`0 0 ${width} ${H}`} height={H} role="img" aria-label="Tension specimen with gauge marks">
        <rect x={gx0 - 56} y={CY - 38} width={base + 112} height={76} fill="none" stroke="var(--ink-2)" strokeDasharray="4 3" opacity={0.6} />
        <text x={gx0 - 56} y={CY - 44} fontSize={10} fill="var(--ink-2)">undeformed outline</text>
        <rect x={gx0 - 72 - gap / 2} y={CY - 46} width={30} height={92} fill="var(--grid)" stroke="var(--ink)" strokeWidth={1.4} />
        <rect x={x1 + 42 + gap / 2} y={CY - 46} width={30} height={92} fill="var(--grid)" stroke="var(--ink)" strokeWidth={1.4} />
        {broken ? (
          <>
            <path d={half1(false)} fill="var(--plastic-fill)" stroke="var(--ink)" strokeWidth={1.6} strokeLinejoin="round" />
            <path d={half1(true)} fill="var(--plastic-fill)" stroke="var(--ink)" strokeWidth={1.6} strokeLinejoin="round" />
            <text x={(gx0 + x1) / 2} y={CY - 52} fontSize={12} fontWeight={600} fill="var(--compression)" textAnchor="middle">Fractured</text>
          </>
        ) : (
          <>
            <path d={outline()} fill={body} stroke="var(--ink)" strokeWidth={1.6} strokeLinejoin="round" />
            {state.plastic_strain > 1e-9 && (
              <path d={`M${pts.map((p) => `${p.x} ${CY - p.h}`).join(' L')} L${[...pts].reverse().map((p) => `${p.x} ${CY + p.h}`).join(' L')} Z`} fill="var(--plastic-fill)" stroke="none" />
            )}
            {Array.from({ length: 11 }, (_, g) => {
              const t = g / 10
              const x = gx0 + (x1 - gx0) * t
              return <line key={g} x1={x} x2={x} y1={CY - half(t)} y2={CY + half(t)} stroke="var(--ink-2)" strokeWidth={g % 5 === 0 ? 1.2 : 0.6} opacity={0.7} />
            })}
            <line x1={gx0} x2={x1} y1={dim} y2={dim} stroke="var(--ink-2)" />
            {[gx0, x1].map((d) => (
              <g key={d}>
                <line x1={d - 4} x2={d + 4} y1={dim + 4} y2={dim - 4} stroke="var(--ink-2)" strokeWidth={1.2} />
                <line x1={d} x2={d} y1={CY + 40} y2={dim + 5} stroke="var(--ink-2)" strokeWidth={0.8} strokeDasharray="2 2" />
              </g>
            ))}
            <text x={(gx0 + x1) / 2} y={dim - 6} className="num" fontSize={11} fill="var(--ink)" textAnchor="middle">
              L = {formatNumber(out.specimen.gauge_length_mm * (1 + state.strain), { decimals: 2 })} mm (L₀ = {formatNumber(out.specimen.gauge_length_mm, { decimals: 0 })})
            </text>
          </>
        )}
        {arrow > 1 && !broken && (
          <>
            {[
              [left - 40, -1],
              [right + 40, 1],
            ].map(([x0, dir]) => (
              <g key={x0} stroke="var(--tension)" strokeWidth={2.4} fill="none">
                <line x1={x0} x2={x0 + dir * arrow} y1={CY} y2={CY} />
                <path d={`M${x0 + dir * arrow - dir * 7} ${CY - 5} L${x0 + dir * arrow} ${CY} L${x0 + dir * arrow - dir * 7} ${CY + 5}`} />
              </g>
            ))}
            <text x={cx0} y={CY - 54} className="num" fontSize={12} fill="var(--tension)" textAnchor="middle">F = {formatNumber(F)} kN</text>
          </>
        )}
        {neck > 0 && !broken && <text x={cx0} y={H - 30} fontSize={10} fill="var(--ink-2)" textAnchor="middle">neck shape is schematic</text>}
        {state.plastic_strain > 1e-9 && !broken && (
          <text x={cx0} y={H - 14} className="num" fontSize={11} fill="var(--plastic)" textAnchor="middle">tinted: permanent set ε_p = {formatNumber(state.plastic_strain * 100)} %</text>
        )}
      </svg>
    </div>
  )
}
