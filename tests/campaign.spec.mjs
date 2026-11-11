import { expect, test } from '@playwright/test'

const save = {
  v: 4,
  coins: 900,
  unlocked: 100,
  stars: [0, 3],
  owned: { cannon: true, laser: true, missile: true, emp: true },
  equipped: 'cannon',
  ranks: { rate: 0, spread: 0, damage: 0, emp: 0, vital: 0 },
  bestEndless: 10,
  bestLevel: [],
  dailyBest: {},
  muted: true,
  autoFire: false,
  haptics: false,
  tutorialSeen: true,
  missileSkin: 'standard',
  ownedSkins: { standard: true },
  turretSkin: 'navy',
  ownedTurrets: { navy: true },
  empHintSeen: true,
  difficulty: 'medium',
}

async function boot(page) {
  await page.goto('/')
  await page.evaluate((payload) => localStorage.setItem('drone-defence.save', JSON.stringify(payload)), save)
  await page.reload()
  await page.waitForSelector('#campaign')
}

test.describe('hundred-level campaign', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

  test('early sky is crowded, the shop lists the new ranks, and a late boss appears', async ({ page }) => {
    test.setTimeout(90_000)
    await boot(page)
    await page.locator('#campaign').click()
    await page.locator('#map-nodes button').first().click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    const start = Date.now()
    while (Date.now() - start < 4000) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(0))))
    }
    const early = await page.evaluate(() => window.__DRONE_DEBUG__)
    expect(early.enemies.length).toBeGreaterThanOrEqual(8)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-early-density.png' })

    await page.evaluate(() => window.__DRONE_DEBUG__.inject('shield'))
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.enemies?.some((enemy) => enemy.kind === 'shield' && enemy.shield > 0))
    await page.screenshot({ path: '/opt/cursor/artifacts/after-shield-drone.png' })

    await page.locator('#pause-btn').click()
    await page.locator('#pause:not([hidden])').waitFor()
    await expect(page.locator('#resume')).toBeVisible()
    await expect(page.locator('#pause-retry')).toBeVisible()
    await page.screenshot({ path: '/opt/cursor/artifacts/after-pause.png' })
    await page.locator('#pause-menu').click()

    await page.locator('#armoury').click()
    await page.locator('#shop:not([hidden])').waitFor()
    await expect(page.locator('#shop-ranks')).toContainText('EMP Cycle')
    await expect(page.locator('#shop-ranks')).toContainText('City Plating')
    await page.screenshot({ path: '/opt/cursor/artifacts/after-shop.png' })
    await page.locator('#shop-back').click()

    await page.locator('#campaign').click()
    await page.locator('#map-nodes button').nth(89).click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    await page.evaluate(() => window.__DRONE_DEBUG__.inject('carrier'))
    await page.waitForFunction(() => {
      const row = document.querySelector('#boss-row')
      const boss = window.__DRONE_DEBUG__?.enemies?.find((enemy) => enemy.kind === 'carrier')
      return row && !row.hidden && boss && boss.maxHp > 100
    })
    await page.screenshot({ path: '/opt/cursor/artifacts/after-late-boss.png' })
  })
})

test.describe('narrow campaign', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 })

  test('level 1 still fills a narrow phone and the pause menu fits', async ({ page }) => {
    await boot(page)
    await page.locator('#campaign').click()
    await page.locator('#map-nodes button').first().click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    const start = Date.now()
    while (Date.now() - start < 3500) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(0))))
    }
    const early = await page.evaluate(() => window.__DRONE_DEBUG__)
    expect(early.enemies.length).toBeGreaterThanOrEqual(6)
    await page.locator('#pause-btn').click()
    await expect(page.locator('#pause:not([hidden]) #resume')).toBeVisible()
    const box = await page.locator('#pause .panel').boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(361)
  })
})
