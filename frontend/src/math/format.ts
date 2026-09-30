const MINUS = '−'
const THIN = ' '

function fixed(v: number, decimals: number): string {
  const s = Math.abs(v).toFixed(decimals)
  // avoid "−0.000"
  const neg = v < 0 && Number(s) !== 0
  return (neg ? MINUS : '') + s
}

/** Fixed decimals with a true minus and an optional explicit plus. */
export function formatNumber(v: number, opts: { decimals?: number; sign?: boolean } = {}): string {
  const { decimals = 3, sign = false } = opts
  const s = fixed(v, decimals)
  return sign && !s.startsWith(MINUS) ? '+' + s : s
}

/** Number followed by a thin space and its unit, e.g. "3.000 m". */
export function formatQty(
  v: number,
  unit: string,
  opts: { decimals?: number; sign?: boolean } = {},
): string {
  return `${formatNumber(v, opts)}${THIN}${unit}`
}

/** Drawing label: magnitude only, up to 3 decimals, trailing zeros removed. */
export function formatLabel(v: number, unit: string): string {
  const s = fixed(Math.abs(v), 3).replace(/\.?0+$/, '')
  return `${s}${THIN}${unit}`
}

/** Axis tick: up to 3 decimals, trailing zeros removed, true minus. */
export function formatTick(v: number): string {
  const s = fixed(v, 3).replace(/\.?0+$/, '')
  return s === '' || s === MINUS ? '0' : s
}
