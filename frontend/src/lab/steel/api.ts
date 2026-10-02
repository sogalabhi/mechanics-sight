import { ApiError } from '@/api/client'
import type { LabOp, TensionIn, TensionOut } from './types'
import { PRESET, SPECIMEN } from './types'

export function requestFor(history: LabOp[]): TensionIn {
  return { schema_version: 1, preset: PRESET, specimen: { ...SPECIMEN }, history }
}

/** POST the loading history; throws ApiError for a solver or validation error, TypeError/AbortError otherwise. */
export async function runTension(history: LabOp[], signal?: AbortSignal): Promise<TensionOut> {
  const res = await fetch('/api/v1/lab/tension', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestFor(history)),
    signal,
  })
  if (res.ok) return (await res.json()) as TensionOut
  let body: { error?: { code: string; message: string } } | null = null
  try {
    body = await res.json()
  } catch {
    /* not JSON */
  }
  throw new ApiError(body?.error?.code ?? 'http_' + res.status, body?.error?.message ?? `Solver returned ${res.status}`)
}
