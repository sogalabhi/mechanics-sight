import { useState } from 'react'
import { EXAMPLES } from '@/model/examples'
import { setLength, validateBeam } from '@/model/actions'
import { shareUrl } from '@/model/share'
import { applyTheme, loadTheme, type Theme } from '@/model/theme'
import { useStore } from '@/store/store'
import { NumberField } from '@/ui/NumberField'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'

export function TopBar() {
  const beam = useStore((s) => s.beam)
  const { commit, undo, redo, past, future } = useStore()
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [copied, setCopied] = useState<string | null>(null)

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(beam))
      setCopied('Link copied')
    } catch {
      window.location.hash = shareUrl(beam).split('#')[1]
      setCopied('Link is in the address bar')
    }
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <>
      <strong>Mechanics Sight</strong>
      <div className={styles.length}>
        <NumberField
          label="Length"
          unit="m"
          step={0.5}
          value={beam.length}
          onCommit={(v) => {
            const next = setLength(beam, v)
            const err = validateBeam(next)
            if (err) return err
            commit(next)
            return next.length !== v ? `Adjusted to ${next.length} m` : null
          }}
        />
      </div>
      <button className={ui.btn} onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">Undo</button>
      <button className={ui.btn} onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">Redo</button>
      <select
        className={ui.btn}
        aria-label="Examples"
        value=""
        onChange={(e) => {
          const ex = EXAMPLES.find((x) => x.key === e.target.value)
          if (ex) commit(structuredClone(ex.beam), null)
        }}
      >
        <option value="" disabled>Examples</option>
        {EXAMPLES.map((x) => (
          <option key={x.key} value={x.key}>{x.label}</option>
        ))}
      </select>
      <button className={ui.btn} onClick={share}>Share</button>
      {copied && <span className={styles.toast} role="status">{copied}</span>}
      <span className={styles.spacer} />
      <select
        className={ui.btn}
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
