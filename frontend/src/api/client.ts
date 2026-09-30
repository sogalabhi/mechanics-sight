import type { AnalysisResult, BeamInput } from '@/model/types'

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** POST the beam; throws ApiError for a solver error, TypeError/AbortError otherwise. */
export async function analyze(beam: BeamInput, signal?: AbortSignal): Promise<AnalysisResult> {
  const res = await fetch('/api/v1/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(beam),
    signal,
  })
  if (res.ok) return (await res.json()) as AnalysisResult
  let body: { error?: { code: string; message: string } } | null = null
  try {
    body = await res.json()
  } catch {
    /* not JSON */
  }
  throw new ApiError(body?.error?.code ?? 'http_' + res.status, body?.error?.message ?? `Solver returned ${res.status}`)
}
