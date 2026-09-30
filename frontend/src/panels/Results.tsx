import { formatNumber } from '@/math/format'
import type { AnalysisResult } from '@/model/types'
import { useStore } from '@/store/store'
import { ValuesTable } from './ValuesTable'
import { WorkingPanel } from '@/working/WorkingPanel'
import { CanonicalCard } from '@/working/CanonicalCard'
import styles from './panels.module.css'

function badge(r: AnalysisResult): { text: string; tone: string } {
  const c = r.classification
  if (c.status === 'determinate') return { text: 'Determinate', tone: '' }
  if (c.status === 'unstable') return { text: `Unstable — ${c.reason ?? 'not restrained'}`, tone: styles.danger }
  if (c.bending_degree === 0) return { text: `Indeterminate · degree ${c.degree} (axial) — solved`, tone: '' }
  return { text: `Indeterminate · degree ${c.degree} (bending)`, tone: styles.warn }
}

export function Results() {
  const result = useStore((s) => s.result)
  const setPinned = useStore((s) => s.setPinned)
  if (!result) return null
  const b = badge(result)
  const ex = result.extremes
  const rows: [string, { x: number; value: number } | null, string][] = [
    ['M max (sagging)', ex.max_sagging, 'kN·m'],
    ['M min (hogging)', ex.max_hogging, 'kN·m'],
    ['V max', ex.max_positive_shear, 'kN'],
    ['V min', ex.max_negative_shear, 'kN'],
  ]
  return (
    <div>
      <h2 className={styles.title}>Results</h2>
      <p className={`${styles.badge} ${b.tone}`}>{b.text}</p>
      {result.canonical && <CanonicalCard canonical={result.canonical} />}

      <h3 className={styles.sub}>Reactions</h3>
      <table className={`${styles.table} num`}>
        <thead><tr><th /><th>Fx</th><th>Fy</th><th>M</th></tr></thead>
        <tbody>
          {result.reactions.map((r) => (
            <tr key={r.support_id}>
              <td>{r.support_id.split('_')[0]}</td>
              <td>{formatNumber(r.fx, { sign: true })}</td>
              <td>{formatNumber(r.fy, { sign: true })}</td>
              <td>{formatNumber(r.moment, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.sub}>Extremes</h3>
      {rows.map(([label, e, unit]) =>
        e ? (
          <button key={label} className={`${styles.row} num`} onClick={() => setPinned(e.x)}>
            <span>{label}</span>
            <span>{formatNumber(e.value, { sign: true })} {unit} @ {formatNumber(e.x)} m</span>
          </button>
        ) : null,
      )}

      {result.zero_shear_points.length > 0 && (
        <>
          <h3 className={styles.sub}>Zero shear</h3>
          {result.zero_shear_points.map((z) => (
            <button key={z} className={`${styles.row} num`} onClick={() => setPinned(z)}>
              <span>x</span><span>{formatNumber(z)} m</span>
            </button>
          ))}
        </>
      )}
      {result.warnings.map((w) => (
        <p key={w} className={styles.hint}>{w}</p>
      ))}
      <ValuesTable />
      <WorkingPanel />
    </div>
  )
}
