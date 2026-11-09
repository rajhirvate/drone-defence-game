/** Pure EMP ring tests so a tap's effect can be checked without Phaser. */

export interface RingTarget {
  active: boolean
  attract: boolean
  x: number
  y: number
  r: number
  empMark: number
}

/** True when the target sits inside the pulse's final radius and has not been tagged. */
export function inEmpRadius(
  originX: number,
  originY: number,
  radius: number,
  target: RingTarget,
  pulseId: number,
): boolean {
  if (!target.active || target.attract || target.empMark === pulseId) return false
  const distance = Math.hypot(target.x - originX, target.y - originY)
  return distance <= radius + target.r
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
 * Pulse reach in pixels. The old radius was `configRadius * unit`, and `unit` follows
 * the short side, so on a tall phone the ring died around the turret. The pulse now
 * covers the whole screen from the muzzle, including the far corners.
 */
export function empReach(
  originX: number,
  originY: number,
  viewW: number,
  viewH: number,
  unit: number,
  configRadius: number,
): number {
  const margin = Math.max(96, unit * 90)
  const span = Math.hypot(Math.max(originX, viewW - originX), Math.max(originY, viewH - originY))
  return Math.max(span + margin, originY + margin, configRadius * unit)
}
