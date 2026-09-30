import { Arrow } from './Arrow'
import { formatLabel, formatNumber } from '@/math/format'
import { groupOpacity, MONO, stateColor, type SymbolProps } from './state'

interface Props extends SymbolProps {
  /** Signed: negative = downward, positive = upward. */
  magnitude: number
  /** Signed: positive = rightward, negative = leftward. */
  fx?: number
  unit?: string
}

const TOP = -53
const FACE = -5
const ARROW_LEN = 48

/** Fixed-length arrow: size never depends on magnitude, the label carries the number. */
export function PointLoad({ x, magnitude, fx = 0, unit = 'kN', state = 'default' }: Props) {
  const color = stateColor(state, 'var(--load)')
  const hasFx = Math.abs(fx) > 1e-6
  const hasFy = Math.abs(magnitude) > 1e-6

  // Case 1: Purely vertical load (standard)
  if (!hasFx) {
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

  // Case 2: Purely horizontal load
  if (!hasFy) {
    const right = fx > 0
    const x1 = right ? -ARROW_LEN : ARROW_LEN
    const x2 = right ? -4 : 4
    return (
      <g transform={`translate(${x},0)`} opacity={groupOpacity(state)}>
        <rect x={Math.min(x1, x2)} y={-18} width={ARROW_LEN} height={24} fill="transparent" />
        <Arrow x1={x1} y1={-8} x2={x2} y2={-8} color="var(--load)" state={state} />
        <text x={x1 / 2} y={-16} textAnchor="middle" fontFamily={MONO} fontSize={11} fill={color}>
          {formatLabel(fx, unit)}
        </text>
      </g>
    )
  }

  // Case 3: Inclined load
  const total = Math.hypot(fx, magnitude)
  const deg = Math.round((Math.atan2(Math.abs(magnitude), Math.abs(fx)) * 180) / Math.PI)
  const ux = fx / total
  const uy = -magnitude / total // screen dy

  const pushes = magnitude < 0
  const xTip = pushes ? 0 : ARROW_LEN * ux
  const yTip = pushes ? FACE : FACE + ARROW_LEN * uy
  const xTail = pushes ? -ARROW_LEN * ux : 0
  const yTail = pushes ? FACE - ARROW_LEN * uy : FACE

  const labelX = (xTail + xTip) / 2
  const labelY = Math.min(yTail, yTip) - 8

  return (
    <g transform={`translate(${x},0)`} opacity={groupOpacity(state)}>
      <rect
        x={Math.min(xTail, xTip) - 10}
        y={Math.min(yTail, yTip) - 20}
        width={Math.abs(xTip - xTail) + 20}
        height={Math.abs(yTip - yTail) + 24}
        fill="transparent"
      />
      <Arrow x1={xTail} y1={yTail} x2={xTip} y2={yTip} color="var(--load)" state={state} />
      <text x={labelX} y={labelY} textAnchor="middle" fontFamily={MONO} fontSize={11} fill={color}>
        {formatNumber(total)} {unit} ({deg}°)
      </text>
    </g>
  )
}
