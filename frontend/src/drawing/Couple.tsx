import { ArrowHead } from './Arrow'
import { formatLabel } from '@/math/format'
import { groupOpacity, MONO, stateColor, stroke, type SymbolProps } from './state'

interface Props extends SymbolProps {
  /** Signed: positive = anticlockwise, negative = clockwise. */
  magnitude: number
  unit?: string
}

const R = 16
const rad = (deg: number) => (deg * Math.PI) / 180
const pt = (deg: number, r = R) => ({ x: r * Math.cos(rad(deg)), y: -r * Math.sin(rad(deg)) })

/** 240° arc with the gap at the bottom, so it never overlaps a support below. */
export function ArcMoment({
  anticlockwise,
  color,
  state,
  r = R,
}: {
  anticlockwise: boolean
  color: string
  state: SymbolProps['state']
  r?: number
}) {
  const a = pt(210, r)
  const b = pt(-30, r)
  const c = stateColor(state ?? 'default', color)
  // head sits at the arc end that the rotation sense runs toward
  const headDeg = anticlockwise ? 210 : -30
  const h = pt(headDeg, r)
  const sgn = anticlockwise ? 1 : -1
  const dx = sgn * -Math.sin(rad(headDeg))
  const dy = sgn * -Math.cos(rad(headDeg))
  return (
    <g>
      <path {...stroke(state ?? 'default', color)} d={`M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y}`} />
      <ArrowHead x={h.x} y={h.y} dx={dx} dy={dy} length={8} width={7} color={c} />
    </g>
  )
}

export function Couple({ x, magnitude, unit = 'kN·m', state = 'default' }: Props) {
  const color = stateColor(state, 'var(--load)')
  return (
    <g transform={`translate(${x},0)`} opacity={groupOpacity(state)}>
      <circle cx={0} cy={0} r={2} fill={color} stroke="none" />
      <ArcMoment anticlockwise={magnitude > 0} color="var(--load)" state={state} />
      <text x={0} y={-R - 6} textAnchor="middle" fontFamily={MONO} fontSize={12} fill={color}>
        {formatLabel(magnitude, unit)}
      </text>
    </g>
  )
}
