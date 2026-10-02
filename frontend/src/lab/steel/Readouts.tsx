import { formatNumber } from '@/math/format'
import styles from './lab.module.css'
import type { DisplayState } from './types'

const sign = (v: number, d: number) => (v > 1e-9 ? '+' : '') + formatNumber(v, { decimals: d })

/** The numbers the response carries, every one with its unit. */
export function Readouts({ state }: { state: DisplayState }) {
  const cells: { key: string; label: string; value: string; unit: string }[] = [
    { key: 'stress', label: 'Stress σ', value: sign(state.stress_mpa, 1), unit: 'MPa' },
    { key: 'strain', label: 'Strain ε', value: formatNumber(state.strain * 100), unit: '%' },
    { key: 'force', label: 'Force F', value: sign(state.force_kn, 3), unit: 'kN' },
    { key: 'extension', label: 'Extension ΔL', value: formatNumber(state.extension_mm), unit: 'mm' },
    { key: 'plastic', label: 'Plastic strain ε_p', value: formatNumber(state.plastic_strain * 100), unit: '%' },
    { key: 'elastic', label: 'Elastic strain', value: formatNumber(state.elastic_strain * 100), unit: '%' },
  ]
  return (
    <dl className={styles.readouts} aria-label="Readouts">
      {cells.map((c) => (
        <div key={c.key} className={styles.ro} data-readout={c.key}>
          <dt>{c.label}</dt>
          <dd>
            <span data-value>{c.value}</span> <small>{c.unit}</small>
          </dd>
        </div>
      ))}
    </dl>
  )
}
