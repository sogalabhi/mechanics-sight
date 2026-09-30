import { scaleLinear, type ScaleLinear } from 'd3-scale'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

export interface Layout {
  /** Left gutter (px): y-axis ticks of the diagrams. */
  gutter: number
  /** Padding each side of the beam inside the plot area. */
  pad: number
  /** Narrow screens: shorter titles, tighter margins. */
  compact: boolean
}

/** 64 / 48 px on desktop; tighter below 520px so a phone keeps most of its width for the beam. */
export function layoutFor(width: number): Layout {
  return width < 520 ? { gutter: 40, pad: 20, compact: true } : { gutter: 64, pad: 48, compact: false }
}

const ScaleCtx = createContext<ScaleLinear<number, number> | null>(null)
const LayoutCtx = createContext<Layout>(layoutFor(1000))

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

export function useXScale(): ScaleLinear<number, number> {
  const s = useContext(ScaleCtx)
  if (!s) throw new Error('useXScale outside XScaleProvider')
  return s
}

export const useLayout = () => useContext(LayoutCtx)
