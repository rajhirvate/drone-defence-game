import type { MissileSkinId, UpgradeId, WeaponId } from './config'
import type { Difficulty } from './pace'

export type Phase = 'menu' | 'map' | 'armoury' | 'playing' | 'upgrade' | 'clear' | 'gameover'

export type GameMode = 'endless' | 'campaign' | 'daily'

export type EnemyKind = 'drone' | 'missile' | 'swarm' | 'shard' | 'carrier' | 'armour'

export type MoveMode = 'weave' | 'line' | 'arc' | 'shard' | 'flyby'

export interface Enemy {
  active: boolean
  kind: EnemyKind
  mode: MoveMode
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  hp: number
  maxHp: number
  r: number
  baseR: number
  score: number
  city: number
  phase: number
  freq: number
  amp: number
  baseAmp: number
  speed: number
  baseSpeed: number
  speedMul: number
  centerX: number
  targetX: number
  targetY: number
  x0: number
  y0: number
  cpx: number
  cpy: number
  age: number
  duration: number
  flash: number
  attract: boolean
  scriptKill: boolean
  killX: number
  seed: number
  stun: number
  empMark: number
}

export interface Bullet {
  active: boolean
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  life: number
  damage: number
  splash: number
  r: number
  flak: boolean
  homing: boolean
  turn: number
  skin: MissileSkinId
}

export interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  r: number
  color: number
  grav: number
  ring: boolean
}

export interface Marker {
  active: boolean
  x: number
  y: number
  life: number
  max: number
  angle: number
}

export interface Star {
  fx: number
  fy: number
  z: number
  size: number
  phase: number
  tw: number
}

export interface Fire {
  active: boolean
  fx: number
  life: number
  max: number
  seed: number
}

export interface Snapshot {
  phase: Phase
  score: number
  best: number
  wave: number
  /** Campaign levels report how many waves the level has. 0 elsewhere. */
  waveCount: number
  bossHp: number
  bossMax: number
  difficulty: Difficulty
  cityHp: number
  cityMax: number
  mult: number
  comboHot: boolean
  kills: number
  rateLevel: number
  spreadLevel: number
  damageLevel: number
  autoFire: boolean
  muted: boolean
  newBest: boolean
  banner: string
  hurt: number
  low: boolean
  repair: number
  cleanBonus: number
  intervalMs: number
  nextIntervalMs: number
  pellets: number
  nextPellets: number
  damage: number
  nextDamage: number
  splash: number
  nextSplash: number
  mode: GameMode
  coins: number
  weapon: WeaponId
  ownedLaser: boolean
  ownedMissile: boolean
  ownedEmp: boolean
  empCd: number
  empMax: number
  tutorial: string
  levelName: string
  clearStars: number
  clearCoins: number
  flash: number
  dailyDate: string
  dailyBest: number
  paused: boolean
  missileSkin: MissileSkinId
  ownedSkinKey: string
}

export type Command =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'upgrade'; id: UpgradeId }
  | { type: 'toggle-mute' }
  | { type: 'toggle-autofire' }
  | { type: 'toggle-haptics' }
  | { type: 'open-map' }
  | { type: 'open-armoury' }
  | { type: 'back-menu' }
  | { type: 'start-endless' }
  | { type: 'start-daily' }
  | { type: 'start-level'; id: number }
  | { type: 'equip'; id: WeaponId }
  | { type: 'buy-weapon'; id: Exclude<WeaponId, 'cannon'> }
  | { type: 'buy-rank'; id: UpgradeId }
  | { type: 'skip-tutorial' }
  | { type: 'to-map' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'fire-emp' }
  | { type: 'tap-fire' }
  | { type: 'buy-skin'; id: MissileSkinId }
  | { type: 'mark-emp-hint' }
  | { type: 'set-difficulty'; id: Difficulty }

export function blankSnapshot(): Snapshot {
  return {
    phase: 'menu',
    score: 0,
    best: 0,
    wave: 0,
    waveCount: 0,
    bossHp: 0,
    bossMax: 0,
    difficulty: 'medium',
    cityHp: 100,
    cityMax: 100,
    mult: 1,
    comboHot: false,
    kills: 0,
    rateLevel: 0,
    spreadLevel: 0,
    damageLevel: 0,
    autoFire: false,
    muted: false,
    newBest: false,
    banner: '',
    hurt: 0,
    low: false,
    repair: 0,
    cleanBonus: 0,
    intervalMs: 150,
    nextIntervalMs: 128,
    pellets: 1,
    nextPellets: 3,
    damage: 1,
    nextDamage: 2,
    splash: 0,
    nextSplash: 20,
    mode: 'endless',
    coins: 0,
    weapon: 'cannon',
    ownedLaser: false,
    ownedMissile: false,
    ownedEmp: false,
    empCd: 0,
    empMax: 7.2,
    tutorial: '',
    levelName: '',
    clearStars: 0,
    clearCoins: 0,
    flash: 0,
    dailyDate: '',
    dailyBest: 0,
    paused: false,
    missileSkin: 'standard',
    ownedSkinKey: '',
  }
}
