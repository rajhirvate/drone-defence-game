export function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpAngle(current: number, target: number, t: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + diff * t
}

export function clampAim(angle: number, min: number, max: number): number {
  if (angle >= min && angle <= max) return angle
  const dMin = Math.atan2(Math.sin(angle - min), Math.cos(angle - min))
  const dMax = Math.atan2(Math.sin(angle - max), Math.cos(angle - max))
  return Math.abs(dMin) < Math.abs(dMax) ? min : max
}

export function mixHex(a: number, b: number, t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  const r = (ar + (br - ar) * u) | 0
  const g = (ag + (bg - ag) * u) | 0
  const bl = (ab + (bb - ab) * u) | 0
  return (r << 16) | (g << 8) | bl
}

/** Deterministic RNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function formatInt(n: number): string {
  return Math.floor(n).toLocaleString('en-US')
}
