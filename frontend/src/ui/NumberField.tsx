import { useEffect, useState } from 'react'
import { formatNumber } from '@/math/format'
import styles from './ui.module.css'

interface Props {
  label: string
  value: number
  unit?: string
  /** Step for Up/Down arrows. */
  step?: number
  /** Return an error message to reject the value. */
  onCommit: (v: number) => string | null
}

export function NumberField({ label, value, unit, step = 1, onCommit }: Props) {
  const [text, setText] = useState(formatNumber(value))
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setText(formatNumber(value))
    setErr(null)
  }, [value])

  const commitValue = (v: number) => {
    if (!Number.isFinite(v)) return setErr('Not a number')
    setErr(onCommit(v))
  }
  const commit = () => {
    if (text === formatNumber(value)) return
    commitValue(text.trim() === '' ? NaN : Number(text.replace('−', '-')))
  }

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.inputWrap}>
        <button type="button" className={styles.stepBtn} aria-label={`Decrease ${label}`} onClick={() => commitValue(value - step)}>−</button>
        <input
          className={`${styles.input} num`}
          inputMode="decimal"
          aria-label={label}
          aria-invalid={!!err}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') {
              setText(formatNumber(value))
              setErr(null)
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              commitValue(value + (e.key === 'ArrowUp' ? step : -step))
            }
          }}
        />
        <button type="button" className={styles.stepBtn} aria-label={`Increase ${label}`} onClick={() => commitValue(value + step)}>+</button>
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
      {err && <span className={styles.err}>{err}</span>}
    </label>
  )
}
