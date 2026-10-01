import { EXAMPLES } from '@/model/examples'
import { useStore } from '@/store/store'
import ui from '@/ui/ui.module.css'
import styles from './EmptyDiagramState.module.css'

export function EmptyDiagramState({ width }: { width: number }) {
  const beam = useStore((s) => s.draft ?? s.beam)
  const commit = useStore((s) => s.commit)
  const error = useStore((s) => s.error)

  const hasSupports = beam.supports.length > 0

  const addPinAndRoller = () => {
    const next = structuredClone(beam)
    next.supports = [
      { id: 's1', type: 'pin', position: 0 },
      { id: 's2', type: 'roller', position: beam.length },
    ]
    if (!next.loads || next.loads.length === 0) {
      next.loads = [
        {
          id: 'l1',
          type: 'point',
          position: Math.round((beam.length / 2) * 100) / 100,
          magnitude: -10,
          fx: 0,
        },
      ]
    }
    commit(next)
  }

  const addCantilever = () => {
    const next = structuredClone(beam)
    next.supports = [{ id: 's1', type: 'fixed', position: 0 }]
    if (!next.loads || next.loads.length === 0) {
      next.loads = [
        {
          id: 'l1',
          type: 'point',
          position: beam.length,
          magnitude: -10,
          fx: 0,
        },
      ]
    }
    commit(next)
  }

  const loadExample = (key: string) => {
    const ex = EXAMPLES.find((x) => x.key === key)
    if (ex) {
      commit(structuredClone(ex.beam))
    }
  }

  return (
    <div className={styles.container} style={{ width }}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.badge}>Model in Creation</span>
          <span className={styles.step}>Diagram Reveal</span>
        </div>

        <h3 className={styles.title}>
          {hasSupports
            ? 'Diagrams awaiting static equilibrium'
            : 'Add supports to reveal shear, moment, and deflection diagrams'}
        </h3>

        <p className={styles.desc}>
          {hasSupports ? (
            error?.message ??
            'The beam is currently unstable or under-constrained. Ensure the support configuration prevents rigid-body translation and rotation.'
          ) : (
            'Every beam requires at least one support to achieve static equilibrium. Add a pin and roller, fixed cantilever, or try a standard example to reveal full polynomial SFD, BMD, deflection curve, and stress distributions.'
          )}
        </p>

        <div className={styles.actions}>
          <button className={ui.btn} onClick={addPinAndRoller} title="Add pin at 0 m and roller at beam end">
            + Simply Supported (Pin & Roller)
          </button>
          <button className={ui.btn} onClick={addCantilever} title="Add fixed support at left end">
            + Cantilever (Fixed at 0 m)
          </button>
          <button
            className={ui.btn}
            onClick={() => loadExample('02_ss_full_udl')}
            title="Load standard UDL example"
          >
            📖 Try UDL Example
          </button>
        </div>

        <div className={styles.features}>
          <span className={styles.featureItem}>✓ Exact continuous polynomials</span>
          <span className={styles.featureItem}>✓ Euler-Bernoulli deflection</span>
          <span className={styles.featureItem}>✓ Method of sections (S)</span>
          <span className={styles.featureItem}>✓ Indeterminate solvers</span>
        </div>
      </div>
    </div>
  )
}
