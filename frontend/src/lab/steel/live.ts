import { ApiError } from '@/api/client'
import { runTension } from './api'
import { effectiveHistory, fractureStrainOf, useLab } from './store'
import type { LabOp, TensionOut } from './types'

const THROTTLE_MS = 60
const RETRY_MS = [1000, 2000, 4000]
const CACHE_MAX = 60

let seq = 0
let ctrl: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastRun = 0
let retries = 0
const cache = new Map<string, TensionOut>()

const keyOf = (h: LabOp[]) => JSON.stringify(h)
const cacheGet = (k: string) => {
  const hit = cache.get(k)
  if (hit) {
    cache.delete(k)
    cache.set(k, hit)
  }
  return hit
}
const cacheSet = (k: string, v: TensionOut) => {
  cache.set(k, v)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
}

/** Ask for a history, answering from the cache when this exact history was seen before. */
async function solve(history: LabOp[], signal?: AbortSignal): Promise<TensionOut> {
  const k = keyOf(history)
  const hit = cacheGet(k)
  if (hit) return hit
  const out = await runTension(history, signal)
  cacheSet(k, out)
  return out
}

function schedule(delay = Math.max(0, THROTTLE_MS - (Date.now() - lastRun))) {
  clearTimeout(timer)
  timer = setTimeout(run, delay)
}

async function run() {
  lastRun = Date.now()
  const history = effectiveHistory(useLab.getState())
  ctrl?.abort()
  ctrl = new AbortController()
  const mine = ++seq
  try {
    const out = await solve(history, ctrl.signal)
    if (mine !== seq) return
    retries = 0
    useLab.getState().setResponse(out)
    void loadReference()
  } catch (e) {
    if (mine !== seq || (e instanceof DOMException && e.name === 'AbortError')) return
    if (e instanceof ApiError) {
      useLab.getState().setError({ kind: 'solver', message: e.message })
    } else {
      useLab.getState().setError({ kind: 'network', message: "Can't reach the solver, retrying…" })
      if (retries < RETRY_MS.length) schedule(RETRY_MS[retries++])
    }
  }
}

let referenceFor: number | null = null
/** The whole loading path to fracture: drawn faintly as the material curve, and replayed by Play. */
async function loadReference() {
  const s = useLab.getState()
  const f = fractureStrainOf(s)
  if (s.reference || referenceFor === f) return
  referenceFor = f
  try {
    useLab.getState().setReference(await solve([{ op: 'strain', to: f }]))
  } catch {
    referenceFor = null // the faint curve and Play are optional; try again with the next response
  }
}

/** Re-solve whenever the loading history or a drag in progress changes. Returns an unsubscribe. */
export function startLabLive(): () => void {
  fetch('/api/v1/health').catch(() => {})
  useLab.getState().setAnalyzing(true)
  schedule(0)
  const unsub = useLab.subscribe((s, prev) => {
    if (s.history !== prev.history || s.gesture !== prev.gesture) {
      if (keyOf(effectiveHistory(s)) === keyOf(effectiveHistory(prev))) return
      seq++
      ctrl?.abort()
      retries = 0
      s.setAnalyzing(true)
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
