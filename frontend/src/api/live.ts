import { useStore } from '@/store/store'
import { analyze, ApiError } from './client'

const THROTTLE_MS = 80
const RETRY_MS = [1000, 2000, 4000]

let seq = 0
let ctrl: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastRun = 0
let retries = 0

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
  ctrl = new AbortController()
  const mine = ++seq
  try {
    const result = await analyze(beam, ctrl.signal, showWorking, selectedMethod)
    if (mine !== seq) return
    retries = 0
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
