import { describe, expect, it } from 'vitest'
import { formatLabel, formatNumber, formatQty } from './format'

describe('format', () => {
  it('uses a true minus sign', () => {
    expect(formatNumber(-5)).toBe('−5.000')
  })
  it('adds explicit plus only when asked', () => {
    expect(formatNumber(5, { sign: true })).toBe('+5.000')
    expect(formatNumber(5)).toBe('5.000')
  })
  it('never shows negative zero', () => {
    expect(formatNumber(-0.0001)).toBe('0.000')
    expect(formatNumber(-0.0001, { sign: true })).toBe('+0.000')
  })
  it('puts a thin space before the unit', () => {
    expect(formatQty(3, 'm')).toBe('3.000 m')
  })
  it('trims label zeros and drops the sign', () => {
    expect(formatLabel(-10, 'kN')).toBe('10 kN')
    expect(formatLabel(2.5, 'kN/m')).toBe('2.5 kN/m')
  })
})
