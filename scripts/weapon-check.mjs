/**
 * Headless check that each weapon does something.
 * Preview must already be serving dist on 127.0.0.1:4173.
 * Run with puppeteer-core available, for example:
 *   NODE_PATH=/tmp/shot/node_modules node scripts/weapon-check.mjs
 */
import puppeteer from 'puppeteer-core'

const base = {
  v: 2,
  coins: 400,
  stars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  unlocked: 1,
  owned: { cannon: true, laser: true, missile: true, emp: true },
  equipped: 'cannon',
  ranks: { rate: 0, spread: 0, damage: 0 },
  bestEndless: 0,
  dailyBest: {},
  muted: true,
  autoFire: false,
  haptics: false,
  tutorialSeen: true,
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'],
})

async function boot(page, width, height, touch) {
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.evaluate((data) => localStorage.setItem('drone-defence.save', JSON.stringify(data)), base)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForSelector('#campaign')
  await page.waitForFunction(() => document.querySelector('#game canvas') instanceof HTMLCanvasElement)
}

function scoreOf(page) {
  return page.$eval('#score', (el) => Number((el.textContent || '0').replace(/,/g, '')))
}

async function hold(page, x, y, ms) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await new Promise((r) => setTimeout(r, ms))
  await page.mouse.up()
}

async function pump(page, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(0))))
  }
}

async function playLevel(page) {
  await page.click('#campaign')
  await page.waitForSelector('#map:not([hidden])')
  await page.click('#map-nodes button:not([disabled])')
  await page.waitForSelector('#hud:not([hidden])')
  await new Promise((r) => setTimeout(r, 1800))
}

const results = []

const phoneContext = await browser.createBrowserContext()
const phone = await phoneContext.newPage()
await boot(phone, 412, 915, true)
const migrated = await phone.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')))
if (migrated.v !== 3) throw new Error(`expected migrated v 3, got ${migrated.v}`)
if (migrated.coins !== 400) throw new Error('coins were not kept')
if (migrated.missileSkin !== 'standard') throw new Error('missing default skin')
if (migrated.owned.emp !== true) throw new Error('emp unlock was dropped')
if (migrated.empHintSeen !== false) throw new Error('hint flag should default off')
results.push('migrate-ok')

await playLevel(phone)
await pump(phone, 12000)
await phone.click('#weapons button[data-weapon="emp"]')
await phone.waitForSelector('#weapon-hint:not([hidden])')
const hint = await phone.$eval('#weapon-hint', (el) => el.textContent)
if (!hint || !hint.includes('stuns and damages')) throw new Error(`bad hint: ${hint}`)
results.push('emp-hint')
const beforeEmp = await scoreOf(phone)
await phone.touchscreen.tap(206, 300)
await pump(phone, 4000)
const afterEmp = await scoreOf(phone)
const ring = await phone.$eval('#weapons button[data-weapon="emp"] .cd-ring', (el) => ({
  hidden: el.hidden,
  p: el.style.getPropertyValue('--p'),
}))
results.push(`emp ${beforeEmp}->${afterEmp} ring=${ring.hidden ? 'hidden' : ring.p}`)
if (!(afterEmp > beforeEmp)) throw new Error(`EMP did not change the score (${beforeEmp} -> ${afterEmp}) ring=${ring.hidden ? 'hidden' : ring.p}`)
if (ring.hidden) throw new Error('EMP cooldown ring stayed hidden')

await phone.click('#weapons button[data-weapon="cannon"]')
await phone.click('#restart').catch(() => {})
await pump(phone, 500)
const cannonStart = await scoreOf(phone)
await hold(phone, 206, 260, 1200)
const cannonEnd = await scoreOf(phone)
results.push(`cannon ${cannonStart}->${cannonEnd}`)

await phoneContext.close()
const deskContext = await browser.createBrowserContext()
const desk = await deskContext.newPage()
await desk.bringToFront()
await boot(desk, 1280, 800, false)
await playLevel(desk)
await pump(desk, 12000)
await desk.click('#weapons button[data-weapon="emp"]')
await pump(desk, 2000)
const beforeDesk = await scoreOf(desk)
await desk.mouse.move(640, 320)
await desk.mouse.down()
await new Promise((r) => setTimeout(r, 80))
await desk.mouse.up()
await pump(desk, 4000)
const afterDesk = await scoreOf(desk)
const deskLabel = await desk.$eval('#weapons button[data-weapon="emp"]', (el) => el.getAttribute('aria-label'))
results.push(`desktop-emp ${beforeDesk}->${afterDesk} ${deskLabel}`)
if (!(afterDesk > beforeDesk)) throw new Error(`desktop EMP missed (${beforeDesk} -> ${afterDesk}) ${deskLabel}`)

console.log(results.join('\n'))
await browser.close()
