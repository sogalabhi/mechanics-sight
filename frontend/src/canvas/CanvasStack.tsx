import { useEffect, useRef } from 'react'
import { Crosshair } from '@/diagrams/Crosshair'
import { DIAGRAM_HEIGHT, DiagramPanel } from '@/diagrams/DiagramPanel'
import { DEFLECTION_PANEL_HEIGHT, ElasticCurvePanel } from '@/diagrams/ElasticCurvePanel'
import { IntegrationCard } from '@/diagrams/IntegrationCard'
import { VirtualSawCard } from '@/diagrams/VirtualSawCard'
import { useStore } from '@/store/store'
import { BEAM_PANEL_HEIGHT, BeamView } from './BeamView'
import { Guides } from './Guides'
import { useXScale } from './xscale'

const SNAP_PX = 6
const DRAG_THRESHOLD_PX = 6

const rule = { borderTop: '1px solid var(--rule)' } as const

export function CanvasStack({ width }: { width: number }) {
  const xs = useXScale()
  const ref = useRef<HTMLDivElement>(null)
  const length = useStore((s) => s.beam.length)
  const showDeflection = useStore((s) => s.showDeflection)
  const showAxialPref = useStore((s) => s.showAxial)
  const hasAxial = useStore((s) =>
    (s.result?.segments ?? []).some((seg) => seg.axial && seg.axial.some((c) => Math.abs(c) > 1e-12)),
  )
  const showAxial = showAxialPref === null ? hasAxial : showAxialPref
  const dragStart = useRef<{ clientX: number; x0: number; isDragging: boolean } | null>(null)
  const { setHover } = useStore.getState()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useStore.getState().setPinned(null)
        useStore.getState().setIntegrationRange(null)
        useStore.getState().setSawCutX(null)
        useStore.getState().select(null)
      } else if (e.key === 's' || e.key === 'S') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        const s = useStore.getState()
        const curX = s.pinnedX ?? s.hoverX
        if (curX !== null && curX > 1e-4 && curX < length - 1e-4) {
          s.setSawCutX(s.sawCutX === curX ? null : curX)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [length])

  /** Beam x (m) under a pointer, snapped to the ends, critical points, and zero shear roots; null off the beam. */
  const xAt = (clientX: number): number | null => {
    if (!ref.current) return null
    const px = clientX - ref.current.getBoundingClientRect().left
    if (px < xs(0) || px > xs(length)) return null
    const res = useStore.getState().result
    const stops = [
      0,
      length,
      ...(res?.critical_points.map((c) => c.x) ?? []),
      ...(res?.zero_shear_points ?? []),
    ]
    let m = Math.min(length, Math.max(0, xs.invert(px)))
    for (const s of stops) if (Math.abs(xs(s) - px) <= SNAP_PX) m = s
    return m
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const x0 = xAt(e.clientX)
    if (x0 !== null) {
      dragStart.current = { clientX: e.clientX, x0, isDragging: false }
    }
    setHover(x0)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const curX = xAt(e.clientX)
    setHover(curX)

    if (dragStart.current && curX !== null) {
      const distPx = Math.abs(e.clientX - dragStart.current.clientX)
      if (distPx >= DRAG_THRESHOLD_PX) {
        dragStart.current.isDragging = true
        const a = Math.min(dragStart.current.x0, curX)
        const b = Math.max(dragStart.current.x0, curX)
        if (b - a > 1e-4) {
          useStore.getState().setIntegrationRange([a, b])
        }
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current) {
      const wasDragging = dragStart.current.isDragging
      dragStart.current = null

      if (!wasDragging) {
        // Single click / tap:
        const s = useStore.getState()
        if (s.integrationRange !== null) {
          s.setIntegrationRange(null)
        } else {
          const clickedX = xAt(e.clientX)
          s.setPinned(s.pinnedX !== null ? null : clickedX)
        }
      }
    }
  }

  return (
    <div
      ref={ref}
      style={{ touchAction: 'pan-y', position: 'relative' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={(e) => {
        dragStart.current = null
        if (e.pointerType !== 'touch') setHover(null)
      }}
    >
      <IntegrationCard />
      <VirtualSawCard />
      <svg width={width} height={BEAM_PANEL_HEIGHT} style={{ display: 'block' }}>
        <Guides height={BEAM_PANEL_HEIGHT} />
        <BeamView />
        <Crosshair height={BEAM_PANEL_HEIGHT} />
      </svg>
      {showAxial && (
        <svg width={width} height={DIAGRAM_HEIGHT} style={{ display: 'block', ...rule, cursor: 'crosshair' }}>
          <DiagramPanel kind="axial" width={width} />
        </svg>
      )}
      {(['shear', 'moment'] as const).map((k) => (
        <svg key={k} width={width} height={DIAGRAM_HEIGHT} style={{ display: 'block', ...rule, cursor: 'crosshair' }}>
          <DiagramPanel kind={k} width={width} />
        </svg>
      ))}
      {showDeflection && (
        <svg width={width} height={DEFLECTION_PANEL_HEIGHT} style={{ display: 'block', ...rule, cursor: 'crosshair' }}>
          <ElasticCurvePanel width={width} />
        </svg>
      )}
    </div>
  )
}
