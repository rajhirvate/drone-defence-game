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

async function boot(page, width, height, data = save) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.evaluate((payload) => localStorage.setItem('drone-defence.save', JSON.stringify(payload)), data)
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

async function watchLevel(page, shots) {
  await page.evaluate(() => {
    window.__WAVE_WATCH = { flow: false, slow: false, early: false, blocks: false }
    const tick = () => {
      const debug = window.__DRONE_DEBUG__
      const watch = window.__WAVE_WATCH
      const banner = document.querySelector('#banner')
      if (debug) {
        if (debug.timeScale < 1 && debug.wave < debug.waveCount) watch.early = true
        if (
          !watch.flow &&
          debug.wave === 2 &&
          debug.timeScale === 1 &&
          debug.enemies.length >= 2 &&
          debug.phase === 'playing'
        ) {
          watch.flow = true
          watch.blocks = banner ? getComputedStyle(banner).pointerEvents !== 'none' : false
        }
        if (!watch.slow && debug.timeScale < 1 && debug.wave === debug.waveCount && debug.phase === 'playing') {
          watch.slow = true
        }
      }
      if (!watch.flow || !watch.slow) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const start = Date.now()
  let down = false
  let flowShot = false
  let slowShot = false
  while (Date.now() - start < 40_000) {
    const watch = await page.evaluate(() => window.__WAVE_WATCH)
    if (watch.flow && !flowShot) {
      flowShot = true
      if (shots?.flow) await page.screenshot({ path: shots.flow })
    }
    if (watch.slow && !slowShot) {
      slowShot = true
      if (shots?.slow) await page.screenshot({ path: shots.slow })
    }
    if (watch.flow && watch.slow) break
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
  return page.evaluate(() => window.__WAVE_WATCH)
}

test.describe('continuous waves', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

  test('the next wave arrives while drones remain, and slow-motion waits for the level clear', async ({ page }) => {
    await boot(page, 412, 915, { ...save, ranks: { rate: 0, spread: 0, damage: 0 } })
    await page.locator('#campaign').click()
    await page.locator('#map-nodes button', { hasText: 'First Light' }).click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    const seen = await watchLevel(page, {
      flow: '/opt/cursor/artifacts/after-wave-flow.png',
      slow: '/opt/cursor/artifacts/after-slowmo.png',
    })
    expect(seen.early).toBe(false)
    expect(seen.flow).toBe(true)
    expect(seen.slow).toBe(true)
    expect(seen.blocks).toBe(false)
  })
})

test.describe('narrow waves', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 })

  test('a 360-wide screen also chains waves without slowing early', async ({ page }) => {
    await boot(page, 360, 800, { ...save, ranks: { rate: 0, spread: 0, damage: 0 } })
    await page.locator('#campaign').click()
    await page.locator('#map-nodes button', { hasText: 'First Light' }).click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    const seen = await watchLevel(page)
    expect(seen.early).toBe(false)
    expect(seen.flow).toBe(true)
    expect(seen.slow).toBe(true)
  })
})

test.describe('skins and a busy wave', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

  test('the menu opens skins, a purchase toasts, and a wave can fill the sky', async ({ page }) => {
    await boot(page, 412, 915, { ...save, coins: 800, autoFire: false, equipped: 'missile' })
    await page.screenshot({ path: '/opt/cursor/artifacts/after-skins-menu.png' })
    const launch = await page.locator('#open-skins').boundingBox()
    expect(launch.width).toBeGreaterThan(180)
    await page.locator('#open-skins').click()
    await page.locator('#skins:not([hidden])').waitFor()
    await expect(page.locator('#skins-grid .skin-card')).toHaveCount(8)
    await expect(page.locator('#turret-grid .skin-card')).toHaveCount(4)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-skins-screen.png' })
    await page.locator('#skins-grid button', { hasText: 'Halo' }).click()
    await expect(page.locator('#skin-toast')).toContainText('Halo')
    const bought = await page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')))
    expect(bought.missileSkin).toBe('halo')
    expect(bought.ownedSkins.halo).toBe(true)
    expect(bought.coins).toBe(710)
    await page.reload()
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')))
    expect(kept.missileSkin).toBe('halo')
    expect(kept.ownedSkins.halo).toBe(true)
    await page.locator('#campaign').click()
    await page.locator('#map-nodes button', { hasText: 'High Court' }).click()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
    await page.waitForFunction(() => (window.__DRONE_DEBUG__?.enemies?.length ?? 0) >= 10, null, { timeout: 20_000 })
    await page.screenshot({ path: '/opt/cursor/artifacts/after-busy-wave.png' })
    await page.locator('#weapons button[data-weapon="missile"]').click()
    const canvas = page.locator('#game canvas')
    const box = await canvas.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25)
    await page.mouse.down()
    await page.waitForFunction(() => window.__DRONE_DEBUG__?.bullets?.some((bullet) => bullet.homing && bullet.skin === 'halo'))
    await page.mouse.up()
    await page.screenshot({ path: '/opt/cursor/artifacts/after-skin-flight.png' })
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
