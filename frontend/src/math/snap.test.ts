import { expect, it } from 'vitest'
import { gridStep } from './snap'

it('scales with length in 1-2-5 steps', () => {
  expect(gridStep(6)).toBe(0.05)
  expect(gridStep(10)).toBe(0.1)
  expect(gridStep(1000)).toBe(10)
})
it('never goes below 1 mm', () => {
  expect(gridStep(0.1)).toBe(0.001)
})
