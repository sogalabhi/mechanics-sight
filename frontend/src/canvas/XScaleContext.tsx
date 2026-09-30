import { scaleLinear, type ScaleLinear } from 'd3-scale'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

export const GUTTER = 64
export const PAD = 48

const Ctx = createContext<ScaleLinear<number, number> | null>(null)

export function XScaleProvider({ length, width, children }: { length: number; width: number; children: ReactNode }) {
  const scale = useMemo(
    () => scaleLinear().domain([0, length]).range([GUTTER + PAD, Math.max(GUTTER + PAD + 1, width - PAD)]),
    [length, width],
  )
  return <Ctx.Provider value={scale}>{children}</Ctx.Provider>
}

export function useXScale(): ScaleLinear<number, number> {
  const s = useContext(Ctx)
  if (!s) throw new Error('useXScale outside XScaleProvider')
  return s
}
