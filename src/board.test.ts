import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bossReward, insertScore, newBadges, type Career } from './board.ts'

const empty: Career = {
  kills: 0,
  bosses: 0,
  runs: 0,
  bestCombo: 0,
  coinsEarned: 0,
  dailies: 0,
  cleared: 0,
}

test('a level keeps its top five scores', () => {
  let board = insertScore([], 100)
  board = insertScore(board, 40)
  board = insertScore(board, 250)
  board = insertScore(board, 10)
  board = insertScore(board, 80)
  board = insertScore(board, 90)
  board = insertScore(board, 70)
  assert.deepEqual(board, [250, 100, 90, 80, 70])
  assert.deepEqual(insertScore([10], 0), [10])
})

test('boss drones pay a reward only on every 10th level', () => {
  assert.equal(bossReward(9), 0)
  assert.equal(bossReward(10), 50)
  assert.equal(bossReward(100), 230)
})

test('badges unlock from career stats and are not repeated', () => {
  const stats: Career = { ...empty, kills: 1, bosses: 1, cleared: 10, coinsEarned: 20 }
  assert.deepEqual(newBadges(stats, []), ['first-blood', 'boss', 'ten'])
  assert.deepEqual(newBadges(stats, ['first-blood']), ['boss', 'ten'])
})
