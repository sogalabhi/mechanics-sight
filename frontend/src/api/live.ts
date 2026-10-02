import { useStore } from '@/store/store'
import type { AnalysisResult } from '@/model/types'
import { analyze, ApiError } from './client'

const THROTTLE_MS = 80
const RETRY_MS = [1000, 2000, 4000]

let seq = 0
let ctrl: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastRun = 0
let retries = 0

// Remember solved beams so switching back to an example (or undoing) answers at once.
const CACHE_MAX = 40
const cache = new Map<string, AnalysisResult>()
const cacheGet = (key: string) => {
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
  }
  return hit
}
const cacheSet = (key: string, value: AnalysisResult) => {
  cache.set(key, value)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
}

function schedule(delay = Math.max(0, THROTTLE_MS - (Date.now() - lastRun))) {
  clearTimeout(timer)
  timer = setTimeout(run, delay)
}

async function run() {
  lastRun = Date.now()
  const state = useStore.getState()
  const { showWorking, selectedMethod, setResult, setError } = state
  const beam = state.draft ?? state.beam
  ctrl?.abort()
  if (beam.supports.length === 0) {
    seq++
    setResult(null)
    return
  }
  const key = JSON.stringify([beam, showWorking, selectedMethod])
  const hit = cacheGet(key)
  if (hit) {
    seq++
    retries = 0
    setResult(hit)
    return
  }
  ctrl = new AbortController()
  const mine = ++seq
  try {
    const result = await analyze(beam, ctrl.signal, showWorking, selectedMethod)
    if (mine !== seq) return
    retries = 0
    cacheSet(key, result)
    setResult(result)
    useStore.getState().setStepsUnsupported(showWorking && !result.steps)
  } catch (e) {
    if (mine !== seq || (e instanceof DOMException && e.name === 'AbortError')) return
    if (e instanceof ApiError) {
      setError({ kind: 'beam', message: e.message })
    } else {
      setError({ kind: 'network', message: "Can't reach the solver — retrying…" })
      if (retries < RETRY_MS.length) schedule(RETRY_MS[retries++])
    }
  }
}

/** Re-analyse whenever the beam changes. Returns an unsubscribe function. */
export function startLiveAnalysis(): () => void {
  // Wake a cold serverless solver while the page is still loading.
  fetch('/api/v1/health').catch(() => {})
  if (useStore.getState().beam.supports.length > 0) useStore.getState().setAnalyzing(true)
  schedule(0)
  const unsub = useStore.subscribe((s, prev) => {
    if (
      s.beam !== prev.beam ||
      s.draft !== prev.draft ||
      s.showWorking !== prev.showWorking ||
      s.selectedMethod !== prev.selectedMethod
    ) {
      // Invalidate immediately, before the next throttled request starts.
      seq++
      ctrl?.abort()
      retries = 0
      if ((s.draft ?? s.beam).supports.length > 0) s.setAnalyzing(true)
      schedule()
    }
  })
  return () => {
    unsub()
    clearTimeout(timer)
    seq++
    ctrl?.abort()
  }
}
