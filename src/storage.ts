import { isMissileSkin, type MissileSkinId, type WeaponId } from './config'
import { LEVELS } from './campaign'
import { difficultyFromSave, type Difficulty } from './pace'

const SAVE_KEY = 'drone-defence.save'
const LEGACY_BEST = 'drone-defence.best'
const LEGACY_MUTE = 'drone-defence.muted'
const LEGACY_AUTO = 'drone-defence.autofire'

export interface SaveData {
  /** 2 and 3 are older saves. 4 adds difficulty and a 50-level star list. */
  v: 2 | 3 | 4
  coins: number
  /** Stars earned per level id. Index 0 is unused. */
  stars: number[]
  /** Highest level the player may start. */
  unlocked: number
  owned: Record<WeaponId, boolean>
  equipped: WeaponId
  ranks: { rate: number; spread: number; damage: number }
  bestEndless: number
  dailyBest: Record<string, number>
  muted: boolean
  autoFire: boolean | null
  haptics: boolean
  tutorialSeen: boolean
  missileSkin: MissileSkinId
  ownedSkins: Record<MissileSkinId, boolean>
  empHintSeen: boolean
  difficulty: Difficulty
}

function emptyStars(): number[] {
  return Array.from({ length: LEVELS.length + 1 }, () => 0)
}

function emptySave(): SaveData {
  return {
    v: 4,
    coins: 0,
    stars: emptyStars(),
    unlocked: 1,
    owned: { cannon: true, laser: false, missile: false, emp: false },
    equipped: 'cannon',
    ranks: { rate: 0, spread: 0, damage: 0 },
    bestEndless: 0,
    dailyBest: {},
    muted: false,
    autoFire: null,
    haptics: true,
    tutorialSeen: false,
    missileSkin: 'standard',
    ownedSkins: { standard: true, flare: false, needle: false, comet: false },
    empHintSeen: false,
    difficulty: 'medium',
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

function legacyBest(): number {
  const n = Number(read(LEGACY_BEST))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function sanitize(raw: Partial<SaveData> | null): SaveData {
  const base = emptySave()
  if (!raw || (raw.v !== 2 && raw.v !== 3 && raw.v !== 4)) return base
  base.coins = Math.max(0, Math.floor(raw.coins ?? 0))
  if (Array.isArray(raw.stars)) {
    for (let i = 1; i < base.stars.length; i++) {
      const n = raw.stars[i]
      base.stars[i] = n === 1 || n === 2 || n === 3 ? n : 0
    }
  }
  base.unlocked = Math.min(LEVELS.length, Math.max(1, Math.floor(raw.unlocked ?? 1)))
  const owned = raw.owned
  if (owned) {
    base.owned.laser = owned.laser === true
    base.owned.missile = owned.missile === true
    base.owned.emp = owned.emp === true
  }
  const equipped = raw.equipped
  if (equipped && base.owned[equipped]) base.equipped = equipped
  if (raw.ranks) {
    base.ranks.rate = clampRank(raw.ranks.rate)
    base.ranks.spread = clampRank(raw.ranks.spread)
    base.ranks.damage = clampRank(raw.ranks.damage)
  }
  base.bestEndless = Math.max(0, Math.floor(raw.bestEndless ?? 0))
  if (raw.dailyBest && typeof raw.dailyBest === 'object') {
    for (const [key, value] of Object.entries(raw.dailyBest)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof value === 'number' && value > 0) {
        base.dailyBest[key] = Math.floor(value)
      }
    }
  }
  base.muted = raw.muted === true
  base.autoFire = raw.autoFire === true ? true : raw.autoFire === false ? false : null
  base.haptics = raw.haptics !== false
  base.tutorialSeen = raw.tutorialSeen === true
  base.empHintSeen = raw.empHintSeen === true
  const ownedSkins = raw.ownedSkins
  if (ownedSkins) {
    base.ownedSkins.flare = ownedSkins.flare === true
    base.ownedSkins.needle = ownedSkins.needle === true
    base.ownedSkins.comet = ownedSkins.comet === true
  }
  if (typeof raw.missileSkin === 'string' && isMissileSkin(raw.missileSkin) && base.ownedSkins[raw.missileSkin]) {
    base.missileSkin = raw.missileSkin
  }
  base.difficulty = difficultyFromSave(raw.difficulty)
  return base
}

function clampRank(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.max(0, Math.min(5, Math.floor(n)))
}

export function loadSave(): SaveData {
  const raw = read(SAVE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>
      const save = sanitize(parsed)
      if (parsed.v !== 4) saveGame(save)
      return save
    } catch {
      return migrate()
    }
  }
  return migrate()
}

function migrate(): SaveData {
  const save = emptySave()
  save.bestEndless = legacyBest()
  save.muted = read(LEGACY_MUTE) === '1'
  const auto = read(LEGACY_AUTO)
  save.autoFire = auto === '1' ? true : auto === '0' ? false : null
  saveGame(save)
  return save
}

export function saveGame(save: SaveData): void {
  write(SAVE_KEY, JSON.stringify(save))
  if (save.bestEndless > 0) write(LEGACY_BEST, String(save.bestEndless))
  write(LEGACY_MUTE, save.muted ? '1' : '0')
  if (save.autoFire !== null) write(LEGACY_AUTO, save.autoFire ? '1' : '0')
}

export function defaultAutoFire(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}
