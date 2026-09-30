import { emptyBeam } from '@/model/actions'
import { useStore } from '@/store/store'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'

/** Display toggles and Reset. A <details> keeps it keyboard-accessible with no extra code. */
export function ViewMenu() {
  const { showReactions, showGuides, setShowReactions, setShowGuides, commit } = useStore()
  return (
    <details className={styles.menu}>
      <summary className={ui.btn} aria-label="View options">View</summary>
      <div className={styles.menuBody}>
        <label><input type="checkbox" checked={showReactions} onChange={(e) => setShowReactions(e.target.checked)} /> Show reactions</label>
        <label><input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Show critical-point guides</label>
        <hr />
        <button className={ui.btn} onClick={() => confirmReset() && commit(emptyBeam(6), null)}>Reset beam</button>
      </div>
    </details>
  )
}

const confirmReset = () => window.confirm('Reset to an empty 6 m beam? You can undo this.')
