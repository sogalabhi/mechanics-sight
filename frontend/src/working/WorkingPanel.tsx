import type { components } from '@/api/schema'
import { useStore } from '@/store/store'
import { CanonicalCard } from './CanonicalCard'
import { Math } from './Math'
import styles from './working.module.css'

type Step = components['schemas']['StepOut']

const GROUPS: { id: Step['group']; title: string }[] = [
  { id: 'reactions', title: 'Reactions' },
  { id: 'diagrams', title: 'Axial force, shear force and bending moment' },
  { id: 'extremes', title: 'Extreme values' },
  { id: 'physical', title: 'Slope and physical deflection' },
]

function StepView({ step }: { step: Step }) {
  const setPinned = useStore((s) => s.setPinned)
  // A step tied to a place on the beam pins the crosshair there.
  const target =
    step.at ?? (step.x_start != null && step.x_end != null ? (step.x_start + step.x_end) / 2 : null)
  return (
    <li className={styles.step}>
      <button className={styles.stepHead} disabled={target === null} onClick={() => target !== null && setPinned(target)}>
        {step.title}
      </button>
      {(step.notes ?? []).map((n) => (
        <p key={n} className={styles.note}>{n}</p>
      ))}
      {step.symbolic && <div className={styles.eq}><Math tex={step.symbolic} /></div>}
      {step.substituted && <div className={styles.eq}><Math tex={step.substituted} /></div>}
      {step.result && <div className={`${styles.eq} ${styles.result}`}><Math tex={step.result} /></div>}
    </li>
  )
}

const METHOD_LABELS: Record<string, string> = {
  force: 'Force Method (Consistent Deformations)',
  three_moment: 'Three-Moment Equation (Clapeyron)',
  slope_deflection: 'Slope-Deflection Method',
  moment_distribution: 'Moment Distribution (Hardy Cross)',
  direct_stiffness: 'Direct Stiffness Method (1D FEM)',
}

export function WorkingPanel() {
  const on = useStore((s) => s.showWorking)
  const setOn = useStore((s) => s.setShowWorking)
  const steps = useStore((s) => s.result?.steps)
  const canonical = useStore((s) => s.result?.canonical)
  const availableMethods = useStore((s) => s.result?.available_methods)
  const selectedMethod = useStore((s) => s.selectedMethod)
  const resultSelectedMethod = useStore((s) => s.result?.selected_method)
  const setSelectedMethod = useStore((s) => s.setSelectedMethod)
  const unsupported = useStore((s) => s.stepsUnsupported)

  const activeMethod = selectedMethod ?? resultSelectedMethod ?? availableMethods?.[0]
  return (
    <div>
      <button className={styles.toggle} aria-expanded={on} onClick={() => setOn(!on)}>
        {on ? 'Hide working' : 'Show working'}
      </button>
      {on && unsupported && (
        <p className={styles.note} role="alert">This solver did not return steps. Restart the backend so it runs the latest code.</p>
      )}
      {on && !steps && !unsupported && <p className={styles.note}>Loading…</p>}
      {on && steps && (
        <>
          {availableMethods && availableMethods.length > 0 && (
            <div className={styles.methodSelector}>
              <label htmlFor="method-select" className={styles.methodLabel}>Solution method</label>
              <select
                id="method-select"
                className={styles.methodSelect}
                value={activeMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
              >
                {availableMethods.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m] ?? m}
                  </option>
                ))}
              </select>
            </div>
          )}
          {canonical && <CanonicalCard canonical={canonical} />}
          {GROUPS.map((g) => {
            const list = steps.filter((s) => s.group === g.id)
            return list.length ? (
              <section key={g.id}>
                <h3 className={styles.group}>{g.title}</h3>
                <ol className={styles.list}>
                  {list.map((s, i) => (
                    <StepView key={i} step={s} />
                  ))}
                </ol>
              </section>
            ) : null
          })}
        </>
      )}
    </div>
  )
}
