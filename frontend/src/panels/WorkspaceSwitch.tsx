import { LAB_ROUTE } from '@/lab/steel/share'
import styles from './panels.module.css'

/** Beam | Steel: two workspaces of one app. Each keeps its own state while the other is open. */
export function WorkspaceSwitch({ active }: { active: 'beam' | 'steel' }) {
  const go = (to: 'beam' | 'steel') => {
    if (to !== active) window.location.hash = to === 'steel' ? LAB_ROUTE : ''
  }
  return (
    <div className={styles.workspace} role="group" aria-label="Workspace">
      <button aria-pressed={active === 'beam'} onClick={() => go('beam')}>Beam</button>
      <button aria-pressed={active === 'steel'} onClick={() => go('steel')}>Steel</button>
    </div>
  )
}
