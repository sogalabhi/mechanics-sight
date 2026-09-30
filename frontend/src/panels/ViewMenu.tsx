import { useEffect, useRef } from 'react'
import { emptyBeam } from '@/model/actions'
import { useStore } from '@/store/store'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'

const confirmReset = () => window.confirm('Reset to an empty 6 m beam? You can undo this.')

/** Display toggles and Reset. `inline` lays them out flat, for the phone menu. */
export function ViewMenu({ inline = false }: { inline?: boolean }) {
  const { showReactions, showGuides, showCalculus, setShowReactions, setShowGuides, setShowCalculus, commit } = useStore()
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
