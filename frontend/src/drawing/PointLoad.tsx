import { Arrow } from './Arrow'
import { formatLabel } from '@/math/format'
import { groupOpacity, MONO, stateColor, type SymbolProps } from './state'

interface Props extends SymbolProps {
  /** Signed: negative = downward, positive = upward. */
  magnitude: number
  unit?: string
}

const TOP = -53
const FACE = -5

/** Fixed-length arrow: size never depends on magnitude, the label carries the number. */
export function PointLoad({ x, magnitude, unit = 'kN', state = 'default' }: Props) {
  const color = stateColor(state, 'var(--load)')
  const down = magnitude < 0
  return (
    <g transform={`translate(${x},0)`} opacity={groupOpacity(state)}>
      <rect x={-8} y={TOP} width={16} height={FACE - TOP} fill="transparent" />
      {down ? (
        <Arrow x1={0} y1={TOP} x2={0} y2={FACE} color="var(--load)" state={state} />
      ) : (
        <Arrow x1={0} y1={FACE} x2={0} y2={TOP} color="var(--load)" state={state} />
      )}
      <text x={0} y={TOP - 5} textAnchor="middle" fontFamily={MONO} fontSize={12} fill={color}>
        {formatLabel(magnitude, unit)}
      </text>
    </g>
  )
}
