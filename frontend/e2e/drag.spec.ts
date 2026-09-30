import { expect, test, type Page } from '@playwright/test'

async function example(page: Page, name = '01_ss_central_point') {
  await page.goto('/')
  await page.getByLabel('Examples', { exact: true }).selectOption(name)
  await expect(page.getByText(/M (max|min) =/).first()).toBeVisible()
}
async function geometry(page: Page) {
  const b = await page.locator('[data-beam-canvas]').boundingBox()
  if (!b) throw new Error('No beam canvas')
  const left = b.width < 520 ? 60 : 112
  const pad = b.width < 520 ? 20 : 48
  return { ...b, at: (x: number, L = 6) => b.x + left + x * (b.width - pad - left) / L }
}
async function drag(page: Page, from: number, to: number, y: number) {
  await page.mouse.move(from, y)
  await page.mouse.down()
  await page.mouse.move(to, y, { steps: 12 })
}

test('point drag updates live and records one undo entry', async ({ page }) => {
  await example(page)
  const g = await geometry(page)
  await drag(page, g.at(3), g.at(2.02), g.y + 95)
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('2.000')
  await expect.poll(async () => (await page.locator('text').allTextContents()).some((t) => t.includes('M max = 13.333'))).toBe(true)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('3.000')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('2.000')
  // The next undo removes the drag, then the example itself (no intermediate moves).
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-item-id]')).toHaveCount(0)
})

test('snaps to a support within 8 px and Alt disables snapping', async ({ page }) => {
  await example(page)
  const g = await geometry(page)
  await drag(page, g.at(3), g.at(6) - 5, g.y + 95)
  await page.mouse.up()
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('6.000')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.keyboard.down('Alt')
  await drag(page, g.at(3), g.at(2.123), g.y + 95)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('2.123')
})

test('Escape cancels without adding history or selecting an integration span', async ({ page }) => {
  await example(page)
  const g = await geometry(page)
  await drag(page, g.at(3), g.at(1.5), g.y + 95)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.locator('[data-item-id="p1"]')).toHaveAttribute('aria-label', /3.000/)
  await expect(page.getByText('Shaded SFD Area', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-item-id]')).toHaveCount(0)
})

test('palette drag adds at the drop position, outside drop adds nothing', async ({ page }) => {
  await example(page)
  const g = await geometry(page)
  const button = page.getByRole('button', { name: 'Point load', exact: true })
  const b = await button.boundingBox()
  if (!b) throw new Error('No palette item')
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(g.at(4), g.y + 95, { steps: 12 })
  await page.mouse.up()
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('4.000')
  await expect(page.locator('[data-item-id]')).toHaveCount(4)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-item-id]')).toHaveCount(3)
  await page.mouse.move(b.x + 15, b.y + 15)
  await page.mouse.down()
  await page.mouse.move(g.at(4), g.y + 95, { steps: 8 })
  await page.mouse.move(20, 20)
  await page.mouse.up()
  await expect(page.locator('[data-item-id]')).toHaveCount(3)
})

test('distributed body preserves span and endpoint handles resize it', async ({ page }) => {
  await example(page, '08_ss_partial_udl')
  const g = await geometry(page)
  await drag(page, g.at(4, 8), g.at(5, 8), g.y + 100)
  await page.mouse.up()
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('3.000')
  await expect(page.getByLabel('End', { exact: true })).toHaveValue('7.000')
  const handle = page.locator('[data-resize="end"] circle')
  const h = await handle.boundingBox()
  if (!h) throw new Error('No resize handle')
  await drag(page, h.x + h.width / 2, g.at(6, 8), h.y + h.height / 2)
  await page.mouse.up()
  await expect(page.getByLabel('End', { exact: true })).toHaveValue('6.000')
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('3.000')
})

test('support collision keeps last diagrams and reports the error', async ({ page }) => {
  await example(page)
  const g = await geometry(page)
  await drag(page, g.at(0), g.at(6), g.y + 145)
  await expect(page.getByText('Not up to date').first()).toBeVisible()
  await page.mouse.up()
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('6.000')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('0.000')
  await expect(page.getByText('Not up to date')).toHaveCount(0)
})

test('pointer cancellation rolls back the preview', async ({ page }) => {
  await example(page)
  const g = await geometry(page)
  await drag(page, g.at(3), g.at(1), g.y + 95)
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('1.000')
  await page.locator('[data-beam-canvas]').evaluate((el) => el.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })))
  await page.mouse.up()
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('3.000')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-item-id]')).toHaveCount(0)
})

test('fixed supports stay at the beam end', async ({ page }) => {
  await example(page, '03_cantilever_left_udl')
  const g = await geometry(page)
  await drag(page, g.at(0, 4), g.at(2, 4), g.y + 145)
  await page.mouse.up()
  await expect(page.getByLabel('Position', { exact: true })).toHaveValue('0.000')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-item-id]')).toHaveCount(0)
})

test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })
  test('drags on a phone without scrolling and commits once', async ({ page, context }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await page.getByLabel('Examples', { exact: true }).selectOption('01_ss_central_point')
    await expect(page.locator('[data-item-id="p1"]')).toBeVisible()
    const g = await geometry(page)
    const cdp = await context.newCDPSession(page)
    const scrollBefore = await page.evaluate(() => window.scrollY)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.at(3), y: g.y + 95 }] })
    for (const x of [2.8, 2.5, 2.2, 2]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: g.at(x), y: g.y + 95 }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.locator('[data-item-id="p1"]')).toHaveAttribute('aria-label', /2.000/)
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.locator('[data-item-id="p1"]')).toHaveAttribute('aria-label', /3.000/)
  })
})

test('Ctrl+Z cancels an active drag without resurrecting the preview', async ({ page }) => {
  await example(page)
  const g = await geometry(page)
  await drag(page, g.at(3), g.at(2), g.y + 95)
  await page.keyboard.press('Control+z')
  await page.mouse.move(g.at(1), g.y + 95)
  await page.mouse.up()
  await expect(page.locator('[data-item-id="p1"]')).toHaveAttribute('aria-label', /3.000/)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-item-id]')).toHaveCount(0)
})

test('cancelled palette drag does not turn into a click-to-add on release', async ({ page }) => {
  await example(page)
  const g = await geometry(page)
  const button = page.getByRole('button', { name: 'Point load', exact: true })
  const b = await button.boundingBox()
  if (!b) throw new Error('No palette item')
  await page.mouse.move(b.x + 15, b.y + 15)
  await page.mouse.down()
  await page.mouse.move(g.at(4), g.y + 95, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.move(b.x + 15, b.y + 15)
  await page.mouse.up()
  await expect(page.locator('[data-item-id]')).toHaveCount(3)
  await button.click()
  await expect(page.locator('[data-item-id]')).toHaveCount(4)
})
