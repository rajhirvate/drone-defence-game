import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CANNON, loseWeaponLevel, takeCapsule, tapHitsDrop } from './capsules.ts'

test('a capsule switches the turret off the cannon', () => {
  const next = takeCapsule(CANNON, 'M')
  assert.deepEqual(next.state, { letter: 'M', level: 1 })
  assert.equal(next.popup, 'M')
  const spread = takeCapsule(next.state, 'S')
  assert.deepEqual(spread.state, { letter: 'S', level: 1 })
})

test('the same letter levels the weapon up to MAX', () => {
  let state = takeCapsule(CANNON, 'S', 2).state
  assert.equal(state.level, 2)
  state = takeCapsule(state, 'S').state
  assert.equal(state.level, 3)
  const maxed = takeCapsule(state, 'S')
  assert.equal(maxed.popup, 'MAX')
  assert.equal(maxed.state.level, 4)
  assert.equal(takeCapsule(maxed.state, 'S').popup, 'MAX')
  assert.equal(takeCapsule(maxed.state, 'S').state.level, 4)
})

test('a city hit drops one level unless a shield is up', () => {
  const spread = { letter: 'S' as const, level: 3 }
  assert.deepEqual(loseWeaponLevel(spread, true), spread)
  assert.deepEqual(loseWeaponLevel(spread, false), { letter: 'S', level: 2 })
  assert.deepEqual(loseWeaponLevel({ letter: 'L', level: 1 }, false), CANNON)
  assert.deepEqual(loseWeaponLevel(CANNON, false), CANNON)
})

test('a tap collects a capsule from anywhere on its icon', () => {
  assert.equal(tapHitsDrop(10, 12, 36), true)
  assert.equal(tapHitsDrop(40, 0, 36), false)
  assert.equal(tapHitsDrop(0, 0, 28), true)
})
