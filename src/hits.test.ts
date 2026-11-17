import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyHit, resistScale } from './hits.ts'

test('a shield ignores cannon and laser until a missile or EMP breaks it', () => {
  const blocked = applyHit(8, 4, 6, 'cannon')
  assert.equal(blocked.blocked, true)
  assert.equal(blocked.hp, 8)
  assert.equal(blocked.shield, 4)
  assert.equal(applyHit(8, 4, 2, 'laser').blocked, true)
  const cracked = applyHit(8, 4, 6, 'missile')
  assert.equal(cracked.blocked, false)
  assert.equal(cracked.shield, 0)
  assert.equal(cracked.hp, 6)
  const pulsed = applyHit(8, 2, 2, 'emp')
  assert.equal(pulsed.shield, 0)
  assert.equal(pulsed.hp, 8)
  const open = applyHit(8, 0, 3, 'cannon')
  assert.equal(open.hp, 5)
})

test('a plate shrugs off shells and yields to laser and flame', () => {
  assert.equal(resistScale('drone', 'cannon'), 1)
  assert.ok(resistScale('plate', 'cannon') < 0.4)
  assert.ok(resistScale('plate', 'missile') < 0.4)
  assert.ok(resistScale('plate', 'laser') > 1)
  assert.ok(resistScale('plate', 'flame') > 1)
  const soaked = 8 * resistScale('plate', 'cannon')
  const cut = 8 * resistScale('plate', 'laser')
  assert.ok(cut > soaked * 3)
})
