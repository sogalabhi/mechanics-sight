import type { components } from '@/api/schema'
import { useStore } from '@/store/store'
import { Math } from './Math'
import styles from './working.module.css'

type Step = components['schemas']['StepOut']

const GROUPS: { id: Step['group']; title: string }[] = [
  { id: 'reactions', title: 'Reactions' },
  { id: 'diagrams', title: 'Shear force and bending moment' },
  { id: 'extremes', title: 'Extreme values' },
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

export function WorkingPanel() {
  const on = useStore((s) => s.showWorking)
  const setOn = useStore((s) => s.setShowWorking)
  const steps = useStore((s) => s.result?.steps)
  const unsupported = useStore((s) => s.stepsUnsupported)
  return (
    <div>
      <button className={styles.toggle} aria-expanded={on} onClick={() => setOn(!on)}>
        {on ? 'Hide working' : 'Show working'}
      </button>
      {on && unsupported && (
        <p className={styles.note} role="alert">This solver did not return steps. Restart the backend so it runs the latest code.</p>
      )}
      {on && !steps && !unsupported && <p className={styles.note}>Loading…</p>}
      {on && steps &&
        GROUPS.map((g) => {
          const list = steps.filter((s) => s.group === g.id)
          return list.length ? (
            <section key={g.id}>
              <h3 className={styles.group}>{g.title}</h3>
              <ol className={styles.list}>
                {list.map((s, i) => <StepView key={i} step={s} />)}
              </ol>
            </section>
          ) : null
        })}
    </div>
  )
}
