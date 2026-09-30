import { useEffect, useRef } from 'react'
import { emptyBeam } from '@/model/actions'
import { useStore } from '@/store/store'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'

const confirmReset = () => window.confirm('Reset to an empty 6 m beam? You can undo this.')

/** Display toggles and Reset. `inline` lays them out flat, for the phone menu. */
export function ViewMenu({ inline = false }: { inline?: boolean }) {
  const {
    beam,
    showReactions,
    showGuides,
    showCalculus,
    showDeflection,
    showAxial,
    sawCutX,
    pinnedX,
    hoverX,
    setShowReactions,
    setShowGuides,
    setShowCalculus,
    setShowDeflection,
    setShowAxial,
    setSawCutX,
    commit,
  } = useStore()
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (inline) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.removeAttribute('open')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailsRef.current?.open) {
        detailsRef.current.removeAttribute('open')
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [inline])

  const body = (
    <>
      <label><input type="checkbox" checked={showReactions} onChange={(e) => setShowReactions(e.target.checked)} /> Show reactions</label>
      <label><input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Show critical-point guides</label>
      <label><input type="checkbox" checked={showCalculus} onChange={(e) => setShowCalculus(e.target.checked)} /> Show calculus tangent (dM/dx = V)</label>
      <label><input type="checkbox" checked={showDeflection} onChange={(e) => setShowDeflection(e.target.checked)} /> Show deflected shape (elastic curve)</label>
      <label><input type="checkbox" checked={showAxial === true || showAxial === null} onChange={(e) => setShowAxial(e.target.checked)} /> Show axial force diagram (AFD){showAxial === null ? ' (auto)' : ''}</label>
      <button
        className={ui.btn}
        onClick={() => {
          const cutX = pinnedX ?? hoverX ?? beam.length / 2
          setSawCutX(sawCutX !== null ? null : cutX)
        }}
      >
        {sawCutX !== null ? '🪚 Close section cut' : '🪚 Virtual saw (cut beam)'}
      </button>
      <button className={ui.btn} onClick={() => confirmReset() && commit(emptyBeam(6), null)}>Reset beam</button>
    </>
  )
  if (inline) return <div className={styles.inlineView}>{body}</div>
  return (
    <details ref={detailsRef} className={styles.menu}>
      <summary className={ui.btn} aria-label="View options">View</summary>
      <div className={styles.menuBody}>{body}</div>
    </details>
  )
}
