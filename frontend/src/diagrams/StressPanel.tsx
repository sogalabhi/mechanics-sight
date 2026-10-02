import { scaleLinear } from 'd3-scale'
import { useMemo } from 'react'
import { Guides } from '@/canvas/Guides'
import { useLayout, useXScale } from '@/canvas/xscale'
import { formatNumber, formatTick } from '@/math/format'
import { selectCursorX, useStore } from '@/store/store'
import { Crosshair } from './Crosshair'

export const STRESS_PANEL_HEIGHT = 190
const TOP = 28
const BOTTOM = 18
const FONT = 'var(--font-mono)'

interface StressPoint {
  x: number
  topMpa: number
  botMpa: number
}

export function StressPanel({ width }: { width: number }) {
  const result = useStore((s) => s.result)
  const beam = useStore((s) => s.draft ?? s.beam)
  const curX = useStore(selectCursorX)
  const fibre = useStore((s) => s.fibre)
  const x = useXScale()
  const { gutter: GUTTER } = useLayout()

  const stressData = result?.bending_stress

  // Sample points across segments
  const model = useMemo(() => {
    if (!stressData || !stressData.segments.length) return null
    const pts: StressPoint[] = []
    const samplesPerSeg = 50

    for (const seg of stressData.segments) {
      const len = seg.x_end - seg.x_start
      for (let i = 0; i <= samplesPerSeg; i++) {
        const t = (len * i) / samplesPerSeg
        const topKpa = seg.sigma_top.reduce((acc, c, p) => acc + c * Math.pow(t, p), 0)
        const botKpa = seg.sigma_bottom.reduce((acc, c, p) => acc + c * Math.pow(t, p), 0)
        pts.push({
          x: seg.x_start + t,
          topMpa: topKpa / 1000,
          botMpa: botKpa / 1000,
        })
      }
    }

    const allVals = pts.flatMap((p) => [p.topMpa, p.botMpa])
    let lo = Math.min(0, ...allVals)
    let hi = Math.max(0, ...allVals)
    if (lo === 0 && hi === 0) [lo, hi] = [-10, 10]
    const pad = (hi - lo) * 0.15
    const y = scaleLinear()
      .domain([lo - (lo < 0 ? pad : 0), hi + (hi > 0 ? pad : 0)])
      .range([STRESS_PANEL_HEIGHT - BOTTOM, TOP])
      .nice()

    return { pts, y }
  }, [stressData])

  if (!stressData || !model) return null

  const { pts, y } = model
  const zeroY = y(0)
  const x0 = x(0)

  // Current values at cursor
  let curTop: number | null = null
  let curBot: number | null = null
  if (curX !== null && curX >= 0 && curX <= beam.length) {
    for (const seg of stressData.segments) {
      if (seg.x_start - 1e-6 <= curX && curX <= seg.x_end + 1e-6) {
        const t = curX - seg.x_start
        curTop = seg.sigma_top.reduce((acc, c, p) => acc + c * Math.pow(t, p), 0) / 1000
        curBot = seg.sigma_bottom.reduce((acc, c, p) => acc + c * Math.pow(t, p), 0) / 1000
        break
      }
    }
  }

  // Build SVG path strings
  let topPath = ''
  let botPath = ''
  pts.forEach((p, idx) => {
    const px = x(p.x)
    const pyTop = y(p.topMpa)
    const pyBot = y(p.botMpa)
    if (idx === 0) {
      topPath = `M${px},${pyTop}`
      botPath = `M${px},${pyBot}`
    } else {
      topPath += ` L${px},${pyTop}`
      botPath += ` L${px},${pyBot}`
    }
  })

  const yTicks = y.ticks(5)

  return (
    <g>
      <Guides height={STRESS_PANEL_HEIGHT} />

      {/* Axis & Ticks */}
      <line x1={GUTTER} x2={width - GUTTER} y1={zeroY} y2={zeroY} stroke="var(--ink-2)" strokeWidth={1} />
      {yTicks.map((t) => {
        const py = y(t)
        if (py < TOP - 4 || py > STRESS_PANEL_HEIGHT - BOTTOM + 4) return null
        return (
          <g key={t}>
            <line x1={GUTTER - 4} x2={GUTTER} y1={py} y2={py} stroke="var(--ink-2)" strokeWidth={0.8} />
            <text
              x={GUTTER - 6}
              y={py + 3.5}
              textAnchor="end"
              fontFamily={FONT}
              fontSize={10}
              fill="var(--ink-2)"
            >
              {formatTick(t)}
            </text>
          </g>
        )
      })}

      {/* Top and Bottom Fibre Stress Curves */}
      <path d={topPath} fill="none" stroke="var(--moment, #d97706)" strokeWidth={fibre === 'top' ? 3.2 : 2} strokeDasharray="5 3" opacity={fibre === 'bottom' ? 0.3 : 1} />
      <path d={botPath} fill="none" stroke="var(--axial, #2563eb)" strokeWidth={fibre === 'bottom' ? 3.2 : 2} opacity={fibre === 'top' ? 0.3 : 1} />

      {/* Header Legend & Title */}
      <text x={GUTTER} y={TOP - 12} fontFamily={FONT} fontSize={11} fontWeight={600} fill="var(--ink)">
        BENDING STRESS σ (MPa) · Top fibre (dashed), Bottom fibre (solid)
      </text>

      {/* Cursor Readings */}
      {curX !== null && curTop !== null && curBot !== null && (
        <text
          x={width - GUTTER}
          y={TOP - 12}
          textAnchor="end"
          fontFamily={FONT}
          fontSize={11}
          fill="var(--ink)"
        >
          x = {formatNumber(curX)} m: σ_top = {formatNumber(curTop, { sign: true })} MPa | σ_bot = {formatNumber(curBot, { sign: true })} MPa
        </text>
      )}

      {/* Zero line badge */}
      <text x={x0 - 8} y={zeroY + 3.5} textAnchor="end" fontFamily={FONT} fontSize={9.5} fill="var(--ink-2)">
        0
      </text>

      {/* Crosshair */}
      <Crosshair height={STRESS_PANEL_HEIGHT} />
    </g>
  )
}
