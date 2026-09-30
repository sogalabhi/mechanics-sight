import type { ScaleLinear } from 'd3-scale'
import { createContext, useContext } from 'react'

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

export const ScaleCtx = createContext<ScaleLinear<number, number> | null>(null)
export const LayoutCtx = createContext<Layout>(layoutFor(1000))

export function useXScale(): ScaleLinear<number, number> {
  const s = useContext(ScaleCtx)
  if (!s) throw new Error('useXScale outside XScaleProvider')
  return s
}

export const useLayout = () => useContext(LayoutCtx)
