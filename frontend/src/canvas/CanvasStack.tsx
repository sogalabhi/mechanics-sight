import { useEffect, useRef } from 'react'
import { Crosshair } from '@/diagrams/Crosshair'
import { DIAGRAM_HEIGHT, DiagramPanel } from '@/diagrams/DiagramPanel'
import { useStore } from '@/store/store'
import { BEAM_PANEL_HEIGHT, BeamView } from './BeamView'
import { Guides } from './Guides'
import { useXScale } from './XScaleContext'

const SNAP_PX = 6

const rule = { borderTop: '1px solid var(--rule)' } as const

export function CanvasStack({ width }: { width: number }) {
  const xs = useXScale()
  const ref = useRef<HTMLDivElement>(null)
  const length = useStore((s) => s.beam.length)
  const { setHover, setPinned } = useStore.getState()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useStore.getState().setPinned(null)
        useStore.getState().select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** Beam x (m) under a pointer, snapped to the ends and critical points; null off the beam. */
  const xAt = (clientX: number): number | null => {
    const px = clientX - ref.current!.getBoundingClientRect().left
    if (px < xs(0) || px > xs(length)) return null
    let m = Math.min(length, Math.max(0, xs.invert(px)))
    const stops = [0, length, ...(useStore.getState().result?.critical_points.map((c) => c.x) ?? [])]
    for (const s of stops) if (Math.abs(xs(s) - px) <= SNAP_PX) m = s
    return m
  }
  // pointerdown as well as move: a tap on a phone never produces a move
  const track = (e: React.PointerEvent) => setHover(xAt(e.clientX))
  // click reads its own position: on touch, pointerleave has already cleared the hover by then
  const pin = (e: React.MouseEvent) => {
    const s = useStore.getState()
    setPinned(s.pinnedX !== null ? null : xAt(e.clientX))
  }

  return (
    <div
      ref={ref}
      style={{ touchAction: 'pan-y' }}
      onPointerDown={track}
      onPointerMove={track}
      onPointerLeave={(e) => e.pointerType !== 'touch' && setHover(null)}
    >
      <svg width={width} height={BEAM_PANEL_HEIGHT} style={{ display: 'block' }}>
        <Guides height={BEAM_PANEL_HEIGHT} />
        <BeamView />
        <Crosshair height={BEAM_PANEL_HEIGHT} />
      </svg>
      {(['shear', 'moment'] as const).map((k) => (
        <svg key={k} width={width} height={DIAGRAM_HEIGHT} style={{ display: 'block', ...rule, cursor: 'crosshair' }} onClick={pin}>
          <DiagramPanel kind={k} width={width} />
        </svg>
      ))}
    </div>
  )
}
