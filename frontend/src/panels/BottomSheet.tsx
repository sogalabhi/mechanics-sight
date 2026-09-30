import { useState, type ReactNode } from 'react'
import { removeItem } from '@/model/actions'
import { useStore } from '@/store/store'
import styles from './panels.module.css'

export const SHEET_MAX = '52vh'

/** Phone inspector: slides up from the bottom while an item is selected. */
export function BottomSheet({ children }: { children: ReactNode }) {
  const open = useStore((s) => s.selectedId !== null)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  const beam = useStore((s) => s.beam)
  const commit = useStore((s) => s.commit)
  const [collapsed, setCollapsed] = useState(false)
  if (!open) return null
  return (
    <>
      {/* keeps the last rows of the page reachable above the sheet */}
      <div style={{ height: collapsed ? 44 : SHEET_MAX }} aria-hidden />
      <section className={styles.sheet} style={{ maxHeight: collapsed ? 44 : SHEET_MAX }} aria-label="Edit selected item">
        <div className={styles.sheetBar}>
          <button className={styles.sheetGrip} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? 'Show editor' : 'Hide editor'}
          </button>
          <button className={styles.sheetDelete} onClick={() => selectedId && commit(removeItem(beam, selectedId), null)}>Delete</button>
          <button className={styles.sheetClose} onClick={() => select(null)}>Done</button>
        </div>
        {!collapsed && <div className={styles.sheetBody}>{children}</div>}
      </section>
    </>
  )
}
