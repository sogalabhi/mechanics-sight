import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AnalysisResult, BeamInput } from '@/model/types'

vi.stubGlobal('window', { location: { hash: '' } })
vi.mock('./client', () => ({ analyze: vi.fn(), ApiError: class extends Error {} }))
const { analyze } = await import('./client')
const { useStore } = await import('@/store/store')
const { startLiveAnalysis } = await import('./live')
const request = vi.mocked(analyze)
const initial: BeamInput = {
  schema_version: 1, length: 6,
  supports: [{ id: 'a', type: 'fixed', position: 0 }], loads: [],
}
let stop: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10000)
  request.mockReset()
  useStore.setState({ beam: initial, draft: null, result: null, error: null, past: [], future: [] })
})
afterEach(() => { stop?.(); vi.useRealTimers() })

it('throttles draft requests to 80 ms and sends the final state', async () => {
  request.mockReturnValue(new Promise(() => {}))
  stop = startLiveAnalysis()
  await vi.advanceTimersByTimeAsync(0)
  expect(request).toHaveBeenCalledTimes(1)
  for (let i = 1; i <= 9; i++) {
    await vi.advanceTimersByTimeAsync(10)
    useStore.getState().setDraft({ ...initial, length: 6 + i })
  }
  expect(request).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(70)
  expect(request).toHaveBeenCalledTimes(3)
  expect(request.mock.calls[2][0].length).toBe(15)
})

it('rejects a stale response during the throttle delay, even if abort is ignored', async () => {
  let resolve!: (result: AnalysisResult) => void
  request.mockReturnValueOnce(new Promise((r) => { resolve = r }))
  stop = startLiveAnalysis()
  await vi.advanceTimersByTimeAsync(0)
  useStore.getState().setDraft({ ...initial, length: 7 })
  expect(request.mock.calls[0][1]?.aborted).toBe(true)
  resolve({ segments: [] } as unknown as AnalysisResult)
  await Promise.resolve()
  expect(useStore.getState().result).toBeNull()
})

it('cancellation restores the committed beam and creates no history', async () => {
  request.mockReturnValue(new Promise(() => {}))
  stop = startLiveAnalysis()
  await vi.advanceTimersByTimeAsync(0)
  useStore.getState().setDraft({ ...initial, length: 7 })
  await vi.advanceTimersByTimeAsync(80)
  useStore.getState().setDraft(null)
  await vi.advanceTimersByTimeAsync(80)
  expect(request.mock.calls.at(-1)?.[0]).toBe(initial)
  expect(useStore.getState().past).toHaveLength(0)
})
