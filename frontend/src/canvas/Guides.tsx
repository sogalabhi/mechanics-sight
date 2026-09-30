import { useStore } from '@/store/store'
import { useXScale } from './XScaleContext'

/** Faint dashed verticals at every critical point, so x lines up across the three panels. */
export function Guides({ height }: { height: number }) {
  const on = useStore((s) => s.showGuides)
  const result = useStore((s) => s.result)
  const x = useXScale()
  if (!on || !result) return null
  const xs = [...result.critical_points.map((c) => c.x), ...result.zero_shear_points]
  return (
    <g pointerEvents="none">
      {xs.map((v, i) => (
        <line key={i} x1={x(v)} x2={x(v)} y1={0} y2={height} stroke="var(--rule)" strokeWidth={1} strokeDasharray="2 4" />
      ))}
    </g>
  )
}
