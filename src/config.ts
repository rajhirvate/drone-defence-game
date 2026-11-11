/** Player-facing name. index.html and the web manifest are filled from this constant. */
export const GAME_TITLE = 'Drone Defence'

export const GAME_DESCRIPTION =
  'Arcade defence game. Aim a turret and shoot down fictional drones and missiles before they reach the city skyline.'

export type UpgradeId = 'rate' | 'spread' | 'damage' | 'emp' | 'vital'

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
  {
    id: 'emp',
    name: 'EMP Cycle',
    blurb: 'The pulse cools down faster.',
  },
  {
    id: 'vital',
    name: 'City Plating',
    blurb: 'The skyline holds more damage.',
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
  maxActive: 18,
  maxParticles: 80,
  maxBullets: 64,
  maxEnemies: 48,
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

export type WeaponId = 'cannon' | 'laser' | 'missile' | 'emp'

export const MISSILE_SKINS = [
  { id: 'standard', name: 'Standard', cost: 0, blurb: 'Cyan dart and a clean trail.' },
  { id: 'flare', name: 'Flare', cost: 45, blurb: 'Wide amber body and a fire trail.' },
  { id: 'needle', name: 'Needle', cost: 80, blurb: 'Slim bolt with a long white streak.' },
  { id: 'halo', name: 'Halo', cost: 90, blurb: 'Cyan core inside an amber ring.' },
  { id: 'viper', name: 'Viper', cost: 110, blurb: 'A green-gold chevron and twin trails.' },
  { id: 'comet', name: 'Comet', cost: 140, blurb: 'Violet head and a ring burst.' },
  { id: 'lantern', name: 'Lantern', cost: 170, blurb: 'A round amber lamp with a warm wake.' },
  { id: 'prism', name: 'Prism', cost: 210, blurb: 'White crystal with cyan and amber facets.' },
] as const

export type MissileSkinId = (typeof MISSILE_SKINS)[number]['id']

export const TURRET_SKINS = [
  { id: 'navy', name: 'Navy', cost: 0, blurb: 'The battery’s own paint.' },
  { id: 'amber', name: 'Amber', cost: 40, blurb: 'Warm barrel and a brass housing.' },
  { id: 'cyan', name: 'Cyan', cost: 70, blurb: 'Pale barrel and a signal-blue base.' },
  { id: 'violet', name: 'Violet', cost: 110, blurb: 'A dusk housing and a lilac barrel.' },
] as const

export type TurretSkinId = (typeof TURRET_SKINS)[number]['id']

export function isMissileSkin(id: string): id is MissileSkinId {
  return MISSILE_SKINS.some((skin) => skin.id === id)
}

export function isTurretSkin(id: string): id is TurretSkinId {
  return TURRET_SKINS.some((skin) => skin.id === id)
}

export const WEAPONS = {
  cannon: { name: 'Cannon', blurb: 'Rapid shells. Spread and damage ranks apply.' },
  laser: { name: 'Laser', blurb: 'A continuous beam.', tick: 0.12, damage: 1.4, range: 920 },
  missile: { name: 'Missile battery', blurb: 'Slow homing shells.', interval: 0.52, damage: 4, speed: 460, turn: 2.6 },
  emp: {
    name: 'EMP',
    blurb: 'Tap to fire. Stuns and damages nearby drones.',
    cooldown: 7.2,
    radius: 230,
    stun: 2.3,
    damage: 2,
  },
} as const

export const SHOP = {
  unlock: { laser: 40, missile: 70, emp: 90 } as Record<Exclude<WeaponId, 'cannon'>, number>,
  rankBase: 25,
  maxRank: 5,
}

export function rankCost(rank: number): number {
  return SHOP.rankBase * (rank + 1)
}

export function empCooldown(rank: number): number {
  return WEAPONS.emp.cooldown * Math.pow(0.88, Math.max(0, rank))
}

export function cityMaxFor(rank: number): number {
  return BALANCE.cityMax + Math.max(0, rank) * 16
}

export const COINS = {
  drone: 4,
  scout: 3,
  tank: 7,
  splitter: 8,
  kamikaze: 5,
  shield: 7,
  missile: 6,
  swarm: 8,
  shard: 2,
  carrier: 20,
  armour: 16,
} as const

export const STAR_RULE = { three: 0.7, two: 0.4 }

export function starsFor(hp: number, max: number): number {
  const ratio = max <= 0 ? 0 : hp / max
  if (ratio >= STAR_RULE.three) return 3
  if (ratio >= STAR_RULE.two) return 2
  return 1
}

export const BOSSES = {
  carrier: { hp: 26, speed: 32, radius: 34, score: 800, city: 22, launchEvery: 2.3 },
  armour: { hp: 14, speed: 70, radius: 18, score: 700, city: 20 },
} as const

export const FEEL = {
  hitStop: 0.055,
  slowScale: 0.28,
  slowTime: 0.5,
  bossSlow: 0.8,
} as const

export const TUTORIAL = [
  'Move the pointer to aim the barrel.',
  'Hold to fire, or leave auto-fire on and steer.',
  'Drop a drone before it touches a roof.',
  'The city bar is the skyline. Do not let it empty.',
] as const

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
