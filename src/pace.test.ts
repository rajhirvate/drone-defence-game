import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DIFFICULTY,
  LEVELS,
  bossKind,
  buildWaveEvents,
  campaignOutcome,
  chainReady,
  difficultyFromSave,
  droneCount,
  estimateClearSeconds,
  eventHp,
  slowOnKill,
  waveCountFor,
} from './pace.ts'

test('a level stays open until its last wave is cleared', () => {
  assert.equal(LEVELS.length, 100)
  assert.equal(waveCountFor(1), 4)
  assert.equal(waveCountFor(12), 5)
  assert.equal(waveCountFor(40), 6)
  assert.equal(waveCountFor(90), 8)
  assert.equal(campaignOutcome(1, 3), 'next')
  assert.equal(campaignOutcome(2, 3), 'next')
  assert.equal(campaignOutcome(3, 3), 'clear')
  assert.equal(campaignOutcome(5, 6), 'next')
  assert.equal(campaignOutcome(6, 6), 'clear')
  for (const id of [10, 20, 50, 80, 90, 100]) {
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

test('slow-motion is only the last kill, and waves chain without a pause', () => {
  const finalKill = { mode: 'campaign' as const, waveIndex: 4, waveTotal: 4, hostilesRemain: false }
  assert.equal(slowOnKill(finalKill), true)
  assert.equal(slowOnKill({ ...finalKill, hostilesRemain: true }), false)
  assert.equal(slowOnKill({ ...finalKill, waveIndex: 3 }), false)
  assert.equal(slowOnKill({ ...finalKill, waveIndex: 1, waveTotal: 3 }), false)
  assert.equal(slowOnKill({ mode: 'endless', waveIndex: 6, waveTotal: 6, hostilesRemain: false }), false)
  assert.equal(slowOnKill({ mode: 'daily', waveIndex: 2, waveTotal: 2, hostilesRemain: false }), false)
  assert.equal(chainReady(0, 4, 1, 4), true)
  assert.equal(chainReady(0, 0, 2, 4), true)
  assert.equal(chainReady(1, 0, 2, 4), false)
  assert.equal(chainReady(0, 5, 2, 4), false)
  assert.equal(chainReady(0, 0, 4, 4), false)
})

test('each wave has strictly more drones than the one before it', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    for (let id = 1; id <= 100; id++) {
      let previous = 0
      for (let wave = 0; wave < waveCountFor(id); wave++) {
        const spawned = buildWaveEvents(id, wave, difficulty).filter((event) => event.kind === 'drone').length
        const planned = droneCount(id, wave, difficulty)
        assert.equal(spawned, planned)
        if (wave > 0) {
          assert.ok(spawned >= previous + 1, `${difficulty} L${id} wave ${wave}`)
          assert.ok(spawned <= Math.max(previous + 1, Math.round(previous * 1.35)))
        }
        previous = spawned
      }
    }
  }
  const report = [1, 10, 25, 50, 75, 90, 100].map((id) => {
    const counts = []
    for (let wave = 0; wave < waveCountFor(id); wave++) counts.push(droneCount(id, wave, 'medium'))
    return `${id}: ${counts.join(', ')}`
  })
  console.log('medium drone counts', report.join(' | '))
  const opening = droneCount(1, 0, 'medium')
  assert.ok(opening >= 40)
  assert.ok(droneCount(1, 1, 'medium') > opening)
})

test('medium clear times for levels 1, 10, 25, 40 and 50', () => {
  const times = {
    1: estimateClearSeconds(1, 'medium'),
    10: estimateClearSeconds(10, 'medium'),
    25: estimateClearSeconds(25, 'medium'),
    50: estimateClearSeconds(50, 'medium'),
    75: estimateClearSeconds(75, 'medium'),
    90: estimateClearSeconds(90, 'medium'),
    100: estimateClearSeconds(100, 'medium'),
  }
  console.log('simulated medium clear seconds', times)
  assert.ok(times[1] >= 40 && times[1] <= 60)
  assert.ok(times[10] >= 40 && times[10] <= 60)
  assert.ok(times[90] >= 90 && times[90] <= 120)
  assert.ok(times[100] >= 90 && times[100] <= 120)
  assert.ok(times[1] < times[25])
  assert.ok(times[25] < times[90])
})
