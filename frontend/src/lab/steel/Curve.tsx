import { useWidth } from '@/canvas/useWidth'
import { formatNumber } from '@/math/format'
import styles from './lab.module.css'
import { useLab } from './store'
import type { DisplayState, TensionOut, TracePoint } from './types'

const H = 346
const L = 56
const R = 18
const T = 56
const B = 56

/** The reference trace without its final drop after the break: loading only. */
const loadingPath = (trace: TracePoint[]): TracePoint[] =>
  trace[trace.length - 1]?.region === 'fractured' ? trace.slice(0, -1) : trace

/**
 * Engineering stress against strain: the faint full material curve, the path taken so far, the
 * lettered points A to F, the permanent strain, and the current point. `zoom` shows the elastic range.
 */
export function Curve({ state, out, reference, zoom, proof }: { state: DisplayState; out: TensionOut; reference: TensionOut | null; zoom: boolean; proof: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const playing = useLab((s) => s.playing)
  const width = Math.max(320, w)
  const marks = out.landmarks
  const lm = (id: string) => marks.find((m) => m.id === id)
  const D = lm('D')
  const C = lm('C')
  const E = lm('E')
  const F = lm('F')
  const xmax = zoom ? Math.max((D?.strain ?? 0.0016) * 1.25, proof ? out.proof.strain * 1.25 : 0) : (F?.strain ?? 0.25) * 1.04
  const ymax = zoom ? Math.ceil(((C?.stress_mpa ?? 265) * 1.1) / 50) * 50 : (E?.stress_mpa ?? 400) * 1.125
  const ystep = zoom ? 50 : 100
  const X = (e: number) => L + ((width - L - R) * e) / xmax
  const Y = (s: number) => T + ((H - T - B) * (ymax - s)) / ymax
  const path = (pts: { strain: number; stress_mpa: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.strain).toFixed(1)} ${Y(p.stress_mpa).toFixed(1)}`).join(' ')
  const ghost = reference ? loadingPath(reference.trace) : []
  // while playing, the path so far is the reference up to the current strain; otherwise the history's path
  const travelled = playing && reference ? [...ghost.filter((p) => p.strain < state.strain), { strain: state.strain, stress_mpa: state.stress_mpa }] : out.trace
  const yTicks = Array.from({ length: Math.floor(ymax / ystep) + 1 }, (_, i) => i * ystep).filter((v) => v <= ymax)
  const tickStep = zoom ? (xmax > 0.0025 ? 0.001 : 0.0005) : 0.05
  const xTicks = Array.from({ length: Math.floor(xmax / tickStep + 1e-9) + 1 }, (_, i) => i * tickStep)
  const broken = state.region === 'fractured'
  // after the break the specimen is unloaded: the current point sits at the permanent strain, on zero stress
  const at = broken ? state.plastic_strain : state.strain
  const cx = X(Math.min(at, xmax))
  const cy = Y(state.stress_mpa)
  const permanent = state.plastic_strain
  const dot = zoom && at > xmax

  return (
    <div ref={ref} className={styles.curve}>
      <svg viewBox={`0 0 ${width} ${H}`} height={H} role="img" aria-label="Engineering stress–strain curve with the current point">
        <defs>
          <clipPath id="plot"><rect x={L} y={T} width={width - L - R} height={H - T - B} /></clipPath>
        </defs>
        <line x1={L} x2={width - R} y1={Y(0)} y2={Y(0)} stroke="var(--ink)" strokeWidth={1.2} />
        <line x1={L} x2={L} y1={T} y2={Y(0)} stroke="var(--ink)" strokeWidth={1.2} />
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={width - R} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" />
            <text x={L - 6} y={Y(v) + 4} className="num" fontSize={10} fill="var(--ink-2)" textAnchor="end">{v}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1={Y(0)} y2={Y(0) + 4} stroke="var(--ink)" />
            <text x={X(v)} y={Y(0) + 17} className="num" fontSize={10} fill="var(--ink-2)" textAnchor="middle">{(v * 100).toFixed(zoom ? 2 : 0)}</text>
          </g>
        ))}
        <text x={width - R} y={H - 6} className="num" fontSize={11} fill="var(--ink-2)" textAnchor="end">engineering strain ε (%)</text>
        <text x={L + 4} y={T - 10} className="num" fontSize={11} fill="var(--ink-2)">engineering stress σ (MPa)</text>
        <g clipPath="url(#plot)">
          {ghost.length > 0 && <path d={path(ghost)} fill="none" stroke="var(--ink-2)" strokeWidth={1.2} strokeDasharray="2 3" opacity={0.55} />}
          <path d={path(travelled)} fill="none" stroke="var(--ink)" strokeWidth={2.2} strokeLinejoin="round" />
          {proof && (
            <line
              x1={X(out.proof.offset_strain)}
              y1={Y(0)}
              x2={X(Math.min(xmax, out.proof.offset_strain + ymax / (out.model.young_modulus_gpa * 1000)))}
              y2={Y(Math.min(ymax, (out.model.young_modulus_gpa * 1000) * (xmax - out.proof.offset_strain)))}
              stroke="var(--ok)"
              strokeWidth={1.6}
              strokeDasharray="6 3"
            />
          )}
        </g>
        {marks.filter((m) => m.strain <= xmax).map((m, i) => {
          const cluster = !zoom && i < 4
          if (cluster && i > 0) return <circle key={m.id} cx={X(m.strain)} cy={Y(m.stress_mpa)} r={2.5} fill="var(--panel)" stroke="var(--plastic)" strokeWidth={1.5} />
          return (
            <g key={m.id}>
              <circle cx={X(m.strain)} cy={Y(m.stress_mpa)} r={cluster ? 2.5 : 4.5} fill="var(--panel)" stroke="var(--plastic)" strokeWidth={2} />
              <text x={X(m.strain) + (cluster ? 6 : 0)} y={Y(m.stress_mpa) - 10} className="num" fontSize={11} fontWeight={600} fill="var(--plastic)" textAnchor={m.id === 'F' ? 'end' : cluster ? 'start' : 'middle'}>
                {cluster ? 'A–D' : m.id}
              </text>
            </g>
          )
        })}
        {zoom && <text x={X(xmax * 0.3)} y={Y(ymax * 0.27)} className="num" fontSize={10} fill="var(--tension)">slope = E = {formatNumber(out.model.young_modulus_gpa, { decimals: 0 })} GPa</text>}
        {proof && (
          <g>
            <line x1={X(out.proof.strain)} x2={X(out.proof.strain)} y1={Y(out.proof.stress_mpa)} y2={Y(0)} stroke="var(--ok)" strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={X(out.proof.strain)} cy={Y(out.proof.stress_mpa)} r={4.5} fill="var(--ok)" stroke="var(--panel)" strokeWidth={1.5} />
            <text x={X(out.proof.strain) + 8} y={Y(out.proof.stress_mpa) + 16} className="num" fontSize={11} fontWeight={600} fill="var(--ok)">
              σ<tspan baselineShift="sub" fontSize={8}>0.2</tspan> = {formatNumber(out.proof.stress_mpa, { decimals: 0 })} MPa
            </text>
            <text x={X(out.proof.offset_strain)} y={Y(0) - 8} className="num" fontSize={10} fill="var(--ok)" textAnchor="end">offset {formatNumber(out.proof.offset_strain * 100, { decimals: 1 })} %</text>
          </g>
        )}
        {permanent > 1e-9 && permanent <= xmax && (
          <g>
            <circle cx={X(permanent)} cy={Y(0)} r={4} fill="var(--plastic)" />
            <text x={X(permanent)} y={Y(0) + 31} className="num" fontSize={10} fill="var(--plastic)" textAnchor="middle">ε_p = {formatNumber(permanent * 100)}</text>
          </g>
        )}
        {!dot ? (
          <g>
            <line x1={cx} x2={cx} y1={Y(0)} y2={cy} stroke="var(--select)" strokeDasharray="3 3" />
            <circle cx={cx} cy={cy} r={6} fill="var(--select)" stroke="var(--panel)" strokeWidth={2} />
          </g>
        ) : (
          <text x={L + 8} y={Y(0) - 12} className="num" fontSize={11} fill="var(--select)">current point is beyond this zoom →</text>
        )}
        {broken && <title>fractured</title>}
      </svg>
    </div>
  )
}
