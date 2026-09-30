import { useStore } from '@/store/store'
import styles from './panels.module.css'

export function Banner() {
  const error = useStore((s) => s.error)
  if (!error) return null
  return (
    <div className={`${styles.banner} ${error.kind === 'network' ? styles.warn : styles.danger}`} role="alert">
      {error.message}
    </div>
  )
}
