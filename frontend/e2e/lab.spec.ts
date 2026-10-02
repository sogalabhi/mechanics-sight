import { expect, test, type Page } from '@playwright/test'
import LZString from 'lz-string'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Steel Material Lab, through the real UI and the real backend.
 * Expected values come from shared/fixtures/lab (hand-solved, see docs/STEEL_LAB_CONTRACT.md).
 * The UI prints stress with 1 decimal and every other number with 3, so tolerances follow the display.
 */

const DIR = resolve('../shared/fixtures/lab')
const FIXTURES = readdirSync(DIR)
  .filter((f) => /^L\d+.*\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(resolve(DIR, f), 'utf8')))

type Op = { op: 'strain'; to: number } | { op: 'unload_to_zero_stress' } | { op: 'reset' }
const num = (s: string) => Number(s.replace('−', '-').replace(/[+\s ]/g, ''))

async function open(page: Page, hash = '#/lab/steel') {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/' + hash)
  await settled(page)
  return errors
}
const settled = (page: Page) => expect(page.locator('[data-busy="false"]')).toBeVisible()

async function readouts(page: Page): Promise<Record<string, number>> {
  const pairs = await page.locator('[data-readout]').evaluateAll((els) =>
    els.map((e) => [(e as HTMLElement).dataset.readout as string, e.querySelector('[data-value]')?.textContent ?? '']),
  )
  return Object.fromEntries(pairs.map(([k, v]) => [k, num(v)]))
}
const explanation = (page: Page) => page.getByTestId('explanation')

/** The loading history recorded in the address bar (what a shared link would restore). */
const historyOf = (page: Page): Op[] => {
  const h = new URL(page.url()).hash.match(/\?h=(.+)$/)?.[1]
  return h ? JSON.parse(LZString.decompressFromEncodedURIComponent(h) ?? '[]') : []
}

async function apply(page: Page, op: Op) {
  if (op.op === 'strain') {
    const field = page.getByRole('textbox', { name: 'Strain' })
    await field.fill((op.to * 100).toPrecision(12))
    await field.press('Enter')
  } else if (op.op === 'unload_to_zero_stress') {
    await page.getByRole('button', { name: 'Unload' }).click()
  } else {
    await page.getByRole('button', { name: 'Reset specimen' }).click()
  }
  await settled(page)
}

// ---- every hand-solved fixture, driven through the UI ---------------------------------------
for (const fixture of FIXTURES) {
  test(`golden ${fixture.name}: readouts, region and point agree with the hand solution`, async ({ page }) => {
    const errors = await open(page)
    const history = fixture.input.history as Op[]

    if (fixture.expected_error) {
      // The UI refuses these before they reach the server, with a message that says why.
      for (const op of history.slice(0, -1)) await apply(page, op)
      const last = history[history.length - 1] as { to: number }
      const field = page.getByRole('textbox', { name: 'Strain' })
      await field.fill((last.to * 100).toPrecision(12))
      await field.press('Enter')
      await expect(page.getByText(fixture.expected_error === 'strain_out_of_range' ? /Must be between 0 and 25\.000 %/ : /specimen has broken/)).toBeVisible()
      expect(errors).toEqual([])
      return
    }

    for (const op of history) {
      // L20 asks the server to clamp a move below zero stress; the UI refuses it first with a message.
      if (fixture.case === 'L20' && op === history[history.length - 1]) {
        const field = page.getByRole('textbox', { name: 'Strain' })
        await field.fill((op as { to: number }).to === 0.01 ? '1' : String((op as { to: number }).to * 100))
        await field.press('Enter')
        await expect(page.getByText(/Below the permanent strain/)).toBeVisible()
        const r = await readouts(page)
        expect(r.stress).toBeCloseTo(317.7, 1) // unchanged
        return
      }
      await apply(page, op)
    }

    const e = fixture.expected
    const r = await readouts(page)
    expect(Math.abs(r.stress - e.stress_mpa)).toBeLessThanOrEqual(0.06)
    expect(Math.abs(r.strain - e.strain * 100)).toBeLessThanOrEqual(6e-4)
    expect(Math.abs(r.force - e.force_kn)).toBeLessThanOrEqual(6e-4)
    expect(Math.abs(r.extension - e.extension_mm)).toBeLessThanOrEqual(6e-4)
    expect(Math.abs(r.plastic - e.plastic_strain * 100)).toBeLessThanOrEqual(6e-4)
    expect(Math.abs(r.elastic - e.elastic_strain * 100)).toBeLessThanOrEqual(6e-4)
    expect(await page.locator('[data-readout] small').allTextContents()).toEqual(['MPa', '%', 'kN', 'mm', '%', '%'])
    await expect(explanation(page)).toHaveAttribute('data-region', e.region)
    await expect(explanation(page)).toHaveAttribute('data-landmark', e.landmark ?? '')
    const pressed = page.getByRole('button', { name: /^Go to point/, pressed: true })
    await expect(pressed).toHaveCount(e.landmark ? 1 : 0)
    if (e.stress_mpa > 0) await expect(page.locator('[data-readout="stress"] [data-value]')).toHaveText(/^\+/)
    if (r.stress < 0 || r.force < 0) throw new Error('a tension test must never show negative stress or force')
    expect(errors).toEqual([])
  })
}

// ---- interaction -----------------------------------------------------------------------------
test('a fresh specimen starts at zero with the preset on show', async ({ page }) => {
  await open(page)
  expect(await readouts(page)).toEqual({ stress: 0, strain: 0, force: 0, extension: 0, plastic: 0, elastic: 0 })
  await expect(explanation(page)).toHaveAttribute('data-region', 'elastic')
  await expect(page.getByText('educational idealisation')).toBeVisible()
  await expect(page.getByText('Mild steel, textbook curve')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unload' })).toBeDisabled()
})

test('the A to F buttons land exactly on their points', async ({ page }) => {
  await open(page)
  const want: [string, number, string][] = [
    ['A', 230, 'elastic'],
    ['B', 240, 'elastic_curving'],
    ['C', 265, 'yield_onset'],
    ['D', 250, 'yield_drop'],
    ['E', 400, 'strain_hardening'],
    ['F', 0, 'fractured'],
  ]
  for (const [id, stress, region] of want) {
    await page.getByRole('button', { name: new RegExp(`^Go to point ${id},`) }).click()
    await settled(page)
    expect(Math.abs((await readouts(page)).stress - stress)).toBeLessThanOrEqual(0.06)
    await expect(explanation(page)).toHaveAttribute('data-region', region)
    await expect(explanation(page)).toHaveAttribute('data-landmark', id)
    if (id === 'F') break
    // the next point is above the last, so no fresh specimen is needed except after D (C was passed)
  }
})

test('going back to a point already passed starts a fresh specimen and says so', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: /^Go to point E,/ }).click()
  await settled(page)
  await page.getByRole('button', { name: /^Go to point C,/ }).click()
  await settled(page)
  await expect(page.getByText(/Started a fresh specimen to show point C/)).toBeVisible()
  expect(Math.abs((await readouts(page)).stress - 265)).toBeLessThanOrEqual(0.06)
})

test('the strain field explains what it refuses', async ({ page }) => {
  await open(page)
  const field = page.getByRole('textbox', { name: 'Strain' })
  await field.fill('26')
  await field.press('Enter')
  await expect(page.getByText('Must be between 0 and 25.000 %')).toBeVisible()
  await field.fill('-1')
  await field.press('Enter')
  await expect(page.getByText('Must be between 0 and 25.000 %')).toBeVisible()
  expect((await readouts(page)).strain).toBe(0)
})

test('the slider moves the specimen (0.0312 strain at position 500) and drives the readouts', async ({ page }) => {
  await open(page)
  const slider = page.locator('#lab-strain-slider')
  await slider.evaluate((el: HTMLInputElement) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(el, '500')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await slider.blur() // ends the gesture
  await settled(page)
  const r = await readouts(page)
  expect(Math.abs(r.strain - 3.125)).toBeLessThanOrEqual(6e-4) // 0.25 * (500/1000)^3
  expect(Math.abs(r.stress - 283.9)).toBeLessThanOrEqual(0.06) // 400 - 150*((0.15-0.03125)/0.135)^2
  await expect(slider).toHaveAttribute('aria-valuetext', /% strain/)
})

test('Unload leaves the permanent strain; Reset is a fresh specimen, not an unload', async ({ page }) => {
  await open(page)
  await apply(page, { op: 'strain', to: 0.05 })
  await apply(page, { op: 'unload_to_zero_stress' })
  const unloaded = await readouts(page)
  expect(unloaded.stress).toBe(0)
  expect(Math.abs(unloaded.plastic - 4.841)).toBeLessThanOrEqual(6e-4)
  await expect(explanation(page)).toHaveAttribute('data-region', 'unloading')
  await apply(page, { op: 'reset' })
  expect(await readouts(page)).toEqual({ stress: 0, strain: 0, force: 0, extension: 0, plastic: 0, elastic: 0 })
})

test('after fracture every control except Reset is locked', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: /^Go to point F,/ }).click()
  await settled(page)
  await expect(page.locator('#lab-strain-slider')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Play to fracture' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Unload' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Go to point A,/ })).toBeDisabled()
  await expect(explanation(page)).toHaveAttribute('data-region', 'fractured')
  await page.getByRole('button', { name: 'Reset specimen' }).click()
  await settled(page)
  await expect(page.locator('#lab-strain-slider')).toBeEnabled()
})

test('Play replays the loading path and Pause settles on the backend value for that strain', async ({ page, request }) => {
  await open(page)
  await page.getByRole('button', { name: 'Play to fracture' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  // about 3 s in, the bar is on the yield plateau, where the readout's rounding of strain cannot move the stress
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'Pause' }).click()
  await settled(page)
  await expect(page.getByRole('button', { name: 'Play to fracture' })).toBeVisible()
  const r = await readouts(page)
  expect(r.strain).toBeGreaterThan(0)
  const res = await request.post('/api/v1/lab/tension', {
    data: { preset: 'steel_textbook', specimen: { diameter_mm: 10, gauge_length_mm: 50 }, history: [{ op: 'strain', to: r.strain / 100 }] },
  })
  const state = (await res.json()).state
  expect(Math.abs(r.stress - state.stress_mpa)).toBeLessThanOrEqual(0.06)
  expect(Math.abs(r.force - state.force_kn)).toBeLessThanOrEqual(6e-4)
  expect(Math.abs(r.plastic - state.plastic_strain * 100)).toBeLessThanOrEqual(6e-4)
})

test('Play can be left running to the break', async ({ page }) => {
  test.setTimeout(40_000)
  await open(page)
  await page.getByRole('button', { name: /^Go to point D,/ }).click()
  await settled(page)
  await page.getByRole('button', { name: 'Play to fracture' }).click()
  await expect(explanation(page)).toHaveAttribute('data-region', 'fractured', { timeout: 30_000 })
  await settled(page)
  expect((await readouts(page)).stress).toBe(0)
})

test('a shared link restores the loading history; a broken one falls back to a fresh specimen', async ({ page, context }) => {
  await open(page)
  await apply(page, { op: 'strain', to: 0.05 })
  await apply(page, { op: 'unload_to_zero_stress' })
  const url = page.url()
  expect(url).toContain('#/lab/steel?h=')
  const other = await context.newPage()
  await other.goto(url)
  await settled(other)
  const r = await readouts(other)
  expect(r.stress).toBe(0)
  expect(Math.abs(r.plastic - 4.841)).toBeLessThanOrEqual(6e-4)
  const broken = await context.newPage()
  await broken.goto('/#/lab/steel?h=not-a-valid-link')
  await settled(broken)
  expect((await readouts(broken)).strain).toBe(0)
})

test('the zoom switch rescales the curve to the elastic range', async ({ page }) => {
  await open(page)
  const curve = page.getByRole('img', { name: /stress–strain curve/ })
  await expect(curve.getByText('25', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zoom: elastic' }).click()
  await expect(curve.getByText('0.20', { exact: true })).toBeVisible()
  await expect(curve.getByText(/slope = E = 200 GPa/)).toBeVisible()
  await page.getByRole('button', { name: 'Full curve' }).click()
  await expect(curve.getByText('25', { exact: true })).toBeVisible()
})

test('the side pane explains the point and shows the maths in LaTeX with backend numbers', async ({ page }) => {
  await open(page)
  await apply(page, { op: 'strain', to: 0.05 })
  await page.getByRole('tab', { name: 'Maths' }).click()
  const pane = page.getByRole('tabpanel')
  // rendered by KaTeX, not plain text with symbols
  expect(await pane.locator('.katex').count()).toBeGreaterThanOrEqual(6)
  await expect(pane.locator('.katex-mathml, .katex-html').first()).toBeAttached()
  await expect(pane).not.toContainText('\\dfrac')
  await expect(pane).not.toContainText('\\sigma')
  await expect(pane).toContainText('317.70') // sigma, from the backend
  await expect(pane).toContainText('0.13500') // eps_u - eps_sh
  await expect(pane).toContainText('24952') // force in newtons
  await expect(pane).toContainText('24.952')
  await page.getByRole('tab', { name: 'Explain' }).click()
  await expect(pane).toContainText('Strain hardening')
  await page.getByRole('tab', { name: 'Preset' }).click()
  await expect(pane).toContainText('250 MPa')
  await expect(pane).toContainText('78.540 mm²')
})

test('proof strength: the explanation, the offset line, and the meaning of 0.2 % (residual strain)', async ({ page }) => {
  await open(page)
  const pane = page.getByRole('tabpanel')
  await page.getByRole('tab', { name: 'Explain' }).click()
  await expect(pane.getByRole('heading', { name: 'Proof strength (0.2 % offset)' })).toBeVisible()
  await expect(pane).toContainText('permanent')
  await expect(pane).toContainText('not the total strain')
  await expect(pane).toContainText('0.00325') // total strain at the proof point, from the backend
  await expect(pane).toContainText('250.0') // sigma_0.2
  expect(await pane.locator('.katex').count()).toBeGreaterThanOrEqual(5)
  await expect(pane).not.toContainText('**')
  await expect(pane).not.toContainText('$')

  // the offset line and the proof point appear on a zoomed curve
  const curve = page.getByRole('img', { name: /stress–strain curve/ })
  await expect(curve.getByText(/offset 0\.2 %/)).toHaveCount(0)
  await page.getByRole('button', { name: '0.2 % proof line' }).click()
  await expect(page.getByRole('button', { name: '0.2 % proof line' })).toHaveAttribute('aria-pressed', 'true')
  await expect(curve.getByText(/offset 0\.2 %/)).toBeVisible()
  await expect(curve.getByText(/σ0\.2 = 250 MPa/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom: elastic' })).toHaveAttribute('aria-pressed', 'true')

  // the maths tab works the proof point through
  await page.getByRole('tab', { name: 'Maths' }).click()
  await expect(pane.getByRole('heading', { name: 'Proof strength (0.2 % offset)' })).toBeVisible()
  await expect(pane).toContainText('0.00325')
  await expect(pane).toContainText('0.00200') // eps_p = eps - sigma/E

  // the definition, demonstrated: go to the proof point and unload; exactly 0.2 % stays
  await page.getByRole('button', { name: 'Go to the 0.2 % proof point' }).click()
  await settled(page)
  let r = await readouts(page)
  expect(Math.abs(r.stress - 250)).toBeLessThanOrEqual(0.06)
  expect(Math.abs(r.strain - 0.325)).toBeLessThanOrEqual(6e-4) // total strain 0.325 %
  expect(Math.abs(r.plastic - 0.2)).toBeLessThanOrEqual(6e-4) // of which 0.2 % is permanent
  await page.getByRole('button', { name: 'Unload' }).click()
  await settled(page)
  r = await readouts(page)
  expect(r.stress).toBe(0)
  expect(Math.abs(r.plastic - 0.2)).toBeLessThanOrEqual(6e-4)
  expect(Math.abs(r.strain - 0.2)).toBeLessThanOrEqual(6e-4) // the bar is 0.2 % longer than it began
  await page.getByRole('button', { name: '0.2 % proof line' }).click()
  await expect(curve.getByText(/offset 0\.2 %/)).toHaveCount(0)
})

// ---- the two workspaces ----------------------------------------------------------------------
test('switching between Beam and Steel keeps both states', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Examples', { exact: true }).selectOption('01_ss_central_point')
  await expect(page.getByText(/M (max|min) =/).first()).toBeVisible()
  const items = await page.locator('[data-item-id]').count()
  expect(items).toBeGreaterThan(0)

  await page.getByRole('group', { name: 'Workspace' }).getByRole('button', { name: 'Steel' }).click()
  await settled(page)
  await apply(page, { op: 'strain', to: 0.05 })
  await expect(page).toHaveURL(/#\/lab\/steel/)

  await page.getByRole('group', { name: 'Workspace' }).getByRole('button', { name: 'Beam' }).click()
  await expect(page.getByText(/M (max|min) =/).first()).toBeVisible()
  expect(await page.locator('[data-item-id]').count()).toBe(items)

  await page.getByRole('group', { name: 'Workspace' }).getByRole('button', { name: 'Steel' }).click()
  await settled(page)
  expect(Math.abs((await readouts(page)).strain - 5)).toBeLessThanOrEqual(6e-4)
})

// ---- errors, themes and small screens --------------------------------------------------------
test('an unreachable solver is reported and does not crash the page', async ({ page }) => {
  await page.route('**/api/v1/lab/tension', (route) => route.abort())
  await page.goto('/#/lab/steel')
  await expect(page.getByRole('alert')).toContainText("Can't reach the solver")
  await expect(page.getByText('Solving…').first()).toBeVisible()
})

test('a solver error is shown with a way out', async ({ page }) => {
  await page.route('**/api/v1/lab/tension', (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: { code: 'test_finished', message: 'the specimen has fractured; only a reset applies', details: {} } }) }),
  )
  await page.goto('/#/lab/steel')
  await expect(page.getByRole('alert')).toContainText('only a reset applies')
  await expect(page.getByRole('alert').getByRole('button', { name: 'Reset specimen' })).toBeVisible()
})

test('dark theme works with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const pageErrors = await open(page)
  await page.getByLabel('Theme').selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await apply(page, { op: 'strain', to: 0.15 })
  expect(errors).toEqual([])
  expect(pageErrors).toEqual([])
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('one view at a time, the workspace switch stays in reach, readouts are shown', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('group', { name: 'Workspace' })).toBeVisible()
    await expect(page.getByRole('img', { name: /Tension specimen/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /stress–strain curve/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Curve', exact: true }).click()
    await expect(page.getByRole('img', { name: /stress–strain curve/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /Tension specimen/ })).toHaveCount(0)
    await apply(page, { op: 'strain', to: 0.05 })
    expect((await readouts(page)).stress).toBeGreaterThan(300)
    const box = await page.getByRole('img', { name: /stress–strain curve/ }).boundingBox()
    expect(box!.width).toBeLessThanOrEqual(390)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test.describe('phone width: touch', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true })

  /** A real touch gesture on the slider, through the browser's input protocol. */
  async function drag(page: Page, path: number[]) {
    const slider = page.locator('#lab-strain-slider')
    await slider.scrollIntoViewIfNeeded()
    const box = (await slider.boundingBox())!
    const x = (u: number) => box.x + 8 + (u / 1000) * (box.width - 16) // 16 px thumb
    const y = box.y + box.height / 2
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: string, px?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: px === undefined ? [] : [{ x: px, y }] })
    await touch('touchStart', x(path[0]))
    for (const [i, u] of path.entries()) {
      if (i === 0) continue
      const from = path[i - 1]
      for (let k = 1; k <= 8; k++) await touch('touchMove', x(from + ((u - from) * k) / 8))
    }
    await touch('touchEnd')
  }

  test('a touch drag moves the specimen, and a reversal in the same drag is a real unloading', async ({ page }) => {
    await open(page)
    // up to slider 700 (strain 0.0858: strain hardening), then back to 450 without lifting the finger
    await drag(page, [0, 700, 450])
    await settled(page)
    const r = await readouts(page)
    await expect(explanation(page)).toHaveAttribute('data-region', 'unloading')
    expect(r.stress).toBe(0) // unloaded to zero stress: it cannot go below the permanent strain
    expect(r.plastic).toBeGreaterThan(5) // % permanent strain from the stretch to ~8.6 %
    expect(Math.abs(r.strain - r.plastic)).toBeLessThanOrEqual(6e-4)
    // exactly two moves were recorded: up, then back down
    const ops = historyOf(page)
    expect(ops.map((o) => o.op)).toEqual(['strain', 'strain'])
    expect((ops[0] as { to: number }).to).toBeGreaterThan((ops[1] as { to: number }).to)
  })

  test('a touch drag with small jitter is one loading move', async ({ page }) => {
    await open(page)
    await drag(page, [0, 600, 598, 601, 599, 700])
    await settled(page)
    const r = await readouts(page)
    await expect(explanation(page)).toHaveAttribute('data-region', 'strain_hardening')
    expect(r.stress).toBeGreaterThan(300)
    expect(Math.abs(r.strain - 8.58)).toBeLessThanOrEqual(0.6) // 0.25*(700/1000)^3 = 8.575 %, within a few slider steps
    await expect(page.locator('#lab-strain-slider')).toHaveAttribute('aria-valuetext', /% strain/)
    // the jitter left no trace: one recorded move, not five
    expect(historyOf(page)).toHaveLength(1)
  })

  test('the bottom sheet opens on a tab, shows the LaTeX without clipping the page, and folds away', async ({ page }) => {
    await open(page)
    const f = page.getByRole('textbox', { name: 'Strain' })
    await f.fill('5')
    await f.press('Enter')
    await settled(page)
    await expect(page.getByRole('tabpanel')).toHaveCount(0) // closed until a tab is tapped
    await page.getByRole('tab', { name: 'Maths' }).tap()
    const pane = page.getByRole('tabpanel')
    await expect(pane).toContainText('317.70')
    expect(await pane.locator('.katex').count()).toBeGreaterThanOrEqual(6)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    const clipped = await pane.locator('.katex-display').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)
    expect(clipped).toBe(0)
    await page.getByRole('tab', { name: 'Explain' }).tap()
    await expect(pane.getByRole('heading', { name: 'Proof strength (0.2 % offset)' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: 'Close the side pane' }).tap()
    await expect(page.getByRole('tabpanel')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Strain' })).toBeVisible() // the controls have their room back
  })
})

test('every control has an accessible name', async ({ page }) => {
  await open(page)
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('button, input, select')].filter((el) => {
      const e = el as HTMLElement
      const label = e.getAttribute('aria-label') || (e as HTMLInputElement).labels?.[0]?.textContent || e.textContent?.trim()
      return !label
    }).length,
  )
  expect(unnamed).toBe(0)
})
