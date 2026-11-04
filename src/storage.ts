const BEST = 'drone-defence.best'
const MUTE = 'drone-defence.muted'
const AUTO = 'drone-defence.autofire'

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
    /* private mode or blocked storage */
  }
}

export function loadBest(): number {
  const n = Number(read(BEST))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function saveBest(score: number): void {
  if (score > 0) write(BEST, String(Math.floor(score)))
}

export function loadMuted(): boolean {
  return read(MUTE) === '1'
}

export function saveMuted(muted: boolean): void {
  write(MUTE, muted ? '1' : '0')
}

export function defaultAutoFire(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}

export function loadAutoFire(): boolean | null {
  const raw = read(AUTO)
  if (raw === '1') return true
  if (raw === '0') return false
  return null
}

export function saveAutoFire(on: boolean): void {
  write(AUTO, on ? '1' : '0')
}
