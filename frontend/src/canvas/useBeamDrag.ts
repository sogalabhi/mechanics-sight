import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { addItem, findItem } from '@/model/actions'
import { dragItem, type DragSource } from '@/model/drag'
import type { BeamInput, Item } from '@/model/types'
import { snapPosition } from '@/math/snap'
import { useStore } from '@/store/store'
import { layoutFor } from './xscale'

/** Pointer capture works across the canvas, palette and touch without HTML drag events. */
export function useBeamDrag() {
  const cleanup = useRef<(() => void) | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => () => cleanup.current?.(), [])

  const startDrag = (e: ReactPointerEvent<Element>, source: DragSource) => {
    if (e.button !== 0 || !e.isPrimary) return
    e.stopPropagation()
    if ('item' in source) {
      useStore.getState().select(source.item.id)
      if (source.item.type === 'fixed') return
    }
    cleanup.current?.()
    suppressClick.current = false
    const canvas = document.querySelector<SVGSVGElement>('[data-beam-canvas]')
    if (!canvas) return
    const original = useStore.getState().beam
    const originalSelection = useStore.getState().selectedId
    const bounds = canvas.getBoundingClientRect()
    const layout = layoutFor(bounds.width)
    const left = layout.gutter + layout.pad
    const right = Math.max(left + 1, bounds.width - layout.pad)
    const pxPerM = (right - left) / original.length
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId
    // React reorders items as they cross each other. Capture on the stable canvas
    // so moving an item in the SVG does not cancel its own drag.
    const target = 'item' in source ? canvas : e.currentTarget
    let moved = false
    let stopped = false
    let template: BeamInput = original
    let item: Item | undefined = 'item' in source ? source.item : undefined
    const part = 'item' in source ? source.part ?? 'body' : 'body'
    const anchor = item ? (item.type === 'distributed' ? (part === 'end' ? item.end : item.start) : item.position) : 0
    target.setPointerCapture(pointerId)

    const update = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (useStore.getState().beam !== original) { stop(false); return }
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
      moved = true
      suppressClick.current = true
      ev.preventDefault()
      if ('kind' in source) {
        const inside = ev.clientX >= bounds.left + left && ev.clientX <= bounds.left + right && ev.clientY >= bounds.top && ev.clientY <= bounds.bottom
        if (!inside) {
          useStore.getState().setDraft(null)
          return
        }
        const at = snapPosition((ev.clientX - bounds.left - left) / pxPerM, original.length,
          [0, original.length, ...original.supports.map((s) => s.position), ...(original.loads ?? []).flatMap((l) => l.type === 'distributed' ? [l.start, l.end] : [l.position])], pxPerM, ev.altKey)
        if (!item) {
          const added = addItem(original, source.kind, at)
          template = added.beam
          item = findItem(template, added.id)
          useStore.getState().select(added.id)
        }
        if (!item) return
        // Fixed supports are placed at the nearest end; other items follow the pointer.
        if (item.type === 'fixed') {
          useStore.getState().setDraft({ ...template, supports: template.supports.map((s) => s.id === item?.id ? { ...s, position: at > original.length / 2 ? original.length : 0 } : s) })
        } else {
          const desired = item.type === 'distributed' ? at - (item.end - item.start) / 2 : at
          useStore.getState().setDraft(dragItem(template, item, desired, pxPerM, ev.altKey))
        }
      } else if (item) {
        useStore.getState().setDraft(dragItem(original, item, anchor + (ev.clientX - startX) / pxPerM, pxPerM, ev.altKey, part))
      }
    }
    const stop = (commit: boolean) => {
      if (stopped) return
      stopped = true
      window.removeEventListener('pointermove', update)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancelPointer)
      window.removeEventListener('keydown', key)
      window.removeEventListener('blur', cancel)
      target.removeEventListener('lostpointercapture', cancel)
      cleanup.current = null
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      const hasDraft = useStore.getState().draft !== null
      if (commit) useStore.getState().finishDrag()
      else useStore.getState().setDraft(null)
      if ('kind' in source && (!commit || !hasDraft)) useStore.getState().select(originalSelection)
      // Keep click suppression through cancellation until the pointer is released.
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      update(ev)
      stop(true)
    }
    const cancel = () => stop(false)
    const cancelPointer = (ev: PointerEvent) => { if (ev.pointerId === pointerId) cancel() }
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' || ((ev.ctrlKey || ev.metaKey) && ['z', 'y'].includes(ev.key.toLowerCase()))) {
        ev.preventDefault()
        cancel()
      }
    }
    cleanup.current = cancel
    window.addEventListener('pointermove', update, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancelPointer)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', cancel)
    target.addEventListener('lostpointercapture', cancel)
  }
  return { startDrag, consumeClick: () => {
    const consumed = suppressClick.current
    suppressClick.current = false
    return consumed
  } }
}
