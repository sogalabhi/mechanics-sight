import { describe, expect, it } from 'vitest'
import { decodeHistory, encodeHistory, historyFromHash, isLabHash } from './share'
import type { LabOp } from './types'

const history: LabOp[] = [{ op: 'strain', to: 0.05 }, { op: 'unload_to_zero_stress' }, { op: 'strain', to: 0.06 }, { op: 'reset' }]

describe('lab share links', () => {
  it('round-trips a history', () => {
    expect(decodeHistory(encodeHistory(history))).toEqual(history)
    expect(decodeHistory(encodeHistory([]))).toEqual([])
  })

  it('reads a history from a lab hash and ignores other hashes', () => {
    expect(historyFromHash(`#/lab/steel?h=${encodeHistory(history)}`)).toEqual(history)
    expect(historyFromHash('#/lab/steel')).toBeNull()
    expect(historyFromHash('#beam=abc')).toBeNull()
  })

  it('recognises the lab route', () => {
    expect(isLabHash('#/lab/steel')).toBe(true)
    expect(isLabHash('#/lab/steel?h=x')).toBe(true)
    expect(isLabHash('#/lab/steelwool')).toBe(false)
    expect(isLabHash('#beam=1')).toBe(false)
    expect(isLabHash('')).toBe(false)
  })

  it('rejects anything that is not a valid history', () => {
    const enc = (v: unknown) => encodeHistory(v as LabOp[])
    expect(decodeHistory('not a valid payload')).toBeNull()
    expect(decodeHistory(enc({ op: 'strain', to: 1 }))).toBeNull() // not a list
    expect(decodeHistory(enc([{ op: 'strain' }]))).toBeNull() // missing field
    expect(decodeHistory(enc([{ op: 'strain', to: 'x' }]))).toBeNull() // wrong type
    expect(decodeHistory(enc([{ op: 'strain', to: 0.1, extra: 1 }]))).toBeNull() // extra field
    expect(decodeHistory(enc([{ op: 'stretch', to: 0.1 }]))).toBeNull() // unknown op
    expect(decodeHistory(enc([{ op: 'reset', to: 0.1 }]))).toBeNull()
    expect(decodeHistory(enc(Array.from({ length: 501 }, () => ({ op: 'reset' }))))).toBeNull() // too long
  })
})
