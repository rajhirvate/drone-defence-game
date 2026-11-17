import type { WeaponId } from './config'
import {
  DIFFICULTY,
  LEVELS as PACES,
  buildWaveEvents,
  pressure,
  type Difficulty,
  type LevelPace,
} from './pace'
import type { SpawnEvent, WaveSpec } from './waves'

export type { Difficulty }
export type LevelDef = LevelPace & { grant?: WeaponId }

export const LEVELS: readonly LevelDef[] = PACES

export function levelById(id: number): LevelDef {
  return LEVELS[id - 1] ?? LEVELS[0]
}

export {
  CHAIN_LEAD,
  DIFFICULTY,
  campaignOutcome,
  chainReady,
  droneCount,
  eventHp,
  shieldFor,
  slowOnKill,
  waveCountFor,
} from './pace'

/** One sub-wave of a campaign level, already scaled by difficulty. */
export function buildLevelWave(level: LevelDef, waveIndex: number, difficulty: Difficulty): WaveSpec {
  const p = pressure(level.id)
  const speed = (0.74 + p * 0.52) * DIFFICULTY[difficulty].speed
  const events = buildWaveEvents(level.id, waveIndex, difficulty) as SpawnEvent[]
  return { wave: waveIndex + 1, speed, events }
}
