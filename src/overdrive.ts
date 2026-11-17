/** Overdrive meter. Pure so tests can load it without Phaser. */

export const OVERDRIVE_NEED = 100
export const OVERDRIVE_SECONDS = 6

export function overdriveGain(kind: string): number {
  if (kind === 'carrier' || kind === 'armour') return 34
  if (kind === 'swarm' || kind === 'splitter' || kind === 'tank' || kind === 'plate') return 12
  if (kind === 'jammer' || kind === 'shield') return 8
  return 6
}

export function addCharge(charge: number, gain: number, active: boolean): number {
  if (active || gain <= 0) return charge
  const next = charge + gain
  return next > OVERDRIVE_NEED ? OVERDRIVE_NEED : next
}

export function overdriveReady(charge: number, active: boolean): boolean {
  return !active && charge >= OVERDRIVE_NEED
}

export function overdriveInterval(base: number, active: boolean): number {
  return active ? Math.max(0.03, base * 0.62) : base
}

export function overdrivePellets(count: number, active: boolean, letter: string): number {
  if (!active) return count
  if (letter === 'S') return Math.min(7, count + 2)
  if (letter === 'H') return count + 2
  if (letter === 'C') return count + 2
  return count
}
