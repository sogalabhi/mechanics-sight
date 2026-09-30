import { useMemo } from 'react'
import { Guides } from '@/canvas/Guides'
import { useLayout, useXScale } from '@/canvas/xscale'
import { solveElasticCurve, type DeflectionPoint } from '@/math/deflection'
import { formatNumber } from '@/math/format'
import { useStore } from '@/store/store'
import { Crosshair } from './Crosshair'

export const DEFLECTION_PANEL_HEIGHT = 160
const BASE_Y = 82
const MAX_DISP_PX = 32
const HALF_H = 6
const FONT = 'var(--font-mono)'

interface Zone {
  type: 'sagging' | 'hogging' | 'neutral'
  points: DeflectionPoint[]
  peakPoint: DeflectionPoint
}

function partitionZones(points: DeflectionPoint[]): Zone[] {
  if (points.length < 2) return []
  const zones: Zone[] = []

  let curType: 'sagging' | 'hogging' | 'neutral' =
    points[0].moment > 1e-4 ? 'sagging' : points[0].moment < -1e-4 ? 'hogging' : 'neutral'
  let curPts: DeflectionPoint[] = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const pt = points[i]
    const t: 'sagging' | 'hogging' | 'neutral' =
      pt.moment > 1e-4 ? 'sagging' : pt.moment < -1e-4 ? 'hogging' : 'neutral'

    if (t !== 'neutral' && curType === 'neutral') {
      curType = t
      curPts.push(pt)
    } else if (t !== 'neutral' && curType !== 'neutral' && t !== curType) {
      if (Math.abs(curPts[curPts.length - 1].moment) < 1e-4) {
        let peak = curPts[0]
        for (const p of curPts) if (Math.abs(p.yNorm) > Math.abs(peak.yNorm)) peak = p
        zones.push({ type: curType, points: curPts, peakPoint: peak })
        curPts = [curPts[curPts.length - 1], pt]
      } else {
        curPts.push(pt)
        let peak = curPts[0]
        for (const p of curPts) if (Math.abs(p.yNorm) > Math.abs(peak.yNorm)) peak = p
        zones.push({ type: curType, points: curPts, peakPoint: peak })
        curPts = [pt]
      }
      curType = t
    } else {
      curPts.push(pt)
    }
  }

  if (curPts.length > 0) {
    let peak = curPts[0]
    for (const p of curPts) if (Math.abs(p.yNorm) > Math.abs(peak.yNorm)) peak = p
    zones.push({ type: curType, points: curPts, peakPoint: peak })
  }

  return zones
}

export function ElasticCurvePanel({ width }: { width: number }) {
  const beam = useStore((s) => s.draft ?? s.beam)
  const result = useStore((s) => s.result)
  const stale = useStore((s) => s.error !== null)
  const hoverX = useStore((s) => s.hoverX)
  const pinnedX = useStore((s) => s.pinnedX)
  const x = useXScale()
  const { gutter: GUTTER, compact } = useLayout()

  const mx = pinnedX ?? hoverX

  const curveResult = useMemo(() => {
    if (!result) return null
    return solveElasticCurve(beam, result)
  }, [beam, result])

  const points = useMemo(() => curveResult?.points ?? [], [curveResult])
  const inflectionPoints = useMemo(() => curveResult?.inflectionPoints ?? [], [curveResult])
  const maxDeflection = curveResult?.maxDeflection ?? null

  const zones = useMemo(() => partitionZones(points), [points])

  // Centerline and outer outline polyline points
  const centerLine = points.map((p) => `${x(p.x)},${BASE_Y + p.yNorm * MAX_DISP_PX}`).join(' ')
  const topLine = points.map((p) => `${x(p.x)},${BASE_Y + p.yNorm * MAX_DISP_PX - HALF_H}`).join(' ')
  const bottomLine = points.map((p) => `${x(p.x)},${BASE_Y + p.yNorm * MAX_DISP_PX + HALF_H}`).join(' ')

  // End cap coordinates
  const p0 = points[0]
  const pEnd = points[points.length - 1]
  const y0 = p0 ? BASE_Y + p0.yNorm * MAX_DISP_PX : BASE_Y
  const yEnd = pEnd ? BASE_Y + pEnd.yNorm * MAX_DISP_PX : BASE_Y

  // Hover point info
  const hoverPt = useMemo(() => {
    if (mx === null || points.length === 0) return null
    // Find closest sampled point
    let closest = points[0]
    let minD = Math.abs(points[0].x - mx)
    for (const p of points) {
      const d = Math.abs(p.x - mx)
      if (d < minD) {
        minD = d
        closest = p
      }
    }
    return closest
  }, [mx, points])

  return (
    <g>
      {/* Title */}
      <text x={8} y={16} fontSize={11} letterSpacing="0.08em" fill="var(--ink-2)" fontWeight={500}>
        {compact ? 'ELASTIC CURVE' : 'QUALITATIVE DEFLECTED SHAPE & FIBER STRESSES'}
      </text>

      {/* Legend */}
      {!compact && (
        <g transform={`translate(${Math.max(340, width - 420)}, 7)`}>
          <rect x={0} y={2} width={10} height={10} rx={2} fill="var(--compression)" fillOpacity={0.85} />
          <text x={14} y={11} fontSize={10.5} fontFamily="var(--font-ui)" fill="var(--ink-2)">
            Compression (C)
          </text>
          <rect x={125} y={2} width={10} height={10} rx={2} fill="var(--tension)" fillOpacity={0.85} />
          <text x={139} y={11} fontSize={10.5} fontFamily="var(--font-ui)" fill="var(--ink-2)">
            Tension (T)
          </text>
          <line x1={225} x2={245} y1={7} y2={7} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 2" />
          <text x={250} y={11} fontSize={10.5} fontFamily="var(--font-ui)" fill="var(--ink-2)">
            Neutral Axis
          </text>
        </g>
      )}

      {stale && (
        <text x={width - 8} y={16} fontSize={11} textAnchor="end" fill="var(--warn)">
          Not up to date
        </text>
      )}

      {/* Undeformed Baseline (Reference Axis) */}
      <line x1={GUTTER} x2={width} y1={BASE_Y} y2={BASE_Y} stroke="var(--grid)" strokeWidth={1} />
      <line
        x1={x(0)}
        x2={x(beam.length)}
        y1={BASE_Y}
        y2={BASE_Y}
        stroke="var(--ink-2)"
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.4}
      />

      <Guides height={DEFLECTION_PANEL_HEIGHT} />

      {/* Supports on baseline */}
      {beam.supports.map((s) => {
        const sx = x(s.position)
        if (s.type === 'pin') {
          return (
            <g key={s.id}>
              <polygon
                points={`${sx},${BASE_Y} ${sx - 6},${BASE_Y + 11} ${sx + 6},${BASE_Y + 11}`}
                fill="var(--paper)"
                stroke="var(--reaction)"
                strokeWidth={1.5}
              />
              <line
                x1={sx - 9}
                x2={sx + 9}
                y1={BASE_Y + 12}
                y2={BASE_Y + 12}
                stroke="var(--reaction)"
                strokeWidth={1.5}
              />
            </g>
          )
        }
        if (s.type === 'roller') {
          return (
            <g key={s.id}>
              <polygon
                points={`${sx},${BASE_Y} ${sx - 6},${BASE_Y + 10} ${sx + 6},${BASE_Y + 10}`}
                fill="var(--paper)"
                stroke="var(--reaction)"
                strokeWidth={1.5}
              />
              <circle
                cx={sx - 3.5}
                cy={BASE_Y + 13.5}
                r={2}
                fill="var(--paper)"
                stroke="var(--reaction)"
                strokeWidth={1.2}
              />
              <circle
                cx={sx + 3.5}
                cy={BASE_Y + 13.5}
                r={2}
                fill="var(--paper)"
                stroke="var(--reaction)"
                strokeWidth={1.2}
              />
              <line
                x1={sx - 9}
                x2={sx + 9}
                y1={BASE_Y + 16.5}
                y2={BASE_Y + 16.5}
                stroke="var(--reaction)"
                strokeWidth={1.5}
              />
            </g>
          )
        }
        if (s.type === 'fixed') {
          const isLeft = s.position <= beam.length / 2
          const dir = isLeft ? -7 : 7
          return (
            <g key={s.id}>
              <line x1={sx} x2={sx} y1={BASE_Y - 14} y2={BASE_Y + 14} stroke="var(--reaction)" strokeWidth={3} />
              {[-10, -5, 0, 5, 10].map((dy) => (
                <line
                  key={dy}
                  x1={sx}
                  y1={BASE_Y + dy}
                  x2={sx + dir}
                  y2={BASE_Y + dy + 5}
                  stroke="var(--reaction)"
                  strokeWidth={1.2}
                />
              ))}
            </g>
          )
        }
        return null
      })}

      {/* Deflected Beam Ribbon with Tension/Compression Fibers */}
      {points.length > 0 ? (
        <g opacity={stale ? 0.35 : 1}>
          {/* Fiber Stress Zones */}
          {zones.map((z, idx) => {
            const zTop: string[] = []
            const zBot: string[] = []
            const zCenter: string[] = []

            for (const p of z.points) {
              const cx = x(p.x)
              const cy = BASE_Y + p.yNorm * MAX_DISP_PX
              zTop.push(`${cx},${cy - HALF_H}`)
              zBot.push(`${cx},${cy + HALF_H}`)
              zCenter.push(`${cx},${cy}`)
            }

            const topPoly = [...zTop, ...[...zCenter].reverse()].join(' ')
            const botPoly = [...zCenter, ...[...zBot].reverse()].join(' ')

            const topFill =
              z.type === 'sagging'
                ? 'var(--compression)'
                : z.type === 'hogging'
                ? 'var(--tension)'
                : 'var(--ink-2)'

            const botFill =
              z.type === 'sagging'
                ? 'var(--tension)'
                : z.type === 'hogging'
                ? 'var(--compression)'
                : 'var(--ink-2)'

            const opacity = z.type === 'neutral' ? 0.15 : 0.75

            return (
              <g key={`zone-${idx}`}>
                <polygon points={topPoly} fill={topFill} fillOpacity={opacity} stroke="none" />
                <polygon points={botPoly} fill={botFill} fillOpacity={opacity} stroke="none" />
              </g>
            )
          })}

          {/* Beam Outer Outline & End Caps */}
          <polyline
            points={topLine}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={1.2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={bottomLine}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={1.2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {p0 && (
            <line
              x1={x(p0.x)}
              x2={x(p0.x)}
              y1={y0 - HALF_H}
              y2={y0 + HALF_H}
              stroke="var(--ink)"
              strokeWidth={1.2}
            />
          )}
          {pEnd && (
            <line
              x1={x(pEnd.x)}
              x2={x(pEnd.x)}
              y1={yEnd - HALF_H}
              y2={yEnd + HALF_H}
              stroke="var(--ink)"
              strokeWidth={1.2}
            />
          )}

          {/* Neutral Axis (Dashed Centerline) */}
          <polyline
            points={centerLine}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.65}
            vectorEffect="non-scaling-stroke"
          />

          {/* Educational Callouts for Major Regions */}
          {zones.map((z, idx) => {
            const startPx = x(z.points[0].x)
            const endPx = x(z.points[z.points.length - 1].x)
            const zoneWidth = Math.abs(endPx - startPx)
            if (zoneWidth < 85 || z.type === 'neutral') return null

            const midX = (startPx + endPx) / 2
            const midY = BASE_Y + z.peakPoint.yNorm * MAX_DISP_PX

            if (z.type === 'sagging') {
              return (
                <g key={`callout-${idx}`} pointerEvents="none">
                  {/* Sagging: Top Compression, Bottom Tension */}
                  <text
                    x={midX}
                    y={midY - HALF_H - 7}
                    textAnchor="middle"
                    fontFamily={FONT}
                    fontSize={10}
                    fontWeight={600}
                    fill="var(--compression)"
                  >
                    Top: Compression
                  </text>
                  <text
                    x={midX}
                    y={midY + HALF_H + 15}
                    textAnchor="middle"
                    fontFamily={FONT}
                    fontSize={10}
                    fontWeight={600}
                    fill="var(--tension)"
                  >
                    Bottom: Tension (Rebar)
                  </text>
                </g>
              )
            } else if (z.type === 'hogging') {
              return (
                <g key={`callout-${idx}`} pointerEvents="none">
                  {/* Hogging: Top Tension, Bottom Compression */}
                  <text
                    x={midX}
                    y={midY - HALF_H - 7}
                    textAnchor="middle"
                    fontFamily={FONT}
                    fontSize={10}
                    fontWeight={600}
                    fill="var(--tension)"
                  >
                    Top: Tension (Rebar)
                  </text>
                  <text
                    x={midX}
                    y={midY + HALF_H + 15}
                    textAnchor="middle"
                    fontFamily={FONT}
                    fontSize={10}
                    fontWeight={600}
                    fill="var(--compression)"
                  >
                    Bottom: Compression
                  </text>
                </g>
              )
            }
            return null
          })}

          {/* Maximum Deflection Marker (δ_max) */}
          {maxDeflection && Math.abs(maxDeflection.yNorm) > 0.08 && (
            <g pointerEvents="none">
              {(() => {
                const mxPx = x(maxDeflection.x)
                const myPx = BASE_Y + maxDeflection.yNorm * MAX_DISP_PX
                const isDown = maxDeflection.yNorm > 0
                return (
                  <g>
                    <line
                      x1={mxPx}
                      x2={mxPx}
                      y1={BASE_Y}
                      y2={myPx}
                      stroke="var(--ink-2)"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <circle cx={mxPx} cy={myPx} r={3} fill="var(--ink)" />
                    <text
                      x={mxPx}
                      y={isDown ? myPx + HALF_H + 26 : myPx - HALF_H - 18}
                      textAnchor="middle"
                      fontFamily={FONT}
                      fontSize={9.5}
                      fill="var(--ink-2)"
                    >
                      δ_max (x = {formatNumber(maxDeflection.x)} m)
                    </text>
                  </g>
                )
              })()}
            </g>
          )}

          {/* Inflection Points (Points of Contraflexure where M = 0) */}
          {inflectionPoints.map((inf, idx) => {
            const ix = x(inf.x)
            const iy = BASE_Y + inf.yNorm * MAX_DISP_PX
            const isUp = inf.yNorm < 0
            const labelY = isUp ? iy + 24 : iy - 16

            return (
              <g key={`inf-${idx}`}>
                <line
                  x1={ix}
                  x2={ix}
                  y1={iy - 12}
                  y2={iy + 12}
                  stroke="var(--moment)"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
                <circle cx={ix} cy={iy} r={5} fill="var(--panel)" stroke="var(--moment)" strokeWidth={2} />
                <circle cx={ix} cy={iy} r={2} fill="var(--moment)" />
                <rect
                  x={ix - 52}
                  y={labelY - 11}
                  width={104}
                  height={15}
                  rx={3}
                  fill="var(--panel)"
                  stroke="var(--moment)"
                  strokeWidth={1}
                  opacity={0.92}
                />
                <text
                  x={ix}
                  y={labelY + 0.5}
                  textAnchor="middle"
                  fontFamily={FONT}
                  fontSize={9}
                  fontWeight={600}
                  fill="var(--moment)"
                >
                  Inflection (M=0)
                </text>
              </g>
            )
          })}
        </g>
      ) : (
        <text x={width / 2} y={BASE_Y + 4} textAnchor="middle" fill="var(--ink-2)" fontSize={12}>
          Add supports to view deflected shape and fiber stresses
        </text>
      )}

      {/* Hover / Pinned Cursor Indicator */}
      {hoverPt && (
        <g pointerEvents="none">
          {(() => {
            const hx = x(hoverPt.x)
            const hy = BASE_Y + hoverPt.yNorm * MAX_DISP_PX
            const isSag = hoverPt.moment > 1e-4
            const isHog = hoverPt.moment < -1e-4
            const label = isSag
              ? 'Sagging: Top C | Bot T'
              : isHog
              ? 'Hogging: Top T | Bot C'
              : 'Inflection / Zero M'

            return (
              <g>
                <circle cx={hx} cy={hy} r={4.5} fill="var(--ink)" stroke="var(--panel)" strokeWidth={1.5} />
                <rect
                  x={Math.min(Math.max(hx - 70, GUTTER + 4), width - 144)}
                  y={hy > BASE_Y ? hy - 25 : hy + 12}
                  width={140}
                  height={15}
                  rx={3}
                  fill="var(--panel)"
                  stroke="var(--ink-2)"
                  strokeWidth={0.8}
                  opacity={0.92}
                />
                <text
                  x={Math.min(Math.max(hx, GUTTER + 74), width - 74)}
                  y={hy > BASE_Y ? hy - 14 : hy + 23}
                  textAnchor="middle"
                  fontFamily={FONT}
                  fontSize={9}
                  fill="var(--ink)"
                >
                  {label}
                </text>
              </g>
            )
          })()}
        </g>
      )}

      {/* Global Crosshair vertical alignment */}
      <Crosshair height={DEFLECTION_PANEL_HEIGHT} />
    </g>
  )
}
