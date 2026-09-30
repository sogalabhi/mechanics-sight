/** Profile height (px) of a distributed load: 10 + 34·|w| / w_max, and 0 where w = 0. */
export const loadHeight = (w: number, wMax: number) => (w === 0 || wMax === 0 ? 0 : 10 + (34 * Math.abs(w)) / wMax)
