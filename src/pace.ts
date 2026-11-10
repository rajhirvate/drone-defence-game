/** Level pace, difficulty, and a clear-time estimate. No other local imports so tests can load it directly. */

export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY = {
  easy: { count: 0.75, speed: 0.82, hp: 0.75, rate: 0.8 },
  medium: { count: 1, speed: 1, hp: 1, rate: 1 },
  hard: { count: 1.35, speed: 1.22, hp: 1.4, rate: 1.28 },
} as const

export const CLEAR_DELAY = 0.65
/** Next wave starts while this many hostiles from the current wave are still alive. */
export const WAVE_OVERLAP = 2
/** Seconds after the handoff before the next wave's first drone appears. */
export const CHAIN_LEAD = 0.12

export type PaceSide = 'top' | 'left' | 'right'
export type PaceKind = 'drone' | 'missile' | 'swarm' | 'marker' | 'carrier' | 'armour'

export interface PaceEvent {
  at: number
  kind: PaceKind
  lane: number
  arc: boolean
  side: PaceSide
  arcAmp: number
}

export interface LevelPace {
  id: number
  name: string
  coins: number
  waves: number
  boss: 'none' | 'carrier' | 'armour'
  grant?: 'laser' | 'missile' | 'emp'
}

const NAMES = [
  'First Light', 'Crosswind', 'Fast Movers', 'Mixed Sky', 'Lantern Row',
  'Splitters', 'Thick Air', 'Twin Swarms', 'Battery Test', 'The Carrier',
  'Night Rush', 'Last Roof', 'Glass Mile', 'Low Cloud', 'Red Beacons',
  'Crossfire', 'Hangar Drift', 'Signal Row', 'Blackout', 'Iron Rain',
  'South Span', 'Cold Front', 'Relay', 'Double Tap', 'High Court',
  'Amber Line', 'Wharf', 'Overcast', 'Switchback', 'Crown Fire',
  'Pier Lights', 'Gust', 'Narrows', 'Stack', 'Blue Hour',
  'Kiln', 'North Slip', 'Echo', 'Hard Deck', 'Siege',
  'Quay', 'Whiteout', 'Gantry', 'Heat Haze', 'Long Watch',
  'Cinder', 'Vault', 'Riptide', 'Final Grid', 'Last Battery',
]

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n
}

export function difficultyFromSave(value: unknown): Difficulty {
  return value === 'easy' || value === 'hard' || value === 'medium' ? value : 'medium'
}

export function pressure(levelId: number): number {
  return clamp((levelId - 1) / 49, 0, 1)
}

export function waveCountFor(levelId: number): number {
  if (levelId <= 8) return 3
  if (levelId <= 20) return 4
  if (levelId <= 35) return 5
  return 6
}

export function bossKind(levelId: number): 'none' | 'carrier' | 'armour' {
  if (levelId % 10 !== 0) return 'none'
  return levelId % 20 === 0 ? 'armour' : 'carrier'
}

/** A level is still going until the wave index catches the last wave. Index is 1-based. */
export function campaignOutcome(waveIndex: number, waveTotal: number): 'next' | 'clear' {
  return waveIndex < waveTotal ? 'next' : 'clear'
}

/** Slow-motion only on the kill that actually finishes the last wave of a level. */
export function slowOnKill(args: {
  mode: 'campaign' | 'endless' | 'daily'
  waveIndex: number
  waveTotal: number
  hostilesRemain: boolean
}): boolean {
  if (args.mode !== 'campaign' || args.waveTotal <= 0) return false
  return args.waveIndex >= args.waveTotal && !args.hostilesRemain
}

/** The next wave can start once this one has no spawns left and has thinned out. */
export function chainReady(queued: number, alive: number, waveIndex: number, waveTotal: number): boolean {
  return waveIndex < waveTotal && queued <= 0 && alive <= WAVE_OVERLAP
}

/** How many hostiles can be in the air at once. Matches the play scene cap. */
export const ON_SCREEN = 18

/** Drone count for one wave. Later waves are strictly larger, about +28%, and at least +1. */
export function droneCount(levelId: number, waveIndex: number, difficulty: Difficulty): number {
  const p = pressure(levelId)
  const base = Math.max(4, Math.round((5.6 + p * 9) * DIFFICULTY[difficulty].count))
  let count = base
  for (let i = 0; i < waveIndex; i++) count = Math.max(count + 1, Math.round(count * 1.28))
  return count
}

export function buildLevels(): LevelPace[] {
  return NAMES.map((name, i) => {
    const id = i + 1
    const boss = bossKind(id)
    const grant = id === 3 ? 'laser' : id === 6 ? 'missile' : id === 9 ? 'emp' : undefined
    const coins = Math.round(22 + id * 3.1 + (boss === 'none' ? 0 : 36))
    return { id, name, coins, waves: waveCountFor(id), boss, grant }
  })
}

export const LEVELS: readonly LevelPace[] = buildLevels()

export function levelById(id: number): LevelPace {
  return LEVELS[id - 1] ?? LEVELS[0]
}

function bodyHp(kind: 'drone' | 'missile' | 'swarm', levelId: number, difficulty: Difficulty): number {
  const p = pressure(levelId)
  const base = kind === 'drone' ? 2 : kind === 'missile' ? 2 : 5
  const growth = 1 + p * 3.1
  return Math.max(1, Math.round(base * growth * DIFFICULTY[difficulty].hp))
}

export function bossHull(kind: 'carrier' | 'armour', levelId: number, difficulty: Difficulty): number {
  const p = pressure(levelId)
  const base = kind === 'carrier' ? 80 : 64
  const growth = 1 + p * p * 18
  return Math.max(base, Math.round(base * growth * DIFFICULTY[difficulty].hp))
}

function push(
  events: PaceEvent[],
  at: number,
  kind: PaceKind,
  lane: number,
  side: PaceSide = 'top',
  arc = false,
  arcAmp = 0,
): void {
  events.push({ at, kind, lane: clamp(lane, 0.06, 0.94), arc, side, arcAmp })
}

function formation(
  pattern: 'line' | 'vee' | 'flank' | 'swarm' | 'stream',
  count: number,
  start: number,
  stagger: number,
  rand: () => number,
): PaceEvent[] {
  const events: PaceEvent[] = []
  if (pattern === 'line') {
    for (let i = 0; i < count; i++) {
      const lane = 0.12 + ((i + 0.5) / count) * 0.76
      push(events, start + i * stagger, 'drone', lane)
    }
  } else if (pattern === 'vee') {
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const step = Math.floor(i / 2)
      const lane = 0.5 + side * Math.min(0.4, 0.08 + step * 0.07)
      push(events, start + step * stagger * 0.85, 'drone', lane)
    }
  } else if (pattern === 'flank') {
    for (let i = 0; i < count; i++) {
      const left = i % 2 === 0
      const lane = left ? 0.1 + (i / count) * 0.22 : 0.68 + (i / count) * 0.22
      push(events, start + i * stagger, 'drone', lane, left ? 'left' : 'right')
    }
  } else if (pattern === 'swarm') {
    const groups = Math.max(1, Math.ceil(count / 3))
    let n = 0
    for (let g = 0; g < groups; g++) {
      const lane = 0.18 + ((g + 0.5) / groups) * 0.64
      for (let k = 0; k < 3 && n < count; k++) {
        push(events, start + g * stagger * 1.2 + k * 0.12, 'drone', lane + (k - 1) * 0.05)
        n++
      }
    }
  } else {
    let lane = 0.25 + rand() * 0.5
    for (let i = 0; i < count; i++) {
      lane = clamp(lane + (rand() - 0.5) * 0.18, 0.1, 0.9)
      push(events, start + i * stagger * 1.15, 'drone', lane)
    }
  }
  return events
}

export function buildWaveEvents(levelId: number, waveIndex: number, difficulty: Difficulty): PaceEvent[] {
  const p = pressure(levelId)
  const diff = DIFFICULTY[difficulty]
  const rand = mulberry32(4000 + levelId * 131 + waveIndex * 17 + (difficulty === 'hard' ? 9 : difficulty === 'easy' ? 3 : 1))
  const patternCycle = ['line', 'vee', 'stream', 'flank', 'swarm'] as const
  const pattern = patternCycle[(levelId + waveIndex) % patternCycle.length]
  const late = waveIndex / Math.max(1, waveCountFor(levelId) - 1)
  const drones = droneCount(levelId, waveIndex, difficulty)
  const stagger = (0.5 - p * 0.06) / diff.rate
  const start = 0.7
  const events = formation(pattern, drones, start, stagger, rand)
  const span = Math.max(...events.map((e) => e.at), start)

  const missiles = Math.max(0, Math.round((levelId < 4 ? 0 : 1 + p * 3 + late) * diff.count))
  for (let i = 0; i < missiles; i++) {
    const at = start + ((i + 0.5) / missiles) * Math.max(1.2, span - start)
    const lane = 0.12 + rand() * 0.76
    const side: PaceSide = p > 0.35 && rand() < 0.34 ? (rand() < 0.5 ? 'left' : 'right') : 'top'
    push(events, Math.max(0.4, at - 0.55), 'marker', lane, side, true, rand() * 2 - 1)
    push(events, at, 'missile', lane, side, rand() < 0.45, rand() * 2 - 1)
  }

  const swarms = levelId < 7 ? 0 : Math.max(0, Math.round((p * 2 + (late > 0.6 ? 1 : 0)) * diff.count))
  for (let i = 0; i < swarms; i++) {
    const at = start + 0.8 + i * stagger * 2
    push(events, at, 'swarm', 0.22 + rand() * 0.56)
  }

  const boss = bossKind(levelId)
  if (boss !== 'none' && waveIndex === waveCountFor(levelId) - 1) {
    const lane = 0.5
    if (boss === 'armour') {
      push(events, 0.7, 'marker', lane, 'top', true, 0.2)
      push(events, 1.35, 'armour', lane, 'top', true, 0.35)
    } else {
      push(events, 1.1, 'carrier', lane)
    }
  }

  events.sort((a, b) => a.at - b.at)
  return events
}

export function eventHp(kind: PaceKind, levelId: number, difficulty: Difficulty): number {
  if (kind === 'marker') return 0
  if (kind === 'carrier' || kind === 'armour') return bossHull(kind, levelId, difficulty)
  return bodyHp(kind, levelId, difficulty)
}

const MAX_RANK = 5

function fireInterval(rank: number): number {
  return Math.max(0.045, 0.13 * Math.pow(0.86, rank))
}

interface SimUnit {
  at: number
  hp: number
  boss: boolean
  spawned: boolean
  left: number
}

/**
 * Seconds to clear a campaign level with max cannon ranks, auto-fire, and EMP on cooldown.
 * The next wave starts as the previous one thins out, so there is no pause between waves.
 */
export function estimateClearSeconds(levelId: number, difficulty: Difficulty = 'medium'): number {
  const total = waveCountFor(levelId)
  const interval = fireInterval(MAX_RANK)
  const damage = 1 + MAX_RANK
  let clock = 0
  let carry: SimUnit[] = []
  for (let w = 0; w < total; w++) {
    const raw = buildWaveEvents(levelId, w, difficulty).filter((e) => e.kind !== 'marker')
    const first = raw.length ? raw[0].at : 0
    const queue: SimUnit[] = raw.map((e) => {
      const at = w === 0 ? e.at : CHAIN_LEAD + Math.max(0, e.at - first)
      const hp = eventHp(e.kind, levelId, difficulty)
      return { at, hp, boss: e.kind === 'carrier' || e.kind === 'armour', spawned: false, left: hp }
    })
    for (const leftover of carry) queue.push({ ...leftover, at: 0, spawned: true })
    let t = 0
    let shot = 0.15
    let emp = 1.2
    let guard = 0
    const last = w === total - 1
    while (guard < 40000) {
      const pending = queue.some((q) => !q.spawned)
      const alive = queue.filter((q) => q.spawned && q.left > 0).length
      if (!pending && (last ? alive === 0 : alive <= WAVE_OVERLAP)) break
      guard++
      t += 0.05
      shot -= 0.05
      emp -= 0.05
      let spawnedAlive = queue.filter((q) => q.spawned && q.left > 0).length
      for (const q of queue) {
        if (q.spawned || q.at > t) continue
        if (spawnedAlive >= ON_SCREEN) break
        q.spawned = true
        spawnedAlive++
      }
      if (emp <= 0) {
        emp = 7.2
        for (const q of queue) {
          if (q.spawned && q.left > 0 && t >= q.at + 0.35) q.left -= 2
        }
      }
      if (shot > 0) continue
      const ready = queue.filter((q) => q.spawned && q.left > 0 && t >= q.at + 0.4)
      if (ready.length === 0) continue
      shot = interval
      let pellets = 5
      const boss = ready.find((q) => q.boss)
      if (boss) {
        const n = Math.min(3, pellets)
        boss.left -= damage * n
        pellets -= n
      }
      for (const q of ready) {
        if (q.boss || pellets <= 0 || q.left <= 0) continue
        q.left -= damage
        pellets -= 1
      }
    }
    clock += t
    carry = queue.filter((q) => q.spawned && q.left > 0)
  }
  return clock + CLEAR_DELAY
}
