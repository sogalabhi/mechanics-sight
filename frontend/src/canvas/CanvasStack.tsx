import { useEffect, useRef } from 'react'
import { DIAGRAM_HEIGHT, DiagramPanel } from '@/diagrams/DiagramPanel'
import { Crosshair } from '@/diagrams/Crosshair'
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

  const move = (e: React.PointerEvent) => {
    const left = ref.current!.getBoundingClientRect().left
    const px = e.clientX - left
    if (px < xs(0) || px > xs(length)) return setHover(null)
    let m = Math.min(length, Math.max(0, xs.invert(px)))
    const stops = [0, length, ...(useStore.getState().result?.critical_points.map((c) => c.x) ?? [])]
    for (const s of stops) if (Math.abs(xs(s) - px) <= SNAP_PX) m = s
    setHover(m)
  }
  const pin = () => {
    const s = useStore.getState()
    setPinned(s.pinnedX !== null ? null : s.hoverX)
  }

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={() => setHover(null)}>
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
