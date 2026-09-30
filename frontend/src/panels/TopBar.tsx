import { useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from '@/canvas/useMediaQuery'
import { EXAMPLES } from '@/model/examples'
import { setLength, validateBeam } from '@/model/actions'
import { shareUrl } from '@/model/share'
import { applyTheme, loadTheme, type Theme } from '@/model/theme'
import { downloadReport } from '@/report/downloadReport'
import { useStore } from '@/store/store'
import { NumberField } from '@/ui/NumberField'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'
import { ViewMenu } from './ViewMenu'

export function TopBar() {
  const phone = useMediaQuery('(max-width: 699px)')
  const beam = useStore((s) => s.beam)
  const { commit, undo, redo, past, future } = useStore()
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [note, setNote] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const canReport = useStore((s) => s.draft === null && s.result !== null && s.error === null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const flash = (msg: string, ms = 2000) => {
    setNote(msg)
    setTimeout(() => setNote(null), ms)
  }
  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(beam))
      flash('Link copied')
    } catch {
      window.location.hash = shareUrl(beam).split('#')[1]
      flash('Link is in the address bar')
    }
  }
  const report = async () => {
    setBusy(true)
    try {
      await downloadReport()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Report failed', 4000)
    } finally {
      setBusy(false)
    }
  }

  const lengthField = (
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
  )
  const undoBtn = <button className={ui.btn} onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)" aria-label="Undo">{phone ? '↶' : 'Undo'}</button>
  const redoBtn = <button className={ui.btn} onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">{phone ? '↷' : 'Redo'}</button>
  const examples = (
    <select
      className={ui.btn}
      aria-label="Examples"
      value=""
      onChange={(e) => {
        const ex = EXAMPLES.find((x) => x.key === e.target.value)
        if (ex) {
          commit(structuredClone(ex.beam), null)
          setMenuOpen(false)
        }
      }}
    >
      <option value="" disabled>Examples</option>
      {EXAMPLES.map((x) => (
        <option key={x.key} value={x.key}>{x.label}</option>
      ))}
    </select>
  )
  const shareBtn = <button className={ui.btn} onClick={share}>Share link</button>
  const reportBtn = (
    <button className={ui.btn} onClick={report} disabled={!canReport || busy} title="Download a report with the beam, diagrams and calculation steps">
      {busy ? 'Preparing…' : 'Download report'}
    </button>
  )
  const themeSel = (
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
  )
  const toast: ReactNode = note && <span className={styles.toast} role="status">{note}</span>

  if (phone) {
    return (
      <>
        <button className={styles.burger} aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>
        <strong className={styles.brand}>Mechanics Sight</strong>
        <span className={styles.spacer} />
        {undoBtn}
        {redoBtn}
        {menuOpen && (
          <>
            <div className={styles.scrim} style={{ top: 48 }} onClick={() => setMenuOpen(false)} aria-hidden />
            <nav className={styles.drawer} aria-label="Menu">
              {lengthField}
              {examples}
              {shareBtn}
              {reportBtn}
              <ViewMenu inline />
              {themeSel}
              {toast}
            </nav>
          </>
        )}
        {!menuOpen && toast}
      </>
    )
  }

  return (
    <>
      <strong>Mechanics Sight</strong>
      <div className={styles.length}>{lengthField}</div>
      {undoBtn}
      {redoBtn}
      {examples}
      {shareBtn}
      {reportBtn}
      {toast}
      <ViewMenu />
      <span className={styles.spacer} />
      {themeSel}
    </>
  )
}
