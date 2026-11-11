export type HitSource = 'cannon' | 'laser' | 'missile' | 'emp'

/** Shields soak cannon and laser shots. EMP and missiles break them. */
export function applyHit(
  hp: number,
  shield: number,
  amount: number,
  source: HitSource,
): { hp: number; shield: number; blocked: boolean } {
  if (shield > 0 && source !== 'emp' && source !== 'missile') {
    return { hp, shield, blocked: true }
  }
  if (shield > 0) {
    const used = Math.min(shield, amount)
    return { hp: hp - Math.max(0, amount - used), shield: shield - used, blocked: false }
  }
  return { hp: hp - amount, shield: 0, blocked: false }
}
