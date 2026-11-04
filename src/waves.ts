import { clamp } from './math'

export type Side = 'top' | 'left' | 'right'

export type SpawnKind = 'drone' | 'missile' | 'swarm' | 'marker'

export interface SpawnEvent {
  at: number
  kind: SpawnKind
  lane: number
  arc: boolean
  side: Side
  /** Signed bend, -1..1, scaled by screen width at spawn. */
  arcAmp: number
}

export interface WaveSpec {
  wave: number
  speed: number
  events: SpawnEvent[]
}

export function buildWave(wave: number, rand: () => number = Math.random): WaveSpec {
  const drones = clamp(3 + wave, 4, 14)
  const missiles =
    wave < 2 ? 0 : wave === 2 ? 1 : clamp(1 + Math.floor((wave - 2) * 0.55), 1, 8)
  const swarms = wave < 3 ? 0 : clamp(Math.floor((wave - 1) / 2), 1, 3)
  const speed = 1 + (wave - 1) * 0.045
  const stagger = Math.max(0.34, 0.62 - (wave - 1) * 0.02)

  const events: SpawnEvent[] = []
  let t = 0.5
  for (let i = 0; i < drones; i++) {
    const edge = wave < 3 ? 0.18 : 0.08
    const lane = clamp(edge + ((i + 0.5) / drones) * (1 - edge * 2) + (rand() - 0.5) * 0.06, edge, 1 - edge)
    events.push({ at: t, kind: 'drone', lane, arc: false, side: 'top', arcAmp: 0 })
    t += stagger * (0.84 + rand() * 0.32)
  }

  const span = Math.max(t, 2.4)
  for (let i = 0; i < missiles; i++) {
    const lane = clamp(0.08 + rand() * 0.84, 0.07, 0.93)
    const at = span * (0.45 + (0.45 * (i + 0.5)) / missiles)
    const roll = rand()
    const side: Side = wave >= 4 && roll < 0.22 ? (roll < 0.11 ? 'left' : 'right') : 'top'
    const arc = rand() < 0.4
    const arcAmp = rand() * 2 - 1
    events.push({
      at: Math.max(0.35, at - 0.7),
      kind: 'marker',
      lane,
      arc,
      side,
      arcAmp,
    })
    events.push({ at, kind: 'missile', lane, arc, side, arcAmp })
  }

  for (let i = 0; i < swarms; i++) {
    const at = 1.25 + ((i + 1) / (swarms + 1)) * span * 0.8
    const lane = clamp(0.2 + rand() * 0.6, 0.12, 0.88)
    events.push({ at, kind: 'swarm', lane, arc: false, side: 'top', arcAmp: 0 })
  }

  events.sort((a, b) => a.at - b.at)
  return { wave, speed, events }
}
