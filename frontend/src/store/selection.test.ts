import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// The store reads `window` (location hash, localStorage) when it loads, and the unit tests run in node.
let selectCursorX: typeof import('./store').selectCursorX
let useStore: typeof import('./store').useStore
beforeAll(async () => {
  vi.stubGlobal('window', { location: { hash: '' }, innerWidth: 1440 })
  ;({ selectCursorX, useStore } = await import('./store'))
})

describe('selection state', () => {
  beforeEach(() => {
    useStore.setState({ hoverX: null, pinnedX: null, sawCutX: null, integrationRange: null, fibre: null, selectedId: null })
  })

  it('cursor x prefers the pinned position over hover', () => {
    useStore.getState().setHover(1)
    expect(selectCursorX(useStore.getState())).toBe(1)
    useStore.getState().setPinned(2)
    expect(selectCursorX(useStore.getState())).toBe(2)
    useStore.getState().setPinned(null)
    expect(selectCursorX(useStore.getState())).toBe(1)
  })

  it('toggleSawAt opens the cut and closes it at the same x', () => {
    useStore.getState().toggleSawAt(3)
    expect(useStore.getState().sawCutX).toBe(3)
    useStore.getState().toggleSawAt(3)
    expect(useStore.getState().sawCutX).toBeNull()
    useStore.getState().toggleSawAt(3)
    useStore.getState().toggleSawAt(4)
    expect(useStore.getState().sawCutX).toBe(4)
  })

  it('clearSelection drops pin, range, cut, fibre and selection but keeps hover', () => {
    useStore.setState({ hoverX: 1, pinnedX: 2, sawCutX: 3, integrationRange: [1, 2], fibre: 'top', selectedId: 'p1' })
    useStore.getState().clearSelection()
    const s = useStore.getState()
    expect([s.pinnedX, s.sawCutX, s.integrationRange, s.fibre, s.selectedId]).toEqual([null, null, null, null, null])
    expect(s.hoverX).toBe(1)
  })

  it('selecting an item switches the pane to Inspect', () => {
    useStore.setState({ paneTab: 'results' })
    useStore.getState().select('p1')
    expect(useStore.getState().paneTab).toBe('inspect')
  })

  it('opening a cut or a range shows the Section tab; the Maths tab alone requests worked steps', () => {
    useStore.getState().setPaneTab('results')
    useStore.getState().toggleSawAt(3)
    expect(useStore.getState().paneTab).toBe('section')
    useStore.getState().setPaneTab('results')
    useStore.getState().setIntegrationRange([1, 2])
    expect(useStore.getState().paneTab).toBe('section')
    useStore.getState().setPaneTab('maths')
    expect(useStore.getState().showWorking).toBe(true)
    useStore.getState().setPaneTab('inspect')
    expect(useStore.getState().showWorking).toBe(false)
  })
})
