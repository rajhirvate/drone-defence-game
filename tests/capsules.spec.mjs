import { expect, test } from '@playwright/test'

const save = {
  v: 4,
  coins: 100,
  unlocked: 3,
  stars: [0],
  owned: { cannon: true, laser: true, missile: true, emp: true },
  equipped: 'cannon',
  ranks: { rate: 3, spread: 2, damage: 2, emp: 0, vital: 0, shield: 0, duration: 0, starter: 0 },
  bestLevel: [],
  scores: [],
  achievements: [],
  stats: { kills: 0, bosses: 0, runs: 0, bestCombo: 0, coinsEarned: 0, dailies: 0, cleared: 0 },
  bestEndless: 0,
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
  music: false,
}

async function boot(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.evaluate((payload) => localStorage.setItem('drone-defence.save', JSON.stringify(payload)), save)
  await page.reload()
  await page.locator('#campaign').click()
  await page.locator('#map-nodes button').first().click()
  await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
}

async function pump(page, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(0))))
  }
}

test.describe('weapon capsules', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

  test('a letter capsule can be tapped and the HUD shows the gun', async ({ page }) => {
    await boot(page, 412, 915)
    await page.evaluate(() => window.__DRONE_DEBUG__.spawnCapsule('S'))
    await page.waitForFunction(() => {
      const banner = document.querySelector('#banner')
      return window.__DRONE_DEBUG__.drops().some((drop) => drop.letter === 'S') && !(banner && banner.classList.contains('show'))
    })
    await page.screenshot({ path: '/opt/cursor/artifacts/after-capsule.png' })
    const canvas = page.locator('#game canvas')
    const box = await canvas.boundingBox()
    const drop = await page.evaluate(() => window.__DRONE_DEBUG__.drops()[0])
    const view = await page.evaluate(() => ({ w: window.__DRONE_DEBUG__.viewW, h: window.__DRONE_DEBUG__.viewH }))
    await page.mouse.click(box.x + (drop.x / view.w) * box.width, box.y + (drop.y / view.h) * box.height)
    await expect.poll(async () => page.evaluate(() => window.__DRONE_DEBUG__.power().letter)).toBe('S')
    await expect(page.locator('#gun')).toHaveText('S1')
    await page.waitForFunction(() => document.querySelector('#skin-toast')?.hidden !== false)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-gun-hud.png' })

    await page.evaluate(() => window.__DRONE_DEBUG__.setPower('S', 4))
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.2)
    await page.mouse.down()
    await pump(page, 2800)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-spread-max.png' })
    await page.mouse.up()

    await page.evaluate(() => window.__DRONE_DEBUG__.setPower('L', 3))
    await page.mouse.down()
    await pump(page, 500)
    await expect(page.locator('#gun')).toHaveText('L3')
    await page.screenshot({ path: '/opt/cursor/artifacts/after-laser-pierce.png' })
    await page.mouse.up()
  })
})

test.describe('capsule on a short phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 })

  test('the letter stays readable at 360x740', async ({ page }) => {
    await boot(page, 360, 740)
    await page.evaluate(() => window.__DRONE_DEBUG__.spawnCapsule('M'))
    await page.waitForFunction(() => {
      const banner = document.querySelector('#banner')
      return window.__DRONE_DEBUG__.drops().some((drop) => drop.letter === 'M') && !(banner && banner.classList.contains('show'))
    })
    await page.screenshot({ path: '/opt/cursor/artifacts/after-capsule-360.png' })
    const canvas = page.locator('#game canvas')
    const box = await canvas.boundingBox()
    const drop = await page.evaluate(() => window.__DRONE_DEBUG__.drops()[0])
    const view = await page.evaluate(() => ({ w: window.__DRONE_DEBUG__.viewW, h: window.__DRONE_DEBUG__.viewH }))
    await page.mouse.click(box.x + (drop.x / view.w) * box.width, box.y + (drop.y / view.h) * box.height)
    await expect.poll(async () => page.evaluate(() => window.__DRONE_DEBUG__.power().letter)).toBe('M')
  })
})
