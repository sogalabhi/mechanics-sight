/** 1-2-5 grid step close to L/100, never below 1 mm. */
export function gridStep(length: number): number {
  const raw = Math.max(length / 100, 0.001)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const pick = [1, 2, 5, 10].reduce((best, c) => (Math.abs(c - norm) < Math.abs(best - norm) ? c : best))
  return Math.round(pick * mag * 1e6) / 1e6
}

/** Prefer the nearest existing point within 8 screen pixels; Alt leaves only mm rounding. */
export function snapPosition(position: number, length: number, points: number[], pxPerM: number, alt = false): number {
  const clamped = Math.min(length, Math.max(0, position))
  let at = clamped
  if (!alt) {
    const nearest = points.reduce<number | null>((best, p) =>
      best === null || Math.abs(p - clamped) < Math.abs(best - clamped) ? p : best, null)
    if (nearest !== null && Math.abs(nearest - clamped) * pxPerM <= 8) at = nearest
    else {
      const step = gridStep(length)
      at = Math.round(clamped / step) * step
    }
  }
  return Math.round(Math.min(length, Math.max(0, at)) * 1000) / 1000
}
