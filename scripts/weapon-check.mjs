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

async function playLevel(page) {
  await page.click('#campaign')
  await page.waitForSelector('#map:not([hidden])')
  await page.click('#map-nodes button:not([disabled])')
  await page.waitForSelector('#hud:not([hidden])')
  await new Promise((r) => setTimeout(r, 1800))
}

const results = []

const phone = await browser.newPage()
await boot(phone, 412, 915, true)
const migrated = await phone.evaluate(() => JSON.parse(localStorage.getItem('drone-defence.save')))
if (migrated.v !== 3) throw new Error(`expected migrated v 3, got ${migrated.v}`)
if (migrated.coins !== 400) throw new Error('coins were not kept')
if (migrated.missileSkin !== 'standard') throw new Error('missing default skin')
if (migrated.owned.emp !== true) throw new Error('emp unlock was dropped')
if (migrated.empHintSeen !== false) throw new Error('hint flag should default off')
results.push('migrate-ok')

await playLevel(phone)
const beforeCannon = await scoreOf(phone)
await hold(phone, 206, 280, 900)
const afterCannon = await scoreOf(phone)
results.push(`cannon ${beforeCannon}->${afterCannon}`)

await phone.click('#weapons button[data-weapon="laser"]')
await new Promise((r) => setTimeout(r, 200))
const beforeLaser = await scoreOf(phone)
await hold(phone, 206, 240, 900)
const afterLaser = await scoreOf(phone)
results.push(`laser ${beforeLaser}->${afterLaser}`)

await phone.click('#weapons button[data-weapon="missile"]')
await new Promise((r) => setTimeout(r, 200))
const beforeMissile = await scoreOf(phone)
await hold(phone, 206, 220, 1600)
const afterMissile = await scoreOf(phone)
results.push(`missile ${beforeMissile}->${afterMissile}`)

await phone.click('#weapons button[data-weapon="emp"]')
await phone.waitForSelector('#weapon-hint:not([hidden])')
const hint = await phone.$eval('#weapon-hint', (el) => el.textContent)
if (!hint || !hint.includes('stuns and damages')) throw new Error(`bad hint: ${hint}`)
results.push('emp-hint')
const beforeEmp = await scoreOf(phone)
await phone.touchscreen.tap(206, 300)
await new Promise((r) => setTimeout(r, 500))
const afterEmp = await scoreOf(phone)
const ring = await phone.$eval('#weapons button[data-weapon="emp"] .cd-ring', (el) => ({
  hidden: el.hidden,
  p: el.style.getPropertyValue('--p'),
}))
results.push(`emp ${beforeEmp}->${afterEmp} ring=${ring.hidden ? 'hidden' : ring.p}`)
if (!(afterEmp > beforeEmp)) throw new Error(`EMP did not change the score (${beforeEmp} -> ${afterEmp})`)
if (ring.hidden) throw new Error('EMP cooldown ring stayed hidden')

const desk = await browser.newPage()
await boot(desk, 1280, 800, false)
await playLevel(desk)
await desk.click('#weapons button[data-weapon="emp"]')
await new Promise((r) => setTimeout(r, 1600))
const beforeDesk = await scoreOf(desk)
await desk.mouse.click(640, 280)
await new Promise((r) => setTimeout(r, 500))
const afterDesk = await scoreOf(desk)
results.push(`desktop-emp ${beforeDesk}->${afterDesk}`)
if (!(afterDesk > beforeDesk)) throw new Error(`desktop EMP missed (${beforeDesk} -> ${afterDesk})`)

console.log(results.join('\n'))
await browser.close()
