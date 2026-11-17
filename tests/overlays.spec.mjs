import { expect, test } from '@playwright/test'

const save = {
  v: 4,
  coins: 400,
  unlocked: 20,
  stars: [0, 1],
  owned: { cannon: true, laser: true, missile: true, emp: true },
  equipped: 'cannon',
  ranks: { rate: 1, spread: 0, damage: 0, emp: 0, vital: 0 },
  bestEndless: 0,
  bestLevel: [],
  dailyBest: {},
  muted: true,
  autoFire: true,
  haptics: false,
  tutorialSeen: true,
  missileSkin: 'standard',
  ownedSkins: { standard: true },
  turretSkin: 'navy',
  ownedTurrets: { navy: true },
  empHintSeen: true,
  difficulty: 'medium',
}

const overlays = [
  { id: 'skins', button: '#skins-back', mustScroll: true },
  { id: 'shop', button: '#shop-back', mustScroll: true },
  { id: 'map', button: '#map-back', mustScroll: true },
  { id: 'clear', button: '#clear-retry', mustScroll: false },
  { id: 'upgrade', button: '#upgrade-skins', mustScroll: false },
  { id: 'pause', button: '#resume', mustScroll: false },
  { id: 'over', button: '#restart', mustScroll: false },
  { id: 'howto-sheet', button: '#howto-close', mustScroll: false },
]

function insideViewport(box, viewport) {
  expect(box, 'button has a box').toBeTruthy()
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
}

async function boot(page) {
  await page.goto('/')
  await page.evaluate((payload) => localStorage.setItem('drone-defence.save', JSON.stringify(payload)), save)
  await page.reload()
  await page.waitForSelector('#open-skins')
}

async function openReal(page, id) {
  if (id === 'skins') {
    await page.locator('#open-skins').click()
    await page.locator('#skins:not([hidden])').waitFor()
    return
  }
  if (id === 'shop') {
    await page.locator('#armoury').click()
    await page.locator('#shop:not([hidden])').waitFor()
    return
  }
  if (id === 'map') {
    await page.locator('#campaign').click()
    await page.locator('#map:not([hidden])').waitFor()
    return
  }
  if (id === 'howto-sheet') {
    await page.locator('#howto-open').click()
    await page.locator('#howto-sheet:not([hidden])').waitFor()
    return
  }
  if (id === 'pause') {
    await page.locator('#campaign').click()
    await page.locator('#map-nodes button').first().click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    await page.locator('#pause-btn').click()
    await page.locator('#pause:not([hidden])').waitFor()
  }
}

async function checkOverlay(page, item) {
  const viewport = page.viewportSize()
  const root = page.locator(`#${item.id}`)
  await expect(root).toBeVisible()
  const button = root.locator(item.button)
  insideViewport(await button.boundingBox(), viewport)
  const body = root.locator('.panel-body')
  const scrolled = await body.evaluate((el) => {
    const before = el.scrollTop
    const overflows = el.scrollHeight > el.clientHeight + 2
    el.scrollTop = Math.min(el.scrollHeight, 240)
    return {
      overflows,
      before,
      after: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }
  })
  if (item.mustScroll) {
    expect(scrolled.overflows, `${item.id} list overflows`).toBe(true)
    expect(scrolled.after).toBeGreaterThan(scrolled.before)
  } else if (scrolled.overflows) {
    expect(scrolled.after).toBeGreaterThan(scrolled.before)
  }
  insideViewport(await button.boundingBox(), viewport)
  return scrolled
}

for (const size of [
  { width: 360, height: 740 },
  { width: 412, height: 915 },
]) {
  test.describe(`overlays ${size.width}x${size.height}`, () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: size,
      deviceScaleFactor: 2,
    })

    test('action buttons stay on screen and long lists scroll', async ({ page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize(size)
      await boot(page)

      await openReal(page, 'skins')
      if (size.width === 360) {
        await page.locator('#skins .panel-body').evaluate((el) => {
          el.scrollTop = 0
        })
        await page.screenshot({ path: '/opt/cursor/artifacts/after-skins-360-top.png' })
      }
      await checkOverlay(page, overlays[0])
      if (size.width === 360) {
        await page.locator('#skins .panel-body').evaluate((el) => {
          el.scrollTop = el.scrollHeight
        })
        await page.screenshot({ path: '/opt/cursor/artifacts/after-skins-360-bottom.png' })
        const back = await page.locator('#skins-back').boundingBox()
        insideViewport(back, size)
      }
      await page.locator('#skins-back').click()

      await openReal(page, 'shop')
      if (size.width === 360) {
        await page.locator('#shop .panel-body').evaluate((el) => {
          el.scrollTop = 0
        })
        await page.screenshot({ path: '/opt/cursor/artifacts/after-shop-360.png' })
      }
      await checkOverlay(page, { ...overlays[1], mustScroll: size.height <= 740 })
      await page.locator('#shop-back').click()

      await openReal(page, 'map')
      await checkOverlay(page, overlays[2])
      await page.locator('#map-back').click()

      await openReal(page, 'howto-sheet')
      await checkOverlay(page, overlays[7])
      await page.locator('#howto-close').click()

      await openReal(page, 'pause')
      await checkOverlay(page, overlays[5])
      await page.locator('#pause-menu').click()

      await page.evaluate(() => {
        document.querySelector('#menu').hidden = true
        document.querySelector('#clear').hidden = false
      })
      await checkOverlay(page, overlays[3])
      await page.evaluate(() => {
        document.querySelector('#clear').hidden = true
        document.querySelector('#upgrade').hidden = false
      })
      await checkOverlay(page, overlays[4])
      await page.evaluate(() => {
        document.querySelector('#upgrade').hidden = true
        document.querySelector('#over').hidden = false
      })
      await checkOverlay(page, overlays[6])
    })
  })
}
