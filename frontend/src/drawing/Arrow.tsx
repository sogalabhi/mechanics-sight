import { stroke, type SymbolState } from './state'

interface HeadProps {
  x: number
  y: number
  /** Unit direction the head points in. */
  dx: number
  dy: number
  length?: number
  width?: number
  color: string
}

export function ArrowHead({ x, y, dx, dy, length = 9, width = 8, color }: HeadProps) {
  const bx = x - dx * length
  const by = y - dy * length
  const hw = width / 2
  const pts = `${x},${y} ${bx - dy * hw},${by + dx * hw} ${bx + dy * hw},${by - dx * hw}`
  return <polygon points={pts} fill={color} stroke="none" />
}

interface Props {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  state?: SymbolState
  width?: number
  headLength?: number
  headWidth?: number
}

/** Straight arrow from tail (x1,y1) to tip (x2,y2). */
export function Arrow({ x1, y1, x2, y2, color, state = 'default', width = 1.5, headLength = 9, headWidth = 8 }: Props) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const dx = (x2 - x1) / len
  const dy = (y2 - y1) / len
  const s = stroke(state, color, width)
  const c = s.stroke
  return (
    <g>
      <line {...s} x1={x1} y1={y1} x2={x2 - dx * headLength} y2={y2 - dy * headLength} />
      <ArrowHead x={x2} y={y2} dx={dx} dy={dy} length={headLength} width={headWidth} color={c} />
    </g>
  )
}
