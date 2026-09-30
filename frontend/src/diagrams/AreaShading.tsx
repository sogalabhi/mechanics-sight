import { useMemo } from 'react'
import { useXScale } from '@/canvas/xscale'
import { formatNumber, formatQty } from '@/math/format'
import { curvePoints, integrateShear, type Kind } from '@/math/poly'
import { useStore } from '@/store/store'

interface Props {
  kind: Kind
  width: number
  yOf: (v: number) => number
  height: number
}

/**
 * Area-under-SFD Shading and Visual Integration Layer.
 * Shading on SFD represents ∫ V(x) dx.
 * Corresponding height bracket on BMD represents ΔM = M(x_b) - M(x_a).
 */
export function AreaShading({ kind, width: _width, yOf, height }: Props) {
  const range = useStore((s) => s.integrationRange)
  const result = useStore((s) => s.result)
  const xs = useXScale()
  const pxPerM = Math.abs(xs(1) - xs(0)) || 100

  const data = useMemo(() => {
    if (!range || !result) return null
    return integrateShear(result, range[0], range[1], pxPerM)
  }, [range, result, pxPerM])

  const bmdHighlight = useMemo(() => {
    if (!data || !result || kind !== 'moment') return null
    // Extract moment curve points strictly within [data.xStart, data.xEnd]
    const pts = curvePoints(result.segments, 'moment', pxPerM)
    const inRange = pts.filter(([x]) => x >= data.xStart - 1e-5 && x <= data.xEnd + 1e-5)
    if (inRange.length < 2) return null
    return inRange.map(([x, v]) => `${xs(x)},${yOf(v)}`).join(' ')
  }, [data, result, kind, pxPerM, xs, yOf])

  if (kind === 'axial' || !data) return null

  const xA = xs(data.xStart)
  const xB = xs(data.xEnd)
  const zeroY = yOf(0)

  if (kind === 'shear') {
    return (
      <g pointerEvents="none" className="area-shading">
        <defs>
          <pattern
            id="hatch-shear-pos"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--shear)" strokeWidth="1.2" strokeOpacity="0.35" />
          </pattern>
          <pattern
            id="hatch-shear-neg"
            width="8"
            height="8"
            patternTransform="rotate(-45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="#ea580c" strokeWidth="1.2" strokeOpacity="0.35" />
          </pattern>
        </defs>

        {/* Shaded polygons for each positive / negative shear region */}
        {data.regions.map((r, i) => {
          const polyPoints = r.pts.map(([px, v]) => `${xs(px)},${yOf(v)}`).join(' ')
          const isPos = r.sign > 0
          const color = isPos ? 'var(--shear)' : '#ea580c'
          const hatch = isPos ? 'url(#hatch-shear-pos)' : 'url(#hatch-shear-neg)'
          const xMid = (xs(r.x0) + xs(r.x1)) / 2

          return (
            <g key={i}>
              <polygon points={polyPoints} fill={color} fillOpacity={0.2} />
              <polygon points={polyPoints} fill={hatch} />
              <polyline points={polyPoints} fill="none" stroke={color} strokeWidth={1.5} />
              {/* Region area label if width is sufficient */}
              {Math.abs(xs(r.x1) - xs(r.x0)) >= 36 && (
                <g>
                  <rect
                    x={xMid - 28}
                    y={isPos ? zeroY - 26 : zeroY + 12}
                    width={56}
                    height={16}
                    rx={3}
                    fill="var(--panel)"
                    stroke={color}
                    strokeWidth={1}
                  />
                  <text
                    x={xMid}
                    y={isPos ? zeroY - 14 : zeroY + 24}
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontSize={10}
                    fontWeight={600}
                    fill={color}
                  >
                    {r.sign > 0 ? '+' : ''}
                    {formatNumber(r.area)}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Integration interval boundary lines */}
        <line x1={xA} x2={xA} y1={0} y2={height} stroke="var(--shear)" strokeWidth={1.5} strokeDasharray="3 3" />
        <line x1={xB} x2={xB} y1={0} y2={height} stroke="var(--shear)" strokeWidth={1.5} strokeDasharray="3 3" />
      </g>
    )
  }

  // kind === 'moment'
  const yA = yOf(data.momentStart)
  const yB = yOf(data.momentEnd)
  const bracketX = xB + 10
  const isRising = data.deltaMoment >= 0

  return (
    <g pointerEvents="none" className="bmd-delta-shading">
      {/* Interval boundary lines dropping from shear */}
      <line x1={xA} x2={xA} y1={0} y2={height} stroke="var(--moment)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6} />
      <line x1={xB} x2={xB} y1={0} y2={height} stroke="var(--moment)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6} />

      {/* Highlighted moment curve segment */}
      {bmdHighlight && (
        <>
          <polyline
            points={bmdHighlight}
            fill="none"
            stroke="var(--moment)"
            strokeWidth={5}
            strokeOpacity={0.3}
            strokeLinecap="round"
          />
          <polyline
            points={bmdHighlight}
            fill="none"
            stroke="var(--moment)"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </>
      )}

      {/* Endpoint circles */}
      <circle cx={xA} cy={yA} r={4.5} fill="var(--moment)" stroke="var(--panel)" strokeWidth={1.5} />
      <circle cx={xB} cy={yB} r={4.5} fill="var(--moment)" stroke="var(--panel)" strokeWidth={1.5} />

      {/* Delta Moment Vertical Dimension Bracket */}
      {Math.abs(yA - yB) >= 6 && (
        <g>
          {/* Extension line from P_a to bracket */}
          <line x1={xA} x2={bracketX + 4} y1={yA} y2={yA} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
          {/* Vertical bracket line */}
          <line x1={bracketX} x2={bracketX} y1={yA} y2={yB} stroke="var(--moment)" strokeWidth={1.8} />
          {/* Top and bottom tick caps */}
          <line x1={bracketX - 4} x2={bracketX + 4} y1={yA} y2={yA} stroke="var(--moment)" strokeWidth={1.5} />
          <line x1={bracketX - 4} x2={bracketX + 4} y1={yB} y2={yB} stroke="var(--moment)" strokeWidth={1.5} />
          {/* Directional arrowhead */}
          <polygon
            points={
              isRising
                ? `${bracketX},${yB - 4} ${bracketX - 3},${yB + 2} ${bracketX + 3},${yB + 2}`
                : `${bracketX},${yB + 4} ${bracketX - 3},${yB - 2} ${bracketX + 3},${yB - 2}`
            }
            fill="var(--moment)"
          />
          {/* Delta text tag */}
          <g>
            <rect
              x={bracketX + 6}
              y={(yA + yB) / 2 - 10}
              width={formatQty(data.deltaMoment, 'kN·m').length * 7 + 16}
              height={18}
              rx={3}
              fill="var(--panel)"
              stroke="var(--moment)"
              strokeWidth={1}
            />
            <text
              x={bracketX + 10}
              y={(yA + yB) / 2 + 3}
              fontFamily="var(--font-mono)"
              fontSize={10}
              fontWeight={600}
              fill="var(--moment)"
            >
              ΔM = {formatQty(data.deltaMoment, 'kN·m', { sign: true })}
            </text>
          </g>
        </g>
      )}
    </g>
  )
}
