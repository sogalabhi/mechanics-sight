import { stroke } from './state'

interface Props {
  x1: number
  y1: number
  x2: number
  y2: number
  side: 'below' | 'left' | 'right'
  spacing?: number
  length?: number
}

/** Drafting hatch: short 45° strokes, drawn as explicit lines (no SVG pattern). */
export function Hatch({ x1, y1, x2, y2, side, spacing = 6, length = 6 }: Props) {
  const lines: [number, number, number, number][] = []
  if (side === 'below') {
    for (let x = x1 + 3; x <= x2 + 0.001; x += spacing) lines.push([x, y1, x - length, y1 + length])
  } else {
    const dx = side === 'left' ? -length : length
    for (let y = y1; y <= y2 - spacing + 0.001; y += spacing) lines.push([x1, y, x1 + dx, y + length])
  }
  return (
    <g {...stroke('default', 'var(--ink)', 1)}>
      {lines.map(([a, b, c, d], i) => (
        <line key={i} x1={a} y1={b} x2={c} y2={d} />
      ))}
    </g>
  )
}
