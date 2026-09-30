import { scaleLinear } from 'd3-scale'
import { useMemo, type ReactNode } from 'react'
import { LayoutCtx, ScaleCtx, layoutFor } from './xscale'

/** Provides the shared x-scale and layout. Hooks and constants live in ./xscale so this file
 *  only exports a component (keeps Fast Refresh from swapping the context under the provider). */
export function XScaleProvider({ length, width, children }: { length: number; width: number; children: ReactNode }) {
  const layout = useMemo(() => layoutFor(width), [width])
  const scale = useMemo(
    () =>
      scaleLinear()
        .domain([0, length])
        .range([layout.gutter + layout.pad, Math.max(layout.gutter + layout.pad + 1, width - layout.pad)]),
    [length, width, layout],
  )
  return (
    <LayoutCtx.Provider value={layout}>
      <ScaleCtx.Provider value={scale}>{children}</ScaleCtx.Provider>
    </LayoutCtx.Provider>
  )
}
