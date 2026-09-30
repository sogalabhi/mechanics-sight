import LZString from 'lz-string'
import { validateBeam } from './actions'
import { migrate } from './migrate'
import type { BeamInput } from './types'

const PREFIX = '#beam='

export function encodeBeam(beam: BeamInput): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(beam))
}

export function decodeBeam(s: string): BeamInput | null {
  try {
    const beam = migrate(JSON.parse(LZString.decompressFromEncodedURIComponent(s) ?? ''))
    return beam && validateBeam(beam) === null ? beam : null
  } catch {
    return null
  }
}

export function beamFromHash(hash: string): BeamInput | null {
  return hash.startsWith(PREFIX) ? decodeBeam(hash.slice(PREFIX.length)) : null
}

export function shareUrl(beam: BeamInput): string {
  return `${location.origin}${location.pathname}${PREFIX}${encodeBeam(beam)}`
}
