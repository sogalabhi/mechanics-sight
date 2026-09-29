import { Arrow } from './Arrow'
import { formatLabel } from '@/math/format'
import { groupOpacity, MONO, stateColor, stroke, type SymbolState } from './state'

interface Props {
  /** Start / end in px. */
  xs: number
  xe: number
  /** Signed intensities: negative = downward. */
  w1: number
  w2: number
  /** Largest |w| over all distributed loads on the beam, so heights are comparable. */
  wMax: number
  /** Extra lift in px for lane stacking. */
  lift?: number
  unit?: string
  state?: SymbolState
}

const FACE = -5
const heightOf = (w: number, wMax: number) => (w === 0 || wMax === 0 ? 0 : 10 + (34 * Math.abs(w)) / wMax)

export function DistributedLoad({ xs, xe, w1, w2, wMax, lift = 0, unit = 'kN/m', state = 'default' }: Props) {
  const h1 = heightOf(w1, wMax)
  const h2 = heightOf(w2, wMax)
  const up = (w1 !== 0 ? w1 : w2) > 0
  const color = stateColor(state, 'var(--load)')
  const width = xe - xs
  const n = Math.max(2, Math.round(width / 18) + 1)
  const yTop = (h: number) => FACE - h

  const arrows = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const h = h1 + (h2 - h1) * t
    return { x: xs + width * t, h }
  }).filter((a) => a.h >= 8)

  const uniform = w1 === w2
  const label = (w: number) => formatLabel(w, unit)

  return (
    <g transform={`translate(0,${-lift})`} opacity={groupOpacity(state)}>
      <polygon
        points={`${xs},${FACE} ${xs},${yTop(h1)} ${xe},${yTop(h2)} ${xe},${FACE}`}
        fill="var(--load)"
        fillOpacity={0.08}
        stroke="transparent"
      />
      <line {...stroke(state, 'var(--load)', 1)} x1={xs} y1={FACE} x2={xs} y2={yTop(h1)} />
      <line {...stroke(state, 'var(--load)', 1)} x1={xe} y1={FACE} x2={xe} y2={yTop(h2)} />
      <line {...stroke(state, 'var(--load)', 1.5)} x1={xs} y1={yTop(h1)} x2={xe} y2={yTop(h2)} />
      {arrows.map((a, i) =>
        up ? (
          <Arrow key={i} x1={a.x} y1={FACE} x2={a.x} y2={yTop(a.h)} color="var(--load)" state={state} headLength={6} headWidth={6} width={1} />
        ) : (
          <Arrow key={i} x1={a.x} y1={yTop(a.h)} x2={a.x} y2={FACE} color="var(--load)" state={state} headLength={6} headWidth={6} width={1} />
        ),
      )}
      {state === 'selected' && (
        <>
          <rect x={xs - 4} y={FACE - 4} width={8} height={8} {...stroke('selected', 'var(--select)', 1.5)} fill="var(--paper)" />
          <rect x={xe - 4} y={FACE - 4} width={8} height={8} {...stroke('selected', 'var(--select)', 1.5)} fill="var(--paper)" />
        </>
      )}
      {uniform ? (
        <text x={(xs + xe) / 2} y={yTop(h1) - 5} textAnchor="middle" fontFamily={MONO} fontSize={12} fill={color}>
          {label(w1)}
        </text>
      ) : (
        <>
          {w1 !== 0 && (
            <text x={xs} y={yTop(h1) - 5} textAnchor="middle" fontFamily={MONO} fontSize={12} fill={color}>
              {label(w1)}
            </text>
          )}
          {w2 !== 0 && (
            <text x={xe} y={yTop(h2) - 5} textAnchor="middle" fontFamily={MONO} fontSize={12} fill={color}>
              {label(w2)}
            </text>
          )}
        </>
      )}
    </g>
  )
}

