/** Player-facing name. index.html and the web manifest are filled from this constant. */
export const GAME_TITLE = 'Drone Defence'

export const GAME_DESCRIPTION =
  'Arcade defence game. Aim a turret and shoot down fictional drones and missiles before they reach the city skyline.'

export type UpgradeId = 'rate' | 'spread' | 'damage'

export interface UpgradeDef {
  id: UpgradeId
  name: string
  blurb: string
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'rate',
    name: 'Rapid Cycle',
    blurb: 'Shorter gap between shots.',
  },
  {
    id: 'spread',
    name: 'Flak Burst',
    blurb: 'Extra shells in a fan, with splash.',
  },
  {
    id: 'damage',
    name: 'Heavy Rounds',
    blurb: 'Each hit tears off more hull.',
  },
]

export const BALANCE = {
  cityMax: 100,
  repair: 12,
  comboWindow: 1.45,
  maxMult: 8,
  bulletSpeed: 980,
  bulletLife: 1.25,
  bulletRadius: 4.5,
  tracer: 56,
  maxActive: 12,
  maxParticles: 80,
  maxBullets: 64,
  maxEnemies: 32,
  fireIntervalBase: 0.13,
  fireIntervalFactor: 0.86,
  fireIntervalMin: 0.045,
  maxPellets: 5,
  spreadBase: 0.11,
  drone: { hp: 2, speed: 62, score: 100, city: 6, radius: 18, amp: 28 },
  missile: { hp: 1, speed: 132, score: 160, city: 12, radius: 12 },
  swarm: { hp: 4, speed: 48, score: 240, city: 14, radius: 26 },
  shard: { hp: 1, speed: 120, score: 70, city: 5, radius: 9 },
  cleanBonusPerWave: 250,
  bannerTime: 1.05,
  clearDelay: 0.65,
  aimMin: -Math.PI + 0.34,
  aimMax: -0.34,
} as const

export function fireInterval(level: number): number {
  return Math.max(
    BALANCE.fireIntervalMin,
    BALANCE.fireIntervalBase * Math.pow(BALANCE.fireIntervalFactor, level),
  )
}

export function pelletCount(level: number): number {
  return Math.min(BALANCE.maxPellets, 1 + level * 2)
}

export function spreadStep(level: number): number {
  return BALANCE.spreadBase + Math.max(0, level - 2) * 0.014
}

export function splashRadius(level: number, unit: number): number {
  if (level <= 0) return 0
  return unit * (20 + level * 7)
}

export function shellDamage(level: number): number {
  return 1 + level
}

export function hpFor(kind: 'drone' | 'missile' | 'swarm' | 'shard', wave: number): number {
  const tier = Math.floor(Math.max(0, wave - 1) / 4)
  switch (kind) {
    case 'drone':
      return BALANCE.drone.hp + tier
    case 'missile':
      return BALANCE.missile.hp + Math.floor(tier / 2)
    case 'swarm':
      return BALANCE.swarm.hp + tier
    case 'shard':
      return BALANCE.shard.hp
  }
}
