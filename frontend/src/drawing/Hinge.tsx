import { stroke, type SymbolProps } from './state'

export function Hinge({ x, state = 'default' }: SymbolProps) {
  const s = stroke(state)
  return (
    <g transform={`translate(${x},0)`}>
      <circle cx={0} cy={0} r={5.5} {...s} fill="var(--paper)" strokeWidth={2.2} />
    </g>
  )
}
