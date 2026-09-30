import { Arrow } from './Arrow'
import { ArcMoment } from './Couple'
import { formatLabel } from '@/math/format'
import { MONO } from './state'

interface VProps {
  x: number
  /** Signed: positive = upward. */
  value: number
  unit?: string
}

/** Vertical reaction, drawn below the support hatching. */
export function ReactionForce({ x, value, unit = 'kN' }: VProps) {
  const up = value > 0
  return (
    <g transform={`translate(${x},0)`}>
      {up ? (
        <Arrow x1={0} y1={70} x2={0} y2={34} color="var(--reaction)" />
      ) : (
        <Arrow x1={0} y1={34} x2={0} y2={70} color="var(--reaction)" />
      )}
      <text x={8} y={56} fontFamily={MONO} fontSize={12} fill="var(--reaction)">
        {formatLabel(value, unit)}
      </text>
    </g>
  )
}

interface MProps {
  x: number
  /** Signed: positive = anticlockwise. */
  value: number
  unit?: string
}

/** Moment reaction at a fixed support, centred on the support's position. */
export function ReactionMoment({ x, value, unit = 'kN·m' }: MProps) {
  return (
    <g transform={`translate(${x},0)`}>
      <ArcMoment anticlockwise={value > 0} color="var(--reaction)" state="default" r={18} />
      <text x={0} y={-26} textAnchor="middle" fontFamily={MONO} fontSize={12} fill="var(--reaction)">
        {formatLabel(value, unit)}
      </text>
    </g>
  )
}
