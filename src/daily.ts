import { mulberry32 } from './math'

/** Local calendar day, YYYY-MM-DD. Same day, same daily seed. */
export function todayKey(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function hashDate(iso: string): number {
  let hash = 2166136261
  for (let i = 0; i < iso.length; i++) {
    hash ^= iso.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function dailyRand(iso: string): () => number {
  return mulberry32(hashDate(iso) || 1)
}
