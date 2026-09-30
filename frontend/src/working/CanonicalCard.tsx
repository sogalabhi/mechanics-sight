import { useState } from 'react'
import type { components } from '@/api/schema'
import { Math } from './Math'
import styles from './CanonicalCard.module.css'

type Canonical = components['schemas']['CanonicalOut']

export function CanonicalCard({ canonical }: { canonical: Canonical }) {
  const [showDerivation, setShowDerivation] = useState(false)

  return (
    <div className={styles.card}>
      <div className={styles.badge}>
        <span>📚</span>
        <span>Standard Textbook Case</span>
      </div>
      <h3 className={styles.title}>{canonical.name}</h3>

      <div className={styles.grid}>
        <div className={styles.field}>
          <span className={styles.label}>Textbook Formula</span>
          <div className={styles.formulaBox}>
            <Math tex={canonical.symbolic_formula} />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Support Reactions</span>
          <div className={styles.formulaBox}>
            <Math tex={canonical.symbolic_reactions} />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>With Values Substituted</span>
          <div className={styles.formulaBox}>
            <Math tex={canonical.substituted_formula} />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Evaluated Result</span>
          <div className={styles.formulaBox}>
            <Math tex={`${canonical.result_text}\\quad \\text{at } ${canonical.location_text}`} />
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.derivationToggle}
        onClick={() => setShowDerivation(!showDerivation)}
        aria-expanded={showDerivation}
      >
        <span>{showDerivation ? '▾' : '▸'}</span>
        <span>{showDerivation ? 'Hide Derivation Proof' : 'Show Derivation Proof (First Principles)'}</span>
      </button>

      {showDerivation && (
        <ol className={styles.derivationList}>
          {canonical.derivation.map((step, idx) => (
            <li key={idx} className={styles.derivationStep}>
              <Math tex={step} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
