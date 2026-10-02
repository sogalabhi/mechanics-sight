import { selectCursorX, useStore } from '@/store/store'
import styles from './CanvasBar.module.css'

function Chip({ label, on, onClick, disabled, title }: { label: string; on: boolean; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button className={styles.chip} aria-pressed={on} onClick={onClick} disabled={disabled} title={title}>
      {label}
    </button>
  )
}

/** What is drawn, one toggle per view, right above the diagrams they control. */
export function CanvasBar() {
  const s = useStore()
  const hasStress = Boolean(s.result?.bending_stress)
  const hasAxial = (s.result?.segments ?? []).some((seg) => seg.axial?.some((c) => Math.abs(c) > 1e-12))
  const axialOn = s.showAxial === null ? hasAxial : s.showAxial
  const cursorX = selectCursorX(s)
  const cutOn = s.sawCutX !== null
  return (
    <div className={styles.bar} role="toolbar" aria-label="Diagram options">
      <Chip label="Reactions" on={s.showReactions} onClick={() => s.setShowReactions(!s.showReactions)} />
      <Chip label="Guides" on={s.showGuides} onClick={() => s.setShowGuides(!s.showGuides)} title="Lines through critical points" />
      <Chip label="dM/dx = V" on={s.showCalculus} onClick={() => s.setShowCalculus(!s.showCalculus)} title="Show the tangent that links shear and moment" />
      <span className={styles.sep} aria-hidden />
      <Chip label="Axial" on={axialOn} onClick={() => s.setShowAxial(!axialOn)} />
      <Chip label="Deflection" on={s.showDeflection} onClick={() => s.setShowDeflection(!s.showDeflection)} />
      <Chip
        label="Stress"
        on={s.showStress && hasStress}
        disabled={!hasStress}
        onClick={() => s.setShowStress(!s.showStress)}
        title={hasStress ? undefined : 'Enable Material & section to see stress'}
      />
      <span className={styles.sep} aria-hidden />
      <Chip
        label={cutOn ? 'Close cut' : 'Cut (S)'}
        on={cutOn}
        disabled={!s.result}
        onClick={() => (cutOn ? s.setSawCutX(null) : s.toggleSawAt(cursorX ?? s.beam.length / 2))}
        title="Cut the beam at the pinned or hovered position"
      />
      <span className={styles.spacer} />
      <details className={styles.help}>
        <summary className={styles.chip} aria-label="Keyboard and mouse help">?</summary>
        <dl className={styles.helpBody}>
          <dt>Click a diagram</dt><dd>Pin the position</dd>
          <dt>Drag on shear</dt><dd>Integrate an area</dd>
          <dt>S</dt><dd>Cut at the cursor</dd>
          <dt>← → Home End</dt><dd>Move the pin (diagram focused). Shift is 5× faster</dd>
          <dt>Drag a support or load</dt><dd>Alt turns off snapping</dd>
          <dt>Esc</dt><dd>Clear pin, cut, range, selection</dd>
        </dl>
      </details>
    </div>
  )
}
