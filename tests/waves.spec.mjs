import { expect, test } from '@playwright/test'

const save = {
  v: 3,
  coins: 400,
  unlocked: 50,
  stars: [0, 3, 2, 1],
  owned: { cannon: true, laser: true, missile: true, emp: true },
  equipped: 'cannon',
  ranks: { rate: 5, spread: 5, damage: 5 },
  bestEndless: 100,
  dailyBest: {},
  muted: true,
  autoFire: true,
  haptics: false,
  tutorialSeen: true,
  missileSkin: 'standard',
  ownedSkins: { standard: true, flare: false, needle: false, comet: false },
  empHintSeen: true,
}

async function boot(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.evaluate((payload) => localStorage.setItem('drone-defence.save', JSON.stringify(payload)), save)
  await page.reload()
  await page.waitForSelector('#campaign')
}

async function fight(page, ms) {
  const start = Date.now()
  let down = false
  while (Date.now() - start < ms) {
    const point = await page.evaluate(() => {
      const debug = window.__DRONE_DEBUG__
      const canvas = document.querySelector('#game canvas')
      if (!debug || !(canvas instanceof HTMLCanvasElement)) return null
      const rect = canvas.getBoundingClientRect()
      const live = debug.enemies.filter((enemy) => enemy.y > -20)
      live.sort((a, b) => b.y - a.y)
      const target = live[0]
      if (!target) return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.22 }
      return { x: rect.left + target.x, y: rect.top + Math.max(36, target.y) }
    })
    if (point) {
      await page.mouse.move(point.x, point.y)
      if (!down) {
        await page.mouse.down()
        down = true
      }
    }
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(0))))
  }
  if (down) await page.mouse.up()
}

test.describe('waves on a phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

  test('difficulty persists, the map has 50 levels, and a boss wave is not an early clear', async ({ page }) => {
    test.setTimeout(120_000)
    await boot(page, 412, 915)
    const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')))
    expect(migrated.v).toBe(4)
    expect(migrated.difficulty).toBe('medium')
    expect(migrated.coins).toBe(400)
    expect(migrated.unlocked).toBe(50)
    expect(migrated.stars[1]).toBe(3)

    await expect(page.locator('#menu [data-diff="medium"]')).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot({ path: '/opt/cursor/artifacts/after-difficulty.png' })
    await page.locator('#menu [data-diff="hard"]').click()
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')).difficulty)).toBe('hard')
    await page.reload()
    await expect(page.locator('#menu [data-diff="hard"]')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('#menu [data-diff="medium"]').click()

    await page.locator('#campaign').click()
    await page.locator('#map:not([hidden])').waitFor()
    await expect(page.locator('#map-nodes button')).toHaveCount(50)
    await page.locator('#map-nodes button', { hasText: 'Last Battery' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/opt/cursor/artifacts/after-map-50.png' })

    await page.locator('#map-nodes button', { hasText: 'The Carrier' }).click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    await page.waitForFunction(() => document.querySelector('#wave')?.textContent === '2/4', null, { timeout: 40_000 })
    await fight(page, 600)
    const mid = await page.evaluate(() => window.__DRONE_DEBUG__)
    expect(mid.phase).toBe('playing')
    expect(mid.wave).toBe(2)
    expect(mid.waveCount).toBe(4)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-wave.png' })

    await page.waitForFunction(() => window.__DRONE_DEBUG__?.wave === 4, null, { timeout: 70_000 })
    await page.locator('#auto-btn').click()
    await page.waitForFunction(() => {
      const row = document.querySelector('#boss-row')
      const boss = window.__DRONE_DEBUG__?.enemies?.find((enemy) => enemy.kind === 'carrier' || enemy.kind === 'armour')
      return row && !row.hidden && boss && boss.hp > 20 && boss.y > 110 && boss.y < 560
    }, null, { timeout: 25_000 })
    const boss = await page.evaluate(() => window.__DRONE_DEBUG__)
    expect(boss.phase).toBe('playing')
    expect(boss.wave).toBe(4)
    expect(boss.enemies.some((enemy) => enemy.kind === 'carrier' && enemy.maxHp > 40)).toBeTruthy()
    await page.screenshot({ path: '/opt/cursor/artifacts/after-boss.png' })
  })
})

test.describe('narrow map', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 })

  test('the selector fits and level 50 can be scrolled into view', async ({ page }) => {
    await boot(page, 360, 800)
    const box = await page.locator('#menu .diff').boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(361)
    await page.locator('#campaign').click()
    await expect(page.locator('#map-nodes button')).toHaveCount(50)
    const last = page.locator('#map-nodes button', { hasText: 'Last Battery' })
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeVisible()
    await expect(last).toBeEnabled()
  })
})
