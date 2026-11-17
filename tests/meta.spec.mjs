import { expect, test } from '@playwright/test'

const save = {
  v: 3,
  coins: 80,
  unlocked: 4,
  stars: [0, 2],
  owned: { cannon: true, laser: false, missile: false, emp: false },
  equipped: 'cannon',
  ranks: { rate: 0, spread: 0, damage: 1 },
  bestLevel: [0, 1200],
  bestEndless: 0,
  dailyBest: {},
  muted: false,
  autoFire: true,
  haptics: true,
  tutorialSeen: true,
  difficulty: 'medium',
}

function inside(box, viewport) {
  expect(box).toBeTruthy()
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
}

async function boot(page) {
  await page.goto('/')
  await page.evaluate((payload) => localStorage.setItem('drone-defence.save', JSON.stringify(payload)), save)
  await page.reload()
  await page.waitForSelector('#open-badges')
}

test.describe('career screens', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

  test('badges, stats, shop ranks, and pause settings stay reachable', async ({ page }) => {
    await boot(page)
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')))
    expect(kept.v).toBe(4)
    expect(kept.coins).toBe(80)
    expect(kept.scores[1][0]).toBe(1200)
    expect(kept.music).toBe(true)
    expect(kept.ranks.shield).toBe(0)

    await page.locator('#open-badges').click()
    await page.locator('#badges:not([hidden])').waitFor()
    await expect(page.locator('#badge-list')).toContainText('First Light')
    inside(await page.locator('#badges-back').boundingBox(), page.viewportSize())
    await page.screenshot({ path: '/opt/cursor/artifacts/after-badges.png' })
    await page.locator('#badges-back').click()

    await page.locator('#open-stats').click()
    await page.locator('#stats:not([hidden])').waitFor()
    await expect(page.locator('#stats-board')).toContainText('Level 1')
    inside(await page.locator('#stats-back').boundingBox(), page.viewportSize())
    await page.screenshot({ path: '/opt/cursor/artifacts/after-stats.png' })
    await page.locator('#stats-back').click()

    await page.locator('#armoury').click()
    await expect(page.locator('#shop-ranks')).toContainText('Shield HP')
    await expect(page.locator('#shop-ranks')).toContainText('Power-up Time')
    inside(await page.locator('#shop-back').boundingBox(), page.viewportSize())
    await page.locator('#shop-back').click()

    await page.locator('#campaign').click()
    await page.locator('#map-nodes button').first().click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    await expect(page.locator('#tutorial')).toBeHidden()
    await page.locator('#pause-btn').click()
    await expect(page.locator('#pause-music')).toBeVisible()
    await expect(page.locator('#pause-haptics')).toBeVisible()
    inside(await page.locator('#resume').boundingBox(), page.viewportSize())
    await page.locator('#pause-music').click()
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')).music)).toBe(false)
  })
})
