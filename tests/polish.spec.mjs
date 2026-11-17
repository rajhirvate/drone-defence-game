import { expect, test } from '@playwright/test'

const save = {
  v: 4,
  coins: 240,
  unlocked: 12,
  stars: [0, 3, 2, 1, 3, 2, 0, 1, 2, 3, 1, 0],
  owned: { cannon: true, laser: true, missile: true, emp: true },
  equipped: 'cannon',
  ranks: { rate: 2, spread: 1, damage: 1, emp: 0, vital: 0, shield: 0, duration: 0, starter: 0 },
  bestLevel: [0, 1200],
  scores: [],
  achievements: ['first-kill', 'streak'],
  stats: { kills: 40, bosses: 1, runs: 3, bestCombo: 6, coinsEarned: 200, dailies: 0, cleared: 8 },
  bestEndless: 0,
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
  music: false,
}

async function boot(page) {
  await page.goto('/')
  await page.evaluate((payload) => localStorage.setItem('drone-defence.save', JSON.stringify(payload)), save)
  await page.reload()
}

test.describe('polish on a short phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 })

  test('how to play lists the guns and keeps Back on screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await boot(page)
    await expect(page.locator('#continue-run')).toContainText('Continue')
    await page.locator('#howto-open').click()
    await page.locator('#howto-sheet:not([hidden])').waitFor()
    await expect(page.locator('#howto-sheet')).toContainText('Overdrive')
    await expect(page.locator('#howto-sheet')).toContainText('M machine gun')
    const back = await page.locator('#howto-close').boundingBox()
    expect(back.y + back.height).toBeLessThanOrEqual(742)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-howto-360.png' })
  })
})

test.describe('polish in play', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

  test('the map shows stars and overdrive lights a plate', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await boot(page)
    await page.locator('#campaign').click()
    await page.locator('#map:not([hidden])').waitFor()
    await expect(page.locator('#map-nodes button.locked').first()).toBeVisible()
    await expect(page.locator('#map-nodes button.next')).toBeVisible()
    await page.screenshot({ path: '/opt/cursor/artifacts/after-map-stars.png' })
    await page.locator('#map-nodes button').first().click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    await page.waitForFunction(() => {
      const banner = document.querySelector('#banner')
      return !(banner && banner.classList.contains('show'))
    })
    await page.evaluate(() => {
      window.__DRONE_DEBUG__.inject('plate')
      window.__DRONE_DEBUG__.inject('jammer')
    })
    await page.waitForTimeout(280)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-plate.png' })
    await page.evaluate(() => {
      window.__DRONE_DEBUG__.setPower('S', 4)
      window.__DRONE_DEBUG__.fillDrive()
      window.__DRONE_DEBUG__.fireDrive()
    })
    await expect.poll(async () => page.evaluate(() => window.__DRONE_DEBUG__.drive().left)).toBeGreaterThan(5)
    const canvas = page.locator('#game canvas')
    const box = await canvas.boundingBox()
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.22)
    await page.mouse.down()
    const start = Date.now()
    while (Date.now() - start < 400) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(0))))
    }
    await page.evaluate(() => {
      const banner = document.querySelector('#banner')
      if (banner) banner.style.display = 'none'
    })
    await page.screenshot({ path: '/opt/cursor/artifacts/after-overdrive.png' })
    await page.mouse.up()
  })
})
