import { useState } from 'react'
import { IntegrationCard } from '@/diagrams/IntegrationCard'
import { VirtualSawCard } from '@/diagrams/VirtualSawCard'
import { removeItem } from '@/model/actions'
import { PANE_W_DEFAULT, PANE_W_WIDE, paneWidthMax, useStore, type PaneTab } from '@/store/store'
import { Inspector } from './Inspector'
import { PhysicalProperties } from './PhysicalProperties'
import { Results } from './Results'
import { WorkingPanel } from '@/working/WorkingPanel'
import styles from './panels.module.css'

const TABS: { id: PaneTab; label: string }[] = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'section', label: 'Section' },
  { id: 'results', label: 'Results' },
  { id: 'maths', label: 'Maths' },
]

export const SHEET_MAX = '52vh'
const SHEET_BAR = 44

function Tabs({ onPick }: { onPick?: () => void }) {
  const tab = useStore((s) => s.paneTab)
  const setTab = useStore((s) => s.setPaneTab)
  return (
    <div className={styles.tabs} role="tablist" aria-label="Side pane">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          className={styles.tab}
          onClick={() => {
            setTab(t.id)
            onPick?.()
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function ResizeHandle() {
  const width = useStore((s) => s.paneWidth)
  const setWidth = useStore((s) => s.setPaneWidth)
  const wide = width >= PANE_W_WIDE - 20
  return (
    <>
      <div
        className={styles.resize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize side pane"
        aria-valuemin={280}
        aria-valuemax={paneWidthMax()}
        aria-valuenow={width}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          e.preventDefault()
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setWidth(window.innerWidth - e.clientX)
        }}
        onDoubleClick={() => setWidth(PANE_W_DEFAULT)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 80 : 20
          if (e.key === 'ArrowLeft') setWidth(width + step)
          else if (e.key === 'ArrowRight') setWidth(width - step)
          else return
          e.preventDefault()
        }}
      />
      <button
        className={styles.widen}
        onClick={() => setWidth(wide ? PANE_W_DEFAULT : PANE_W_WIDE)}
        aria-label={wide ? 'Narrow the side pane' : 'Widen the side pane'}
        title={wide ? 'Narrow the side pane' : 'Widen the side pane (graphs get narrower)'}
      >
        {wide ? '⇥' : '⇤'}
      </button>
    </>
  )
}

function Body({ phone }: { phone: boolean }) {
  const tab = useStore((s) => s.paneTab)
  switch (tab) {
    case 'inspect':
      return <InspectTab phone={phone} />
    case 'section':
      return <SectionTab />
    case 'results':
      return <Results />
    case 'maths':
      return (
        <>
          <h2 className={styles.title}>Maths</h2>
          <WorkingPanel />
        </>
      )
  }
}

/** The cut and the shaded-area integration: the two ways of looking inside the beam at a place. */
function SectionTab() {
  const sawCutX = useStore((s) => s.sawCutX)
  const range = useStore((s) => s.integrationRange)
  if (sawCutX === null && range === null) {
    return (
      <div>
        <h2 className={styles.title}>Section A–A</h2>
        <p className={styles.hint}>
          Click the beam and press <kbd>S</kbd>, or pick Saw Cut on the crosshair, to cut it and see the forces inside.
          Drag along the shear diagram to integrate an area.
        </p>
      </div>
    )
  }
  return (
    <>
      {sawCutX !== null && <VirtualSawCard />}
      {range !== null && <IntegrationCard />}
    </>
  )
}

function InspectTab({ phone }: { phone: boolean }) {
  return (
    <>
      <Inspector compact={phone} />
      <hr className={styles.rule} />
      <PhysicalProperties />
    </>
  )
}

/** The one contextual pane: a side column on desktop, a bottom sheet on phones. */
export function RightPane({ phone }: { phone: boolean }) {
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const beam = useStore((s) => s.beam)
  const commit = useStore((s) => s.commit)
  const [open, setOpen] = useState(false)

  const sawCutX = useStore((s) => s.sawCutX)
  const range = useStore((s) => s.integrationRange)
  // Selecting an item or opening a cut / range opens the sheet; adjusted during render instead of in an effect.
  const trigger = `${selectedId}|${sawCutX}|${range}`
  const [seen, setSeen] = useState(trigger)
  if (seen !== trigger) {
    setSeen(trigger)
    if (selectedId || sawCutX !== null || range !== null) setOpen(true)
  }

  if (!phone) {
    return (
      <>
        <ResizeHandle />
        <Tabs />
        <div className={styles.paneBody}><Body phone={false} /></div>
      </>
    )
  }
  return (
    <>
      {/* keeps the end of the page reachable above the sheet */}
      <div style={{ height: open ? SHEET_MAX : SHEET_BAR }} aria-hidden />
      <section className={styles.sheet} style={{ maxHeight: open ? SHEET_MAX : SHEET_BAR }} aria-label="Beam details">
        <div className={styles.sheetBar}>
          <Tabs onPick={() => setOpen(true)} />
          {selectedId && (
            <button className={styles.sheetDelete} onClick={() => commit(removeItem(beam, selectedId), null)}>Delete</button>
          )}
          <button
            className={styles.sheetClose}
            aria-expanded={open}
            onClick={() => {
              if (open && selectedId) select(null)
              setOpen(!open)
            }}
          >
            {open ? (selectedId ? 'Done' : 'Hide') : 'Show'}
          </button>
        </div>
        {open && <div className={styles.sheetBody}><Body phone /></div>}
      </section>
    </>
  )
}
