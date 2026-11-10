import { expect, test } from '@playwright/test'

const mainSave = {
  v: 2,
  coins: 321,
  unlocked: 7,
  stars: [0, 3, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  owned: { cannon: true, laser: true, missile: true, emp: true },
  equipped: 'cannon',
  ranks: { rate: 2, spread: 1, damage: 0 },
  bestEndless: 5000,
  dailyBest: { '2026-11-01': 42 },
  muted: true,
  autoFire: true,
  haptics: false,
  tutorialSeen: true,
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

async function pump(page, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(0))))
  }
}

async function boot(page, save, width, height) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.evaluate((data) => localStorage.setItem('drone-defence.save', JSON.stringify(data)), save)
  await page.reload()
  await page.waitForSelector('#campaign')
  await page.waitForFunction(() => document.querySelector('#game canvas') instanceof HTMLCanvasElement)
}

async function startLevel(page) {
  await page.locator('#campaign').click()
  await page.locator('#map:not([hidden])').waitFor()
  await page.locator('#map-nodes button:not([disabled])').first().click()
  await page.waitForFunction(() => window.__DRONE_DEBUG__?.phase === 'playing')
}

test.describe('mobile EMP', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

  test('one EMP tap hits drones in range, including offscreen and armoured', async ({ page }) => {
    await boot(page, { ...mainSave, equipped: 'emp', autoFire: true }, 412, 915)
    const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')))
    expect(migrated.v).toBe(4)
    expect(migrated.difficulty).toBe('medium')
    expect(migrated.coins).toBe(321)
    expect(migrated.unlocked).toBe(7)
    expect(migrated.stars[1]).toBe(3)
    expect(migrated.bestEndless).toBe(5000)
    expect(migrated.equipped).toBe('emp')
    expect(migrated.ranks.rate).toBe(2)
    expect(migrated.missileSkin).toBe('standard')

    await startLevel(page)
    await pump(page, 400)
    await page.evaluate(() => {
      const debug = window.__DRONE_DEBUG__
      debug.inject('drone')
      debug.inject('missile')
      debug.inject('armour')
      debug.inject('swarm')
    })
    const before = await page.evaluate(() => window.__DRONE_DEBUG__)
    expect(before.empCd).toBe(0)
    expect(before.autoFire).toBe(true)
    expect(Math.abs(before.viewW - before.cssWidth)).toBeLessThan(3)
    expect(Math.abs(before.viewH - before.cssHeight)).toBeLessThan(3)
    const kinds = new Set(before.enemies.map((e) => e.kind))
    expect(kinds.has('drone')).toBeTruthy()
    expect(kinds.has('missile')).toBeTruthy()
    expect(kinds.has('armour')).toBeTruthy()

    await page.locator('#weapons button[data-weapon="emp"]').tap()
    await pump(page, 280)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-emp-firing.png' })
    await pump(page, 1600)
    await page.screenshot({ path: '/opt/cursor/artifacts/after-cooldown.png' })

    const after = await page.evaluate(() => window.__DRONE_DEBUG__)
    expect(after.weapon).toBe('emp')
    expect(after.empCd).toBeGreaterThan(1)
    expect(after.lastEmpRadius).toBeGreaterThan(after.viewH * 0.8)
    expect(after.lastEmpStruck.length).toBeGreaterThan(0)
    const ring = page.locator('#weapons button[data-weapon="emp"] .cd-ring')
    await expect(ring).toBeVisible()
    const box = await ring.boundingBox()
    const button = await page.locator('#weapons button[data-weapon="emp"]').boundingBox()
    expect(box.width).toBeCloseTo(box.height, 0)
    expect(box.x).toBeGreaterThanOrEqual(button.x - 1)
    expect(box.y).toBeGreaterThanOrEqual(button.y - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(button.x + button.width + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(button.y + button.height + 1)

    for (const enemy of before.enemies) {
      const reach = dist(enemy, after.lastEmpOrigin)
      if (reach > after.lastEmpRadius + enemy.r) continue
      const hit = after.lastEmpStruck.find((s) => s.kind === enemy.kind && dist(s, enemy) < 80)
      expect(hit, `${enemy.kind} at ${enemy.y}`).toBeTruthy()
      expect(hit.hp < hit.hpBefore || hit.stun > 0).toBeTruthy()
    }
  })
})

test.describe('narrow phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 })

  test('EMP tap still hits on a 360 wide screen', async ({ page }) => {
    await boot(page, { ...mainSave, equipped: 'emp', autoFire: true }, 360, 800)
    await startLevel(page)
    await page.evaluate(() => window.__DRONE_DEBUG__.inject('drone'))
    await page.locator('#weapons button[data-weapon="emp"]').tap()
    await pump(page, 500)
    const after = await page.evaluate(() => window.__DRONE_DEBUG__)
    expect(after.empCd).toBeGreaterThan(1)
    expect(after.lastEmpStruck.some((s) => s.kind === 'drone' && (s.hp < s.hpBefore || s.stun > 0))).toBeTruthy()
    expect(Math.abs(after.viewW - after.cssWidth)).toBeLessThan(3)
  })
})

test('cannon auto-fire, laser tap, and missile tap still shoot', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 })
  await boot(page, { ...mainSave, equipped: 'cannon', autoFire: true }, 412, 915)
  await startLevel(page)
  await pump(page, 4000)
  const cannon = await page.evaluate(() => ({
    autoFire: window.__DRONE_DEBUG__.autoFire,
    bullets: window.__DRONE_DEBUG__.bullets.length,
    score: Number((document.querySelector('#score')?.textContent || '0').replace(/,/g, '')),
  }))
  expect(cannon.autoFire).toBe(true)
  expect(cannon.bullets > 0 || cannon.score > 0).toBeTruthy()

  await page.evaluate(() => localStorage.setItem('drone-defence.save', JSON.stringify({
    ...JSON.parse(localStorage.getItem('drone-defence.save')),
    equipped: 'laser',
    autoFire: false,
  })))
  await page.reload()
  await startLevel(page)
  await page.locator('#weapons button[data-weapon="laser"]').click()
  const canvas = page.locator('#game canvas')
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3)
  await page.mouse.down()
  await pump(page, 600)
  await page.mouse.up()
  const laser = await page.evaluate(() => window.__DRONE_DEBUG__)
  expect(laser.weapon).toBe('laser')

  await page.locator('#weapons button[data-weapon="missile"]').click()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25)
  await page.mouse.down()
  await pump(page, 800)
  await page.mouse.up()
  await pump(page, 400)
  const missile = await page.evaluate(() => window.__DRONE_DEBUG__)
  expect(missile.weapon).toBe('missile')
  expect(missile.bullets.some((b) => b.homing)).toBeTruthy()
})

test('all four missile skins buy, equip, and render', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 })
  await boot(page, { ...mainSave, coins: 500, equipped: 'missile', autoFire: true }, 412, 915)
  await page.locator('#armoury').click()
  await page.locator('#shop:not([hidden])').waitFor()
  await page.screenshot({ path: '/opt/cursor/artifacts/after-skins-picker.png' })
  for (const name of ['Standard', 'Flare', 'Needle', 'Comet']) {
    await page.locator('#shop-skins button', { hasText: name }).click()
    await pump(page, 100)
    const skin = await page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')).missileSkin)
    expect(skin).toBe(name.toLowerCase())
  }
  await page.locator('#shop-back').click()
  await startLevel(page)
  await pump(page, 1500)
  await page.screenshot({ path: '/opt/cursor/artifacts/after-skin-inflight.png' })
  const flight = await page.evaluate(() => window.__DRONE_DEBUG__)
  expect(flight.missileSkin).toBe('comet')
  expect(flight.bullets.some((b) => b.homing && b.skin === 'comet')).toBeTruthy()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')))
  expect(saved.coins).toBeLessThan(500)
  expect(saved.ownedSkins.flare && saved.ownedSkins.needle && saved.ownedSkins.comet).toBeTruthy()
  expect(saved.unlocked).toBe(7)
})
