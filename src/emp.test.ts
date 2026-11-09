import assert from 'node:assert/strict'
import { test } from 'node:test'
import { empReach, inEmpRadius, ringReaches } from './emp.ts'

test('ring tags a drone as the pulse reaches it', () => {
  const drone = { active: true, attract: false, x: 200, y: 100, r: 12, empMark: 0 }
  assert.equal(ringReaches(0, 40, 200, 400, drone, 1), false)
  assert.equal(ringReaches(280, 320, 200, 400, drone, 1), true)
})

test('ring ignores attract drones and drones already tagged', () => {
  const origin = { x: 0, y: 0 }
  assert.equal(
    ringReaches(0, 100, origin.x, origin.y, { active: true, attract: true, x: 10, y: 0, r: 8, empMark: 0 }, 3),
    false,
  )
  assert.equal(
    ringReaches(0, 100, origin.x, origin.y, { active: true, attract: false, x: 10, y: 0, r: 8, empMark: 3 }, 3),
    false,
  )
  assert.equal(
    ringReaches(0, 100, origin.x, origin.y, { active: false, attract: false, x: 10, y: 0, r: 8, empMark: 0 }, 3),
    false,
  )
})

test('reach covers a wide screen from the turret', () => {
  const reach = empReach(640, 755, 1280, 800, 800 / 480, 230)
  assert.ok(reach >= Math.hypot(640, 755))
})

test('a drone spawning just above the screen is inside the pulse', () => {
  const originX = 206
  const originY = 890
  const radius = empReach(originX, originY, 412, 915, 412 / 480, 230)
  const spawning = { active: true, attract: false, x: originX, y: -30, r: 16, empMark: 0 }
  assert.equal(inEmpRadius(originX, originY, radius, spawning, 1), true)
  spawning.empMark = 1
  assert.equal(inEmpRadius(originX, originY, radius, spawning, 1), false)
})
