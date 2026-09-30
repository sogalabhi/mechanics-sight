import type { BeamInput } from './types'

/** Accepts a saved / shared beam of any known version; returns null if unusable. */
export function migrate(raw: unknown): BeamInput | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Partial<BeamInput>
  if (b.schema_version !== 1) return null
  if (typeof b.length !== 'number' || !Array.isArray(b.supports)) return null
  return {
    schema_version: 1,
    length: b.length,
    supports: b.supports,
    loads: Array.isArray(b.loads) ? b.loads : [],
    hinges: Array.isArray(b.hinges) ? b.hinges : [],
  }
}
