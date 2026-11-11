import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyHit } from './hits.ts'

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
