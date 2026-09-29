import { Hatch } from './Hatch'
import { groupOpacity, stroke, type SymbolProps } from './state'

export function PinSupport({ x, state = 'default' }: SymbolProps) {
  const s = stroke(state)
  return (
    <g transform={`translate(${x},0)`} opacity={groupOpacity(state)}>
      <polygon points="0,5 -12,25 12,25" {...s} />
      <circle cx={0} cy={5} r={3} {...s} fill="var(--paper)" />
      <line {...s} x1={-18} y1={25} x2={18} y2={25} />
      <Hatch x1={-18} y1={25} x2={18} y2={25} side="below" />
    </g>
  )
}
