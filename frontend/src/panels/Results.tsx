import { formatNumber } from '@/math/format'
import type { AnalysisResult } from '@/model/types'
import { useStore } from '@/store/store'
import { ValuesTable } from './ValuesTable'
import { CanonicalCard } from '@/working/CanonicalCard'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'

function badge(r: AnalysisResult): { text: string; tone: string } {
  const c = r.classification
  if (c.status === 'determinate') return { text: 'Determinate', tone: '' }
  if (c.status === 'unstable') return { text: `Unstable — ${c.reason ?? 'not restrained'}`, tone: styles.danger }
  if (c.bending_degree > 0 && c.axial_degree > 0) {
    return { text: `Indeterminate · degree ${c.degree} (${c.bending_degree} bending, ${c.axial_degree} axial) — solved`, tone: '' }
  }
  if (c.bending_degree > 0) {
    return { text: `Indeterminate · degree ${c.bending_degree} (bending) — solved`, tone: '' }
  }
  return { text: `Indeterminate · degree ${c.axial_degree} (axial) — solved`, tone: '' }
}

export function Results() {
  const result = useStore((s) => s.result)
  const analyzing = useStore((s) => s.analyzing)
  const setPinned = useStore((s) => s.setPinned)
  const beam = useStore((s) => s.draft ?? s.beam)
  const commit = useStore((s) => s.commit)

  if (!result && analyzing) {
    return (
      <div role="status" aria-live="polite">
        <h2 className={styles.title}>Results</h2>
        <p className={styles.hint}>Solving…</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div>
        <h2 className={styles.title}>Results</h2>
        <div className={styles.emptyResultsCard}>
          <div className={styles.emptyBadge}>Awaiting Restraint</div>
          <p className={styles.emptyTitle}>No Results to Display</p>
          <p className={styles.emptyDesc}>
            {beam.supports.length === 0
              ? 'Beam has no supports. Add a pin, roller, or fixed support to solve for reactions, extremes, and stresses.'
              : 'The structure cannot be solved in its current state. Verify support constraints and hinge stability.'}
          </p>
          {beam.supports.length === 0 && (
            <div className={styles.emptyActions}>
              <button
                className={ui.btn}
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  const b = structuredClone(beam)
                  b.supports = [
                    { id: 's1', type: 'pin', position: 0 },
                    { id: 's2', type: 'roller', position: b.length },
                  ]
                  if (!b.loads || b.loads.length === 0) {
                    b.loads = [
                      {
                        id: 'l1',
                        type: 'point',
                        position: Math.round((b.length / 2) * 100) / 100,
                        magnitude: -10,
                        fx: 0,
                      },
                    ]
                  }
                  commit(b)
                }}
              >
                + Add Pin & Roller
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const b = badge(result)
  const ex = result.extremes
  const rows: [string, { x: number; value: number } | null, string][] = [
    ['M max (sagging)', ex.max_sagging, 'kN·m'],
    ['M min (hogging)', ex.max_hogging, 'kN·m'],
    ['V max', ex.max_positive_shear, 'kN'],
    ['V min', ex.max_negative_shear, 'kN'],
    ...(ex.max_tension ? [['N max (tension)' as const, ex.max_tension, 'kN'] as [string, { x: number; value: number }, string]] : []),
    ...(ex.max_compression ? [['N min (compression)' as const, ex.max_compression, 'kN'] as [string, { x: number; value: number }, string]] : []),
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

      {result.deflection && (
        <>
          <h3 className={styles.sub}>Physical deflection</h3>
          <button className={`${styles.row} num`} onClick={() => setPinned(result.deflection!.max_absolute.x)}>
            <span>Maximum |δ|</span>
            <span>
              {formatNumber(result.deflection.max_absolute.value * 1000, { sign: true })} mm @{' '}
              {formatNumber(result.deflection.max_absolute.x)} m
            </span>
          </button>
        </>
      )}

      {result.bending_stress && (
        <>
          <h3 className={styles.sub}>Bending stress</h3>
          {result.bending_stress.max_tension && (
            <button
              className={`${styles.row} num`}
              onClick={() => setPinned(result.bending_stress!.max_tension!.x)}
            >
              <span>Max tension (σ)</span>
              <span>
                {formatNumber(result.bending_stress.max_tension.value / 1000, { sign: true })} MPa @{' '}
                {formatNumber(result.bending_stress.max_tension.x)} m
              </span>
            </button>
          )}
          {result.bending_stress.max_compression && (
            <button
              className={`${styles.row} num`}
              onClick={() => setPinned(result.bending_stress!.max_compression!.x)}
            >
              <span>Max compression (σ)</span>
              <span>
                {formatNumber(result.bending_stress.max_compression.value / 1000, { sign: true })} MPa @{' '}
                {formatNumber(result.bending_stress.max_compression.x)} m
              </span>
            </button>
          )}
          <div className={`${styles.row} num`}>
            <span>Yield check</span>
            <span style={{ color: result.bending_stress.yield_exceeded ? 'var(--danger)' : 'var(--ok)' }}>
              {result.bending_stress.yield_exceeded ? '⚠ Yield exceeded' : '✓ Elastic'} · ratio {(result.bending_stress.yield_ratio * 100).toFixed(1)}%
            </span>
          </div>
        </>
      )}

      {result.shear_stress?.max_shear_stress && (
        <>
          <h3 className={styles.sub}>Transverse shear stress</h3>
          <button
            className={`${styles.row} num`}
            onClick={() => setPinned(result.shear_stress!.max_shear_stress!.x)}
          >
            <span>Maximum |τ|</span>
            <span>
              {formatNumber(result.shear_stress.max_shear_stress.value / 1000)} MPa @{' '}
              {formatNumber(result.shear_stress.max_shear_stress.x)} m
            </span>
          </button>
        </>
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
    </div>
  )
}
