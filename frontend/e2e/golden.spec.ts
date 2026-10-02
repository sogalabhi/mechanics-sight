import { expect, test, type Page } from '@playwright/test'

/**
 * Golden cases: what the UI shows (value, sign, unit, place) must equal the hand-solved numbers.
 * Expected values come from plan.md section 8.1 and from textbook formulas, never from the app's own output.
 * kN, m, kN·m; reactions and applied couples anticlockwise +, sagging +, shear = sum of forces left of the cut.
 */

const TOL = 6e-4 // the UI prints 3 decimals

const num = (s: string) => Number(s.replace('−', '-').replace(/[+\s ]/g, ''))
const norm = (s: string) => s.replace(/[\s ]+/g, ' ').trim()

async function load(page: Page, key: string) {
  await page.goto('/')
  await page.getByLabel('Examples', { exact: true }).selectOption(key)
  await page.getByRole('tab', { name: 'Results' }).click()
  await expect(page.locator('aside table').first()).toBeVisible()
}

/** Reactions table: one [fx, fy, moment] per support, in support order. */
async function reactions(page: Page): Promise<number[][]> {
  const rows = page.locator('aside table').first().locator('tbody tr')
  const n = await rows.count()
  const out: number[][] = []
  for (let i = 0; i < n; i++) {
    const cells = await rows.nth(i).locator('td').allTextContents()
    out.push(cells.slice(1).map(num))
  }
  return out
}

/** One Extremes row as { value, x, unit, signed }, or null when the row is absent. */
async function extreme(page: Page, label: string) {
  const row = page.locator('aside button', { hasText: label }).filter({ hasText: '@' }).first()
  if ((await row.count()) === 0) return null
  const text = norm(await row.innerText())
  const m = text.match(/([+−-][\d.]+) (kN·m|kN|MPa|mm) @ ([\d.]+) m/)
  if (!m) throw new Error(`Unreadable extreme row: ${text}`)
  return { value: num(m[1]), sign: m[1][0], unit: m[2], x: num(m[3]) }
}

/** Put the pin at x metres with the keyboard: Home, then 0.25 m (Shift) and 0.05 m steps. */
async function pinAt(page: Page, x: number) {
  await page.locator('[aria-label^="Beam and diagrams"]').focus()
  await page.keyboard.press('Home')
  for (let i = 0; i < Math.floor(x / 0.25 + 1e-9); i++) await page.keyboard.press('Shift+ArrowRight')
  const rest = Math.round((x - Math.floor(x / 0.25 + 1e-9) * 0.25) / 0.05)
  for (let i = 0; i < rest; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('footer')).toContainText(`x = ${x.toFixed(3)} m`)
}

/** Status bar readout: V and M, each one number or a "left / right" pair at a jump. */
async function readout(page: Page) {
  const text = norm(await page.locator('footer').innerText())
  const m = text.match(/V = (.+?) kN M = (.+?) kN·m/)
  if (!m) throw new Error(`Unreadable status bar: ${text}`)
  return { v: m[1].split(' / ').map(num), m: m[2].split(' / ').map(num), raw: m[0] }
}

const close = (got: number[], want: number[]) => {
  expect(got.length).toBe(want.length)
  got.forEach((g, i) => expect(Math.abs(g - want[i])).toBeLessThanOrEqual(TOL))
}

interface Case {
  key: string
  /** per support, in support order: [fx, fy, reaction moment] */
  R: number[][]
  sag?: [number, number]
  hog?: [number, number]
  vmax?: number
  vmin?: number
  /** pinned readouts: x -> V, M (one value, or left/right at a jump) */
  at?: { x: number; V: number[]; M: number[] }[]
}

const s3 = Math.sqrt(3)
const CASES: Case[] = [
  { key: '01_ss_central_point', R: [[0, 5, 0], [0, 5, 0]], sag: [15, 3], vmax: 5, vmin: -5,
    at: [{ x: 3, V: [5, -5], M: [15] }, { x: 1.5, V: [5], M: [7.5] }] },
  { key: '02_ss_full_udl', R: [[0, 6, 0], [0, 6, 0]], sag: [9, 3], vmax: 6, vmin: -6,
    at: [{ x: 3, V: [0], M: [9] }, { x: 2, V: [2], M: [8] }] },
  { key: '03_cantilever_left_udl', R: [[0, 12, 24]], hog: [-24, 0], vmax: 12,
    at: [{ x: 2, V: [6], M: [-6] }] },
  { key: '04_cantilever_right_point', R: [[0, 5, -20]], hog: [-20, 4], vmin: -5,
    at: [{ x: 2, V: [-5], M: [-10] }] },
  { key: '05_overhang_point', R: [[0, -5, 0], [0, 15, 0]], hog: [-20, 4], vmax: 10, vmin: -5,
    at: [{ x: 2, V: [-5], M: [-10] }, { x: 5, V: [10], M: [-10] }] },
  { key: '06_ss_clockwise_couple', R: [[0, -2, 0], [0, 2, 0]], sag: [8, 2], hog: [-4, 2], vmin: -2,
    at: [{ x: 2, V: [-2], M: [-4, 8] }] },
  { key: '07_ss_triangular', R: [[0, 3, 0], [0, 6, 0]], sag: [4 * s3, 6 / s3] },
  { key: '08_ss_partial_udl', R: [[0, 8, 0], [0, 8, 0]], sag: [24, 4] },
  { key: '09_load_on_support', R: [[0, 10, 0], [0, 0, 0]] },
  { key: '10_cantilever_couple_free_end', R: [[0, 0, -8]], sag: [8, 0], at: [{ x: 2, V: [0], M: [8] }] },
  { key: '11_no_loads', R: [[0, 0, 0], [0, 0, 0]] },
  { key: '12_pin_pin', R: [[0, 5, 0], [0, 5, 0]], sag: [15, 3] },
  // textbook formulas: propped cantilever 5wL/8, 3wL/8, wL²/8, 9wL²/128 at 3L/8 from the roller
  { key: '17_propped_cantilever_udl', R: [[0, 37.5, 45], [0, 22.5, 0]], sag: [25.3125, 3.75], hog: [-45, 0], vmax: 37.5, vmin: -22.5 },
  // fixed-fixed: wL/2, wL²/12 at the ends, wL²/24 at midspan
  { key: '18_fixed_fixed_udl', R: [[0, 30, 30], [0, 30, -30]], sag: [15, 3], hog: [-30, 0] },
  // two equal spans, UDL: 3wL/8, 10wL/8, 3wL/8; M_B = −wL²/8; span moment 9wL²/128 at 3L/8
  { key: '19_continuous_two_span', R: [[0, 15, 0], [0, 50, 0], [0, 15, 0]], sag: [11.25, 1.5], hog: [-20, 4] },
  // fixed-fixed, central point load: P/2 and PL/8 at the ends and at midspan
  { key: '20_fixed_fixed_point_load', R: [[0, 6, 9], [0, 6, -9]], sag: [9, 3], hog: [-9, 0] },
]

for (const c of CASES) {
  test(`golden ${c.key}: reactions, extremes, signs and units`, async ({ page }) => {
    await load(page, c.key)

    const got = await reactions(page)
    expect(got.length).toBe(c.R.length)
    got.forEach((row, i) => close(row, c.R[i]))

    for (const [label, want, unit] of [
      ['M max (sagging)', c.sag, 'kN·m'],
      ['M min (hogging)', c.hog, 'kN·m'],
    ] as const) {
      const e = await extreme(page, label)
      if (!want) {
        expect(e, `${label} should not be reported`).toBeNull()
        continue
      }
      expect(e, `${label} missing`).not.toBeNull()
      expect(e!.unit).toBe(unit)
      expect(Math.abs(e!.value - want[0])).toBeLessThanOrEqual(TOL)
      expect(e!.sign).toBe(want[0] < 0 ? '−' : '+')
      expect(Math.abs(e!.x - want[1])).toBeLessThanOrEqual(TOL)
    }
    for (const [label, want] of [['V max', c.vmax], ['V min', c.vmin]] as const) {
      const e = await extreme(page, label)
      if (want === undefined) continue
      expect(e, `${label} missing`).not.toBeNull()
      expect(e!.unit).toBe('kN')
      expect(Math.abs(e!.value - want)).toBeLessThanOrEqual(TOL)
      expect(e!.sign).toBe(want < 0 ? '−' : '+')
    }

    for (const p of c.at ?? []) {
      await pinAt(page, p.x)
      const r = await readout(page)
      close(r.v, p.V)
      close(r.m, p.M)
    }
  })
}

test('golden: the extreme row pins the cut at the extreme (triangular load, x = 6/√3)', async ({ page }) => {
  await load(page, '07_ss_triangular')
  await page.locator('aside button', { hasText: 'M max (sagging)' }).click()
  const r = await readout(page)
  close(r.v, [0])
  close(r.m, [4 * s3])
  await expect(page.locator('footer')).toContainText('x = 3.464 m')
})

test('golden: the Section tab agrees with the diagrams at x = 2 (UDL, w = 2, L = 6)', async ({ page }) => {
  await load(page, '02_ss_full_udl')
  await pinAt(page, 2)
  await page.keyboard.press('s')
  await expect(page.getByRole('tab', { name: 'Section' })).toHaveAttribute('aria-selected', 'true')
  const pane = norm(await page.locator('aside').last().innerText())
  expect(pane).toMatch(/V_cut: \+2\.000 kN/)
  expect(pane).toMatch(/M_cut: \+8\.000 kN·m/)
})

// Physical values: E = 200 GPa, default section 0.2 × 0.3 m, so EI = 90 000 kN·m² and Z = I/c = 3 × 10⁻³ m³.
const PHYSICAL = [
  // SS, P = 10 at midspan: δ = PL³/48EI = 0.5 mm down; σ = M/Z = 15/3e-3 kPa = 5 MPa
  { key: '01_ss_central_point', delta: -0.5, x: 3, sigma: 5 },
  // SS, UDL 2: δ = 5wL⁴/384EI = 0.375 mm down; σ = 9/3e-3 kPa = 3 MPa
  { key: '02_ss_full_udl', delta: -0.375, x: 3, sigma: 3 },
  // cantilever, UDL 3 over 4 m: δ = wL⁴/8EI = 1.0667 mm down at the tip; σ = 24/3e-3 kPa = 8 MPa
  { key: '03_cantilever_left_udl', delta: -1.0667, x: 4, sigma: 8 },
]
for (const p of PHYSICAL) {
  test(`golden physical ${p.key}: deflection is negative (downward) and stress is ±M/Z`, async ({ page }) => {
    await load(page, p.key)
    await page.getByRole('tab', { name: 'Inspect' }).click()
    await page.getByLabel('Enable physical properties').check()
    await page.getByRole('tab', { name: 'Results' }).click()
    const d = await extreme(page, 'Maximum |δ|')
    expect(d, 'deflection row missing').not.toBeNull()
    expect(d!.unit).toBe('mm')
    expect(d!.sign).toBe('−')
    expect(Math.abs(d!.value - p.delta)).toBeLessThanOrEqual(2e-3)
    expect(Math.abs(d!.x - p.x)).toBeLessThanOrEqual(TOL)
    const t = await extreme(page, 'Max tension')
    const c = await extreme(page, 'Max compression')
    expect(t!.unit).toBe('MPa')
    expect(t!.sign).toBe('+')
    expect(Math.abs(t!.value - p.sigma)).toBeLessThanOrEqual(2e-3)
    expect(c!.sign).toBe('−')
    expect(Math.abs(c!.value + p.sigma)).toBeLessThanOrEqual(2e-3)
  })
}
