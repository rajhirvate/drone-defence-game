import type { WeaponId } from './config'
import { clamp, mulberry32 } from './math'
import type { SpawnEvent, WaveSpec } from './waves'

export interface LevelDef {
  id: number
  name: string
  coins: number
  speed: number
  drones: number
  missiles: number
  swarms: number
  boss: 'none' | 'carrier' | 'armour'
  grant?: WeaponId
}

/** Hand-tuned. Bosses sit on every 5th level. */
export const LEVELS: readonly LevelDef[] = [
  { id: 1, name: 'First Light', coins: 25, speed: 0.78, drones: 4, missiles: 0, swarms: 0, boss: 'none' },
  { id: 2, name: 'Crosswind', coins: 30, speed: 0.84, drones: 5, missiles: 0, swarms: 0, boss: 'none' },
  { id: 3, name: 'Fast Movers', coins: 35, speed: 0.88, drones: 4, missiles: 1, swarms: 0, boss: 'none', grant: 'laser' },
  { id: 4, name: 'Mixed Sky', coins: 40, speed: 0.92, drones: 5, missiles: 2, swarms: 0, boss: 'none' },
  { id: 5, name: 'The Carrier', coins: 70, speed: 0.86, drones: 3, missiles: 0, swarms: 0, boss: 'carrier' },
  { id: 6, name: 'Splitters', coins: 45, speed: 0.94, drones: 4, missiles: 1, swarms: 1, boss: 'none', grant: 'missile' },
  { id: 7, name: 'Thick Air', coins: 50, speed: 0.98, drones: 6, missiles: 2, swarms: 0, boss: 'none' },
  { id: 8, name: 'Twin Swarms', coins: 55, speed: 1, drones: 3, missiles: 1, swarms: 2, boss: 'none' },
  { id: 9, name: 'Battery Test', coins: 60, speed: 1.02, drones: 5, missiles: 2, swarms: 1, boss: 'none', grant: 'emp' },
  { id: 10, name: 'Armour', coins: 80, speed: 0.96, drones: 4, missiles: 1, swarms: 0, boss: 'armour' },
  { id: 11, name: 'Night Rush', coins: 65, speed: 1.06, drones: 6, missiles: 3, swarms: 1, boss: 'none' },
  { id: 12, name: 'Last Roof', coins: 100, speed: 1.04, drones: 3, missiles: 2, swarms: 1, boss: 'carrier' },
]

export function levelById(id: number): LevelDef {
  return LEVELS[id - 1] ?? LEVELS[0]
}

export function buildLevelWave(level: LevelDef): WaveSpec {
  const rand = mulberry32(1000 + level.id * 97)
  const events: SpawnEvent[] = []
  let t = 0.45
  const stagger = level.speed < 0.9 ? 0.7 : 0.55
  for (let i = 0; i < level.drones; i++) {
    const lane = clamp(0.2 + ((i + 0.5) / Math.max(1, level.drones)) * 0.6 + (rand() - 0.5) * 0.05, 0.12, 0.88)
    events.push({ at: t, kind: 'drone', lane, arc: false, side: 'top', arcAmp: 0 })
    t += stagger
  }
  const span = Math.max(t, 2.2)
  for (let i = 0; i < level.missiles; i++) {
    const lane = clamp(0.18 + rand() * 0.64, 0.12, 0.88)
    const at = span * (0.42 + (0.4 * (i + 1)) / (level.missiles + 1))
    events.push({ at: Math.max(0.3, at - 0.7), kind: 'marker', lane, arc: false, side: 'top', arcAmp: 0 })
    events.push({ at, kind: 'missile', lane, arc: rand() < 0.4, side: 'top', arcAmp: rand() * 2 - 1 })
  }
  for (let i = 0; i < level.swarms; i++) {
    const lane = clamp(0.28 + rand() * 0.44, 0.18, 0.82)
    events.push({ at: 1.3 + i * 1.6, kind: 'swarm', lane, arc: false, side: 'top', arcAmp: 0 })
  }
  if (level.boss === 'carrier') {
    events.push({ at: 1.1, kind: 'carrier', lane: 0.5, arc: false, side: 'top', arcAmp: 0 })
  }
  if (level.boss === 'armour') {
    events.push({ at: 0.8, kind: 'marker', lane: 0.5, arc: false, side: 'top', arcAmp: 0 })
    events.push({ at: 1.5, kind: 'armour', lane: 0.5, arc: true, side: 'top', arcAmp: 0.4 })
  }
  events.sort((a, b) => a.at - b.at)
  return { wave: level.id, speed: level.speed, events }
}
