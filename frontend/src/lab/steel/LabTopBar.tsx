import { useState } from 'react'
import { applyTheme, loadTheme, type Theme } from '@/model/theme'
import { WorkspaceSwitch } from '@/panels/WorkspaceSwitch'
import styles from './lab.module.css'
import { labUrl } from './share'
import { useLab } from './store'

export function LabTopBar() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [note, setNote] = useState<string | null>(null)
  const flash = (msg: string) => {
    setNote(msg)
    setTimeout(() => setNote(null), 2000)
  }
  const share = async () => {
    const url = labUrl(useLab.getState().history)
    try {
      await navigator.clipboard.writeText(url)
      flash('Link copied')
    } catch {
      flash('Link is in the address bar')
    }
  }
  return (
    <>
      <strong>Mechanics Sight</strong>
      <WorkspaceSwitch active="steel" />
      <span className={`${styles.muted} ${styles.hidePhone}`}>Tension test</span>
      <span className={styles.spacer} />
      {note && <span className={styles.toast} role="status">{note}</span>}
      <button className={styles.btn} onClick={share}>Share link</button>
      <select
        className={`${styles.btn} ${styles.hidePhone}`}
        aria-label="Theme"
        value={theme}
        onChange={(e) => {
          const t = e.target.value as Theme
          setTheme(t)
          applyTheme(t)
        }}
      >
        <option value="system">Theme: System</option>
        <option value="light">Theme: Light</option>
        <option value="dark">Theme: Dark</option>
      </select>
    </>
  )
}
