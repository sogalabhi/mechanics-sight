import { Hatch } from './Hatch'
import { groupOpacity, stroke, type SymbolProps } from './state'

interface Props extends SymbolProps {
  /** Which end of the beam the wall is at. The right end is the mirror image. */
  end: 'left' | 'right'
}

export function FixedSupport({ x, end, state = 'default' }: Props) {
  const s = stroke(state, 'var(--ink)', 2)
  return (
    <g transform={`translate(${x},0) scale(${end === 'left' ? 1 : -1},1)`} opacity={groupOpacity(state)}>
      <line {...s} x1={0} y1={-24} x2={0} y2={24} />
      <Hatch x1={0} y1={-24} x2={0} y2={24} side="left" length={7} />
    </g>
  )
}
