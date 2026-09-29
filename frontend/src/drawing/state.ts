export type SymbolState = 'default' | 'hover' | 'selected' | 'ghost' | 'invalid'

export interface SymbolProps {
  /** x of the attachment point, in px. The beam centreline is y = 0, y grows downward. */
  x: number
  state?: SymbolState
}

/** Colour (after state override) for a symbol whose base colour is `color`. */
export function stateColor(state: SymbolState, color: string): string {
  if (state === 'selected') return 'var(--select)'
  if (state === 'invalid') return 'var(--danger)'
  return color
}

/** Stroke props shared by every drawing primitive. */
export function stroke(
  state: SymbolState,
  color = 'var(--ink)',
  width = 1.5,
) {
  return {
    stroke: stateColor(state, color),
    strokeWidth: state === 'hover' ? width + 0.5 : width,
    fill: 'none',
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

export function groupOpacity(state: SymbolState): number {
  return state === 'ghost' || state === 'invalid' ? 0.55 : 1
}

export const MONO = 'var(--font-mono)'
