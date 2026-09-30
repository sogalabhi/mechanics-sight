/** 1-2-5 grid step close to L/100, never below 1 mm. */
export function gridStep(length: number): number {
  const raw = Math.max(length / 100, 0.001)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const pick = [1, 2, 5, 10].reduce((best, c) => (Math.abs(c - norm) < Math.abs(best - norm) ? c : best))
  return Math.round(pick * mag * 1e6) / 1e6
}
