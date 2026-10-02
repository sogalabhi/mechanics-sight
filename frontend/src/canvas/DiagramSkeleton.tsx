import { DIAGRAM_HEIGHT } from '@/diagrams/DiagramPanel'
import { DEFLECTION_PANEL_HEIGHT } from '@/diagrams/ElasticCurvePanel'
import styles from './DiagramSkeleton.module.css'

const PANELS = [
  { label: 'Shear force V', height: DIAGRAM_HEIGHT },
  { label: 'Bending moment M', height: DIAGRAM_HEIGHT },
  { label: 'Deflected shape', height: DEFLECTION_PANEL_HEIGHT },
]

/** Placeholder panels, same heights as the real diagrams, shown while the first solve is in flight. */
export function DiagramSkeleton({ width }: { width: number }) {
  return (
    <div style={{ width }} role="status" aria-live="polite" aria-label="Solving the beam">
      {PANELS.map((p, i) => (
        <div key={p.label} className={styles.panel} style={{ height: p.height }}>
          <span className={styles.label}>{p.label}</span>
          <div className={styles.axis} />
          <div className={styles.shimmer} />
          {i === 0 && <span className={styles.status}>Solving…</span>}
        </div>
      ))}
    </div>
  )
}
