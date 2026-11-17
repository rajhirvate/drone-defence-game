export type HitSource = 'cannon' | 'laser' | 'missile' | 'emp' | 'flame'

/** Plates shrug off shells. Laser and flame cut them. */
export function resistScale(kind: string, source: HitSource): number {
  if (kind !== 'plate') return 1
  if (source === 'laser' || source === 'flame') return 1.25
  if (source === 'emp') return 0.55
  return 0.25
}

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
