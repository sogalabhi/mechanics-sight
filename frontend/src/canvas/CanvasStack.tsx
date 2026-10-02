import { useEffect, useRef } from 'react'
import { Crosshair } from '@/diagrams/Crosshair'
import { DIAGRAM_HEIGHT, DiagramPanel } from '@/diagrams/DiagramPanel'
import { DEFLECTION_PANEL_HEIGHT, ElasticCurvePanel } from '@/diagrams/ElasticCurvePanel'
import { STRESS_PANEL_HEIGHT, StressPanel } from '@/diagrams/StressPanel'
import { gridStep } from '@/math/snap'
import { selectCursorX, useStore } from '@/store/store'
import { BEAM_PANEL_HEIGHT, BeamView } from './BeamView'
import { CanvasBar } from './CanvasBar'
import { DiagramSkeleton } from './DiagramSkeleton'
import skeleton from './DiagramSkeleton.module.css'
import { EmptyDiagramState } from './EmptyDiagramState'
import { Guides } from './Guides'
import styles from './CanvasStack.module.css'
import { useDelayedFlag } from './useDelayedFlag'
import { useXScale } from './xscale'

const SNAP_PX = 6
const DRAG_THRESHOLD_PX = 6

const rule = { borderTop: '1px solid var(--rule)' } as const

export function CanvasStack({ width }: { width: number }) {
  const xs = useXScale()
  const ref = useRef<HTMLDivElement>(null)
  const length = useStore((s) => s.beam.length)
  const result = useStore((s) => s.result)
  const analyzing = useStore((s) => s.analyzing)
  const slow = useDelayedFlag(analyzing && result !== null)
  const hasSupports = useStore((s) => s.beam.supports.length > 0)
  const hasLoads = useStore((s) => (s.beam.loads ?? []).length > 0)
  const showDeflection = useStore((s) => s.showDeflection)
  const showStress = useStore((s) => s.showStress)
  const hasStress = Boolean(useStore((s) => s.result?.bending_stress))
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
        useStore.getState().clearSelection()
      } else if (e.key === 's' || e.key === 'S') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        const s = useStore.getState()
        const curX = selectCursorX(s)
        if (curX !== null && curX > 1e-4 && curX < length - 1e-4) s.toggleSawAt(curX)
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
      className={styles.stack}
      tabIndex={0}
      role="group"
      aria-label="Beam and diagrams. Left and right arrows move the pinned position."
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        const s = useStore.getState()
        const step = gridStep(length) * (e.shiftKey ? 5 : 1)
        const at = selectCursorX(s) ?? length / 2
        let next: number
        if (e.key === 'ArrowLeft') next = at - step
        else if (e.key === 'ArrowRight') next = at + step
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = length
        else return
        e.preventDefault()
        s.setPinned(Math.round(Math.min(length, Math.max(0, next)) * 1000) / 1000)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={(e) => {
        dragStart.current = null
        if (e.pointerType !== 'touch') setHover(null)
      }}
    >
      <CanvasBar />
      <svg data-beam-canvas width={width} height={BEAM_PANEL_HEIGHT} style={{ display: 'block' }}>
        <Guides height={BEAM_PANEL_HEIGHT} />
        <BeamView />
        <Crosshair height={BEAM_PANEL_HEIGHT} />
      </svg>
      {slow && <div className={skeleton.progress} role="progressbar" aria-label="Updating diagrams" />}
      {result ? (
        <div style={{ opacity: slow ? 0.55 : 1, transition: 'opacity 0.15s' }}>
          {!hasLoads && hasSupports && (
            <p style={{ margin: 0, padding: '6px 12px', fontSize: 12, color: 'var(--ink-2)', borderTop: '1px solid var(--rule)' }}>
              No loads yet. Drag a load from the palette onto the beam to see shear and moment.
            </p>
          )}
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
          {showStress && hasStress && (
            <svg width={width} height={STRESS_PANEL_HEIGHT} style={{ display: 'block', ...rule, cursor: 'crosshair' }}>
              <StressPanel width={width} />
            </svg>
          )}
        </div>
      ) : analyzing && hasSupports ? (
        <DiagramSkeleton width={width} />
      ) : (
        <EmptyDiagramState width={width} />
      )}
    </div>
  )
}
