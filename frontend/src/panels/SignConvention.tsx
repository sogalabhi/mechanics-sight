import { useEffect, useState } from 'react'
import styles from './panels.module.css'

const ROWS: [string, string][] = [
  ['Forces, reactions, w', 'Upward +'],
  ['Couples, reaction moments', 'Anticlockwise +'],
  ['Shear V(x)', 'Sum of vertical forces left of the cut'],
  ['Bending moment M(x)', 'Sagging +'],
]

export function SignConvention() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <span className={styles.signWrap}>
      <button className={styles.link} aria-expanded={open} onClick={() => setOpen(!open)}>
        Sign convention ⓘ
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label="Sign convention">
          <table className={styles.signTable}>
            <tbody>
              {ROWS.map(([a, b]) => (
                <tr key={a}><th scope="row">{a}</th><td>{b}</td></tr>
              ))}
            </tbody>
          </table>
          <p className={styles.formula}>V(x) = Σ forces left of x<br />M(x) = −Σ anticlockwise moments of loads left of x</p>
          <svg width="150" height="44" viewBox="0 0 150 44" aria-label="Sagging is positive">
            <path d="M10 8 Q75 44 140 8" fill="none" stroke="var(--moment)" strokeWidth="2" />
            <text x="75" y="14" textAnchor="middle" fontSize="11" fill="var(--ink-2)">sagging = +M</text>
          </svg>
          <p className={styles.formula}>A downward 10 kN load is stored as −10. A clockwise couple makes the BMD jump up.</p>
        </div>
      )}
    </span>
  )
}
