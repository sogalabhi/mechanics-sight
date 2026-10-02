import { useEffect, useState } from 'react'

/** True once `on` has been true for `ms`. Short waits never flash an indicator. */
export function useDelayedFlag(on: boolean, ms = 150): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!on) return
    const t = setTimeout(() => setShown(true), ms)
    return () => {
      clearTimeout(t)
      setShown(false)
    }
  }, [on, ms])
  return on && shown
}
