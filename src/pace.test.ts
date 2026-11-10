import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DIFFICULTY,
  LEVELS,
  bossKind,
  buildWaveEvents,
  campaignOutcome,
  difficultyFromSave,
  estimateClearSeconds,
  eventHp,
  waveCountFor,
} from './pace.ts'

test('a level stays open until its last wave is cleared', () => {
  assert.equal(LEVELS.length, 50)
  assert.equal(waveCountFor(1), 3)
  assert.equal(waveCountFor(12), 4)
  assert.equal(waveCountFor(40), 6)
  assert.equal(campaignOutcome(1, 3), 'next')
  assert.equal(campaignOutcome(2, 3), 'next')
  assert.equal(campaignOutcome(3, 3), 'clear')
  assert.equal(campaignOutcome(5, 6), 'next')
  assert.equal(campaignOutcome(6, 6), 'clear')
  for (const id of [10, 20, 30, 40, 50]) {
    const last = waveCountFor(id) - 1
    const events = buildWaveEvents(id, last, 'medium')
    assert.ok(events.some((event) => event.kind === bossKind(id)))
  }
  assert.equal(bossKind(9), 'none')
})

test('difficulty scales count, speed, hp, and spawn gaps', () => {
  const drones = (difficulty: 'easy' | 'medium' | 'hard') =>
    buildWaveEvents(25, 2, difficulty).filter((event) => event.kind === 'drone').length
  const easy = drones('easy')
  const medium = drones('medium')
  const hard = drones('hard')
  assert.ok(easy < medium)
  assert.ok(medium < hard)
  assert.equal(DIFFICULTY.medium.count, 1)
  assert.equal(DIFFICULTY.medium.speed, 1)
  assert.equal(DIFFICULTY.medium.hp, 1)
  assert.equal(DIFFICULTY.medium.rate, 1)
  assert.ok(DIFFICULTY.easy.count < 1 && DIFFICULTY.easy.speed < 1 && DIFFICULTY.easy.hp < 1 && DIFFICULTY.easy.rate < 1)
  assert.ok(DIFFICULTY.hard.count > 1 && DIFFICULTY.hard.speed > 1 && DIFFICULTY.hard.hp > 1 && DIFFICULTY.hard.rate > 1)
  assert.ok(eventHp('drone', 40, 'easy') < eventHp('drone', 40, 'medium'))
  assert.ok(eventHp('drone', 40, 'medium') < eventHp('drone', 40, 'hard'))
  assert.ok(eventHp('carrier', 50, 'medium') > eventHp('drone', 50, 'medium') * 8)
  const step = (difficulty: 'easy' | 'medium' | 'hard') => {
    const times = buildWaveEvents(30, 0, difficulty)
      .filter((event) => event.kind === 'drone')
      .map((event) => event.at)
    return times[1] - times[0]
  }
  assert.ok(step('easy') > step('medium'))
  assert.ok(step('hard') < step('medium'))
})

test('missing or old difficulty values default to medium', () => {
  assert.equal(difficultyFromSave(undefined), 'medium')
  assert.equal(difficultyFromSave(null), 'medium')
  assert.equal(difficultyFromSave('normal'), 'medium')
  assert.equal(difficultyFromSave('easy'), 'easy')
  assert.equal(difficultyFromSave('hard'), 'hard')
})

test('medium clear times for levels 10, 25, 40 and 50', () => {
  const times = {
    10: estimateClearSeconds(10, 'medium'),
    25: estimateClearSeconds(25, 'medium'),
    40: estimateClearSeconds(40, 'medium'),
    50: estimateClearSeconds(50, 'medium'),
  }
  console.log('simulated medium clear seconds', times)
  assert.ok(times[10] < times[25])
  assert.ok(times[25] < times[40])
  assert.ok(times[40] >= 45 && times[40] <= 90)
  assert.ok(times[50] >= 45 && times[50] <= 90)
  assert.ok(estimateClearSeconds(1, 'medium') < 30)
})
