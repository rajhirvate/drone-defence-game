export type CapsuleLetter = 'M' | 'S' | 'L' | 'F' | 'H'

export const CAPSULE_LETTERS: readonly CapsuleLetter[] = ['M', 'S', 'L', 'F', 'H']

export const MAX_WEAPON_LEVEL = 4

export interface WeaponState {
  /** C is the basic cannon. */
  letter: CapsuleLetter | 'C'
  /** 0 for the cannon. 1–4 for a picked-up weapon. */
  level: number
}

export const CANNON: WeaponState = { letter: 'C', level: 0 }

export type WeaponPopup = 'LEVEL UP!' | 'MAX' | CapsuleLetter

export function isCapsule(value: string): value is CapsuleLetter {
  return value === 'M' || value === 'S' || value === 'L' || value === 'F' || value === 'H'
}

/** Picking a new letter switches the gun. The same letter levels it up. */
export function takeCapsule(
  state: WeaponState,
  letter: CapsuleLetter,
  firstLevel = 1,
): { state: WeaponState; popup: WeaponPopup } {
  const opened = Math.min(MAX_WEAPON_LEVEL, Math.max(1, firstLevel))
  if (state.letter !== letter) {
    return { state: { letter, level: opened }, popup: opened > 1 ? 'LEVEL UP!' : letter }
  }
  if (state.level >= MAX_WEAPON_LEVEL) return { state, popup: 'MAX' }
  const level = state.level + 1
  return { state: { letter, level }, popup: level >= MAX_WEAPON_LEVEL ? 'MAX' : 'LEVEL UP!' }
}

/** A city hit drops one weapon level. A shield charge prevents that. Level 1 falls back to the cannon. */
export function loseWeaponLevel(state: WeaponState, shielded: boolean): WeaponState {
  if (shielded || state.letter === 'C') return state
  if (state.level <= 1) return CANNON
  return { letter: state.letter, level: state.level - 1 }
}

export function weaponLabel(state: WeaponState): string {
  if (state.letter === 'C') return 'Cannon'
  const name = state.letter === 'M' ? 'Machine' : state.letter === 'S' ? 'Spread' : state.letter === 'L' ? 'Laser' : state.letter === 'F' ? 'Flame' : 'Homing'
  return state.level >= MAX_WEAPON_LEVEL ? `${name} MAX` : `${name} ${state.level}`
}

/** True when a tap lands on a drop. Reach is a generous phone radius around the capsule. */
export function tapHitsDrop(dx: number, dy: number, reach: number): boolean {
  return dx * dx + dy * dy <= reach * reach
}
