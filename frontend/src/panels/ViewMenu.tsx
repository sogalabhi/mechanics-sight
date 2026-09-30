import { emptyBeam } from '@/model/actions'
import { useStore } from '@/store/store'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'

const confirmReset = () => window.confirm('Reset to an empty 6 m beam? You can undo this.')

/** Display toggles and Reset. `inline` lays them out flat, for the phone menu. */
export function ViewMenu({ inline = false }: { inline?: boolean }) {
  const { showReactions, showGuides, setShowReactions, setShowGuides, commit } = useStore()
  const body = (
    <>
      <label><input type="checkbox" checked={showReactions} onChange={(e) => setShowReactions(e.target.checked)} /> Show reactions</label>
      <label><input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Show critical-point guides</label>
      <button className={ui.btn} onClick={() => confirmReset() && commit(emptyBeam(6), null)}>Reset beam</button>
    </>
  )
  if (inline) return <div className={styles.inlineView}>{body}</div>
  return (
    <details className={styles.menu}>
      <summary className={ui.btn} aria-label="View options">View</summary>
      <div className={styles.menuBody}>{body}</div>
    </details>
  )
}
