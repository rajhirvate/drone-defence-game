/** Pure EMP ring tests so a tap's effect can be checked without Phaser. */

export interface RingTarget {
  active: boolean
  attract: boolean
  x: number
  y: number
  r: number
  empMark: number
}

/** True when the expanding ring crosses this target and has not already tagged it. */
export function ringReaches(
  prev: number,
  next: number,
  originX: number,
  originY: number,
  target: RingTarget,
  pulseId: number,
): boolean {
  if (!target.active || target.attract || target.empMark === pulseId) return false
  const distance = Math.hypot(target.x - originX, target.y - originY)
  return distance <= next + target.r && distance + target.r >= prev
}

/**
 * Pulse reach in pixels. Config radius is scaled by the playfield unit, but portrait
 * phones are much taller than they are wide, so the ring also grows with screen height.
 */
export function empReach(viewH: number, unit: number, configRadius: number): number {
  return Math.max(viewH * 0.82, configRadius * unit)
}
