import { useEffect } from 'react'
import { gridStep } from '@/math/snap'
import { moveItem, removeItem, validateBeam } from '@/model/actions'
import { useStore } from '@/store/store'

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return
      const s = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && k === 'y') {
        e.preventDefault()
        s.redo()
      } else if (s.selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        s.commit(removeItem(s.beam, s.selectedId), null)
      } else if (s.selectedId && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const step = gridStep(s.beam.length) * (e.shiftKey ? 10 : 1)
        const next = moveItem(s.beam, s.selectedId, e.key === 'ArrowLeft' ? -step : step)
        if (next !== s.beam && validateBeam(next) === null) s.commit(next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
