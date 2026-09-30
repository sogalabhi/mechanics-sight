import { scaleLinear } from 'd3-scale'
import { useMemo } from 'react'
import { formatNumber, formatQty, formatTick } from '@/math/format'
import { placeLabels, type LabelCandidate } from '@/math/labels'
import { curvePoints, largestRegions, signRegions, valueAt, type Kind } from '@/math/poly'
import { Guides } from '@/canvas/Guides'
import { useLayout, useXScale } from '@/canvas/xscale'
import { useStore } from '@/store/store'
import { CalculusTangent } from './CalculusTangent'
import { Crosshair } from './Crosshair'

export const DIAGRAM_HEIGHT = 190
const TOP = 28
const BOTTOM = 14
const FONT = 'var(--font-mono)'

const META = {
  shear: { title: 'SHEAR FORCE  V (kN)', color: 'var(--shear)', unit: 'kN' },
  moment: { title: 'BENDING MOMENT  M (kN·m) · sagging +', color: 'var(--moment)', unit: 'kN·m' },
} as const

interface Note {
  id: string
  x: number // m
  value: number
  text: string
  priority: number
  anchor?: 'start' | 'end'
  dot?: boolean
}

export function DiagramPanel({ kind, width }: { kind: Kind; width: number }) {
  const result = useStore((s) => s.result)
  const stale = useStore((s) => s.error !== null)
  const x = useXScale()
  const { gutter: GUTTER, compact } = useLayout()
  const meta = META[kind]
  const pxPerM = Math.abs(x(1) - x(0))

  const model = useMemo(() => {
    const pts = result ? curvePoints(result.segments, kind, pxPerM) : []
    const vals = pts.map((p) => p[1])
    let lo = Math.min(0, ...vals)
    let hi = Math.max(0, ...vals)
    if (lo === 0 && hi === 0) [lo, hi] = [-1, 1]
    const pad = (hi - lo) * 0.12
    const y = scaleLinear()
      .domain([lo - (lo < 0 ? pad : 0), hi + (hi > 0 ? pad : 0)])
      .range([DIAGRAM_HEIGHT - BOTTOM, TOP])
      .nice()
    return { pts, y }
  }, [result, kind, pxPerM])

  const { pts, y } = model
  const zero = y(0)

  const notes = useMemo(() => {
    if (!result) return []
    const out: Note[] = []
    const ex = result.extremes
    const add = (id: string, e: { x: number; value: number } | null, label: string, priority: number) => {
      if (e) out.push({ id, x: e.x, value: e.value, text: `${label} = ${formatQty(e.value, meta.unit, { sign: kind === 'shear' })}`, priority, dot: true })
    }
    if (kind === 'shear') {
      add('pv', ex.max_positive_shear, 'V max', 1)
      add('nv', ex.max_negative_shear, 'V min', 1)
    } else {
      add('sag', ex.max_sagging, 'M max', 1)
      add('hog', ex.max_hogging, 'M min', 1)
    }
    const dup = (px: number, v: number) => out.some((o) => Math.abs(o.x - px) < 1e-6 && Math.abs(o.value - v) < 1e-9)
    result.critical_points.forEach((cp, i) => {
      const l = kind === 'shear' ? cp.shear_left : cp.moment_left
      const r = kind === 'shear' ? cp.shear_right : cp.moment_right
      const jump = Math.abs(l - r) > 1e-9
      const push = (id: string, v: number, anchor?: 'start' | 'end') => {
        if (Math.abs(v) > 1e-9 && !dup(cp.x, v)) out.push({ id, x: cp.x, value: v, text: formatNumber(v, { sign: kind === 'shear' }), priority: 2, anchor })
      }
      push(`l${i}`, l, jump ? 'end' : undefined)
      if (jump) push(`r${i}`, r, 'start')
      else if (Math.abs(l) > 1e-9 && !dup(cp.x, l)) return
    })
    return out
  }, [result, kind, meta.unit])

  const visible = useMemo(() => {
    const cands: LabelCandidate[] = notes.map((n) => {
      const w = n.text.length * 6.6
      const cx = x(n.x)
      const [x0, x1] = n.anchor === 'end' ? [cx - 4 - w, cx - 4] : n.anchor === 'start' ? [cx + 4, cx + 4 + w] : [cx - w / 2, cx + w / 2]
      return { id: n.id, priority: n.priority, x0, x1, band: n.value >= 0 ? 'up' : 'down' }
    })
    return placeLabels(cands)
  }, [notes, x])

  const markers = largestRegions(signRegions(pts)).filter((r) => Math.abs(x(r.x1) - x(r.x0)) >= 24)
  const line = pts.map(([px, v]) => `${x(px)},${y(v)}`).join(' ')
  const ticks = y.ticks(5)

  return (
    <g>
      <text x={8} y={16} fontSize={11} letterSpacing="0.08em" fill="var(--ink-2)" fontWeight={500}>
        {compact ? meta.title.split(' · ')[0] : meta.title}
      </text>
      {stale && (
        <text x={width - 8} y={16} fontSize={11} textAnchor="end" fill="var(--warn)">
          Not up to date
        </text>
      )}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={GUTTER} x2={width} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
          <text x={GUTTER - 8} y={y(t) + 4} textAnchor="end" fontFamily={FONT} fontSize={11} fill="var(--ink-2)">
            {formatTick(t)}
          </text>
        </g>
      ))}
      <line x1={GUTTER} x2={width} y1={zero} y2={zero} stroke="var(--ink)" strokeWidth={1} />

      <Guides height={DIAGRAM_HEIGHT} />
      {result?.zero_shear_points.map((z) => {
        // dashed link: the SFD's zero crossing lines up with the BMD's peak
        const top = kind === 'shear' ? zero : TOP - 8
        const bottom = kind === 'shear' ? DIAGRAM_HEIGHT : y(valueAt(result, z, 'moment').right)
        return <line key={`z${z}`} x1={x(z)} x2={x(z)} y1={top} y2={bottom} stroke={meta.color} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} pointerEvents="none" />
      })}
      <g opacity={stale ? 0.35 : 1}>
        {markers.map((r) => (
          <text key={r.sign} x={(x(r.x0) + x(r.x1)) / 2} y={y((r.sign * r.peak) / 2) + 5} textAnchor="middle" fontSize={16} fill="var(--ink-2)" pointerEvents="none">
            {r.sign > 0 ? '+' : '\u2212'}
          </text>
        ))}
        {pts.length > 0 && (
          <>
            <polygon points={line} fill={meta.color} fillOpacity={0.14} stroke="none" />
            <polyline points={line} fill="none" stroke={meta.color} strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {kind === 'shear' &&
          result?.zero_shear_points.map((z) => (
            <g key={z}>
              <circle cx={x(z)} cy={zero} r={3} fill="var(--paper)" stroke={meta.color} strokeWidth={1.5} />
              <text x={x(z)} y={zero + 14} textAnchor="middle" fontFamily={FONT} fontSize={11} fill="var(--ink-2)">
                x = {formatNumber(z)}
              </text>
            </g>
          ))}
        {notes.map((n) => {
          const px = x(n.x)
          const py = y(n.value)
          const up = n.value >= 0
          return (
            <g key={n.id}>
              {n.dot && <circle cx={px} cy={py} r={4} fill={meta.color} />}
              {visible.has(n.id) && (
                <text
                  x={px + (n.anchor === 'end' ? -4 : n.anchor === 'start' ? 4 : 0)}
                  y={up ? py - 8 : py + 16}
                  textAnchor={n.anchor ?? 'middle'}
                  fontFamily={FONT}
                  fontSize={11}
                  fill="var(--ink)"
                >
                  {n.text}
                </text>
              )}
            </g>
          )
        })}
      </g>
      {kind === 'moment' && <CalculusTangent yOf={y} height={DIAGRAM_HEIGHT} />}
      <Crosshair kind={kind} yOf={y} height={DIAGRAM_HEIGHT} color={meta.color} unit={meta.unit} />
    </g>
  )
}
