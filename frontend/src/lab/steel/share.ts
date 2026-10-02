import LZString from 'lz-string'
import type { LabOp } from './types'

export const LAB_ROUTE = '#/lab/steel'
const MAX_OPS = 500

export const isLabHash = (hash: string): boolean => hash === LAB_ROUTE || hash.startsWith(LAB_ROUTE + '?')

const valid = (o: unknown): o is LabOp => {
  if (typeof o !== 'object' || o === null) return false
  const x = o as Record<string, unknown>
  if (x.op === 'strain') return typeof x.to === 'number' && Number.isFinite(x.to) && Object.keys(x).length === 2
  return (x.op === 'unload_to_zero_stress' || x.op === 'reset') && Object.keys(x).length === 1
}

export function encodeHistory(history: LabOp[]): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(history))
}

export function decodeHistory(s: string): LabOp[] | null {
  try {
    const raw: unknown = JSON.parse(LZString.decompressFromEncodedURIComponent(s) ?? '')
    return Array.isArray(raw) && raw.length <= MAX_OPS && raw.every(valid) ? raw : null
  } catch {
    return null
  }
}

/** The loading history stored in a lab hash, or null if there is none or it is not valid. */
export function historyFromHash(hash: string): LabOp[] | null {
  const m = hash.match(/^#\/lab\/steel\?h=(.+)$/)
  return m ? decodeHistory(m[1]) : null
}

export const labUrl = (history: LabOp[]): string =>
  `${location.origin}${location.pathname}${LAB_ROUTE}${history.length ? '?h=' + encodeHistory(history) : ''}`
