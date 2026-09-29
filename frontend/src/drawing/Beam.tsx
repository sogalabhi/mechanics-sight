import { stroke, type SymbolState } from './state'

interface Props {
  /** Beam length in px (from x = 0). */
  length: number
  state?: SymbolState
  showHandle?: boolean
}

export function Beam({ length, state = 'default', showHandle = false }: Props) {
  return (
    <g>
      <rect x={0} y={-5} width={length} height={10} {...stroke(state)} fill="var(--panel)" />
      {showHandle && (
        <rect x={length - 5} y={-5} width={10} height={10} {...stroke('selected', 'var(--select)', 1.5)} fill="var(--paper)" />
      )}
    </g>
  )
}
