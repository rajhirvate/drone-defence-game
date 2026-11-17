import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OVERDRIVE_NEED, OVERDRIVE_SECONDS, addCharge, overdriveGain, overdriveInterval, overdrivePellets, overdriveReady } from './overdrive.ts'

test('kills fill the overdrive meter until it is ready', () => {
  assert.equal(OVERDRIVE_SECONDS, 6)
  let charge = 0
  assert.equal(overdriveReady(charge, false), false)
  charge = addCharge(charge, overdriveGain('drone'), false)
  assert.equal(charge, 6)
  while (charge < OVERDRIVE_NEED) charge = addCharge(charge, overdriveGain('drone'), false)
  assert.equal(charge, OVERDRIVE_NEED)
  assert.equal(overdriveReady(charge, false), true)
  assert.equal(overdriveReady(charge, true), false)
  assert.equal(addCharge(40, 10, true), 40)
  assert.ok(overdriveGain('carrier') > overdriveGain('drone'))
})

test('overdrive speeds the current gun and widens spread', () => {
  assert.ok(overdriveInterval(0.16, true) < 0.16)
  assert.equal(overdriveInterval(0.16, false), 0.16)
  assert.equal(overdrivePellets(5, true, 'S'), 7)
  assert.equal(overdrivePellets(1, true, 'C'), 3)
  assert.equal(overdrivePellets(1, true, 'H'), 3)
  assert.equal(overdrivePellets(5, false, 'S'), 5)
})
