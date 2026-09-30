import { useRef } from 'react'
import { formatNumber } from '@/math/format'
import { useStore } from '@/store/store'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'

/** V and M just left and right of every critical point; also the accessible view of the diagrams. */
export function ValuesTable() {
  const result = useStore((s) => s.result)
  const ref = useRef<HTMLDialogElement>(null)
  if (!result) return null
  const f = (v: number) => formatNumber(v, { sign: true })
  return (
    <>
      <button className={`${ui.btn} ${styles.wide}`} onClick={() => ref.current?.showModal()}>Values table</button>
      <dialog ref={ref} className={styles.dialog} aria-label="Values at critical points">
        <table className={`${styles.values} num`}>
          <caption>V (kN) and M (kN·m) just left and right of each critical point</caption>
          <thead>
            <tr><th>x (m)</th><th>V left</th><th>V right</th><th>M left</th><th>M right</th></tr>
          </thead>
          <tbody>
            {result.critical_points.map((p) => (
              <tr key={p.x}>
                <td>{formatNumber(p.x)}</td>
                <td>{f(p.shear_left)}</td><td>{f(p.shear_right)}</td>
                <td>{f(p.moment_left)}</td><td>{f(p.moment_right)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form method="dialog"><button className={ui.btn}>Close</button></form>
      </dialog>
    </>
  )
}
