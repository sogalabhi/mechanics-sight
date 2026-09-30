import { useMemo } from 'react'
import { formatNumber, formatQty } from '@/math/format'
import { integrateShear } from '@/math/poly'
import { useStore } from '@/store/store'
import styles from './IntegrationCard.module.css'

/**
 * Floating pedagogical HUD card showing the calculus relationship:
 * Shaded Area under SFD = ∫ V(x) dx ≡ ΔM = M(x_b) - M(x_a).
 */
export function IntegrationCard() {
  const range = useStore((s) => s.integrationRange)
  const result = useStore((s) => s.result)
  const setIntegrationRange = useStore((s) => s.setIntegrationRange)

  const data = useMemo(() => {
    if (!range || !result) return null
    return integrateShear(result, range[0], range[1])
  }, [range, result])

  if (!data) return null

  const hasBothSigns = data.positiveArea > 1e-4 && data.negativeArea < -1e-4
  const hasCouple = Math.abs(data.momentJumpSum) > 1e-5

  return (
    <aside className={styles.card} aria-label="Shear Integration Breakdown">
      <div className={styles.header}>
        <span className={styles.title}>SFD Area Integration</span>
        <button
          className={styles.closeBtn}
          onClick={() => setIntegrationRange(null)}
          title="Clear range selection (Esc)"
          aria-label="Clear range"
        >
          ×
        </button>
      </div>

      <div className={styles.rangeText}>
        Interval: <strong>x = {formatNumber(data.xStart)} m</strong> → <strong>{formatNumber(data.xEnd)} m</strong> (Δx = {formatNumber(data.xEnd - data.xStart)} m)
      </div>

      <div className={styles.mathBox}>
        <div className={styles.row}>
          <span className={styles.label}>Shaded SFD Area (∫ V dx):</span>
          <span className={styles.valShear}>{formatQty(data.totalArea, 'kN·m', { sign: true })}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Bending Moment Change (ΔM):</span>
          <span className={styles.valMoment}>{formatQty(data.deltaMoment, 'kN·m', { sign: true })}</span>
        </div>

        {hasBothSigns && (
          <div className={styles.parts}>
            <span>A(+) = +{formatNumber(data.positiveArea)}</span>
            <span>A(−) = {formatNumber(data.negativeArea)}</span>
            <span>Net = {formatNumber(data.totalArea)} kN·m</span>
          </div>
        )}
      </div>

      {!hasCouple ? (
        <div className={styles.proof}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#10b981" strokeWidth="1.5" />
            <path d="M5 8.5L7 10.5L11 5.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Exact Identity: ΔM ≡ ∫ V(x) dx</span>
        </div>
      ) : (
        <div className={styles.disclaimer}>
          Applied moment couple inside interval: {formatQty(data.momentJumpSum, 'kN·m', { sign: true })}
        </div>
      )}
    </aside>
  )
}
