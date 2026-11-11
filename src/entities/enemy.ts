import { BALANCE, BOSSES, hpFor } from '../config'
import { clamp } from '../math'
import { roofAt, type Building } from '../skyline'
import type { Enemy } from '../types'

export interface StepWorld {
  w: number
  h: number
  unit: number
  groundY: number
  buildings: readonly Building[]
}

export function makeEnemy(): Enemy {
  return {
    active: false,
    kind: 'drone',
    mode: 'weave',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: Math.PI / 2,
    hp: 1,
    maxHp: 1,
    r: 10,
    baseR: 10,
    score: 0,
    city: 0,
    phase: 0,
    freq: 2,
    amp: 20,
    baseAmp: 20,
    speed: 80,
    baseSpeed: 80,
    speedMul: 1,
    centerX: 0,
    targetX: 0,
    targetY: 0,
    x0: 0,
    y0: 0,
    cpx: 0,
    cpy: 0,
    age: 0,
    duration: 1,
    flash: 0,
    attract: false,
    scriptKill: false,
    killX: 0,
    seed: 0,
    stun: 0,
    empMark: 0,
    shield: 0,
    maxShield: 0,
  }
}

export function retune(e: Enemy, unit: number): void {
  e.r = e.baseR * unit
  e.amp = e.baseAmp * unit
  e.speed = e.baseSpeed * unit * e.speedMul
  if (e.mode === 'line' || e.mode === 'shard') {
    const dx = e.targetX - e.x
    const dy = e.targetY - e.y
    const len = Math.hypot(dx, dy) || 1
    e.vx = (dx / len) * e.speed
    e.vy = (dy / len) * e.speed
  } else if (e.mode === 'flyby') {
    e.vx = e.speed
    e.vy = 0
  }
}

interface ArmBase {
  unit: number
  speedMul: number
  wave: number
  x: number
  y: number
  targetX: number
  targetY: number
}

export function armDrone(e: Enemy, o: ArmBase & { entryX: number }): void {
  const spec = BALANCE.drone
  const hp = hpFor('drone', o.wave)
  e.active = true
  e.kind = 'drone'
  e.mode = 'weave'
  e.attract = false
  e.baseR = spec.radius
  e.baseSpeed = spec.speed
  e.baseAmp = spec.amp * (0.75 + Math.random() * 0.5)
  e.speedMul = o.speedMul
  e.hp = hp
  e.maxHp = hp
  e.shield = 0
  e.maxShield = 0
  e.score = spec.score
  e.city = spec.city
  e.x = o.entryX
  e.y = o.y
  e.centerX = o.entryX
  e.targetX = o.targetX
  e.targetY = o.targetY
  e.phase = Math.random() * Math.PI * 2
  e.freq = 1.5 + Math.random() * 1.1
  e.flash = 0
  e.angle = Math.PI / 2
  e.vx = 0
  e.vy = 0
  e.seed = Math.random()
  retune(e, o.unit)
}

export function armMissile(
  e: Enemy,
  o: ArmBase & { arc: boolean; arcAmp: number },
): void {
  const spec = BALANCE.missile
  const hp = hpFor('missile', o.wave)
  e.active = true
  e.kind = 'missile'
  e.attract = false
  e.baseR = spec.radius
  e.baseSpeed = spec.speed
  e.baseAmp = 0
  e.speedMul = o.speedMul
  e.hp = hp
  e.maxHp = hp
  e.shield = 0
  e.maxShield = 0
  e.score = spec.score
  e.city = spec.city
  e.mode = o.arc ? 'arc' : 'line'
  e.x = o.x
  e.y = o.y
  e.x0 = o.x
  e.y0 = o.y
  e.targetX = o.targetX
  e.targetY = o.targetY
  e.flash = 0
  e.age = 0
  e.phase = 0
  e.seed = Math.random()
  retune(e, o.unit)
  const dist = Math.hypot(o.targetX - o.x, o.targetY - o.y) || 1
  const capped = Math.min(e.speed, dist / 2.45)
  if (capped < e.speed && e.mode === 'line') {
    e.speed = capped
    e.vx = ((o.targetX - o.x) / dist) * capped
    e.vy = ((o.targetY - o.y) / dist) * capped
  } else {
    e.speed = capped
  }
  if (o.arc) {
    e.duration = Math.max(2.45, dist / Math.max(1, e.speed))
    e.cpx = (o.x + o.targetX) / 2 + o.arcAmp
    e.cpy = Math.min(o.y, o.targetY) - Math.abs(o.arcAmp) * 0.15
  }
  e.angle = Math.atan2(e.vy || o.targetY - o.y, e.vx || o.targetX - o.x)
}

export function armSwarm(e: Enemy, o: ArmBase & { entryX: number }): void {
  armDrone(e, o)
  const spec = BALANCE.swarm
  const hp = hpFor('swarm', o.wave)
  e.kind = 'swarm'
  e.baseR = spec.radius
  e.baseSpeed = spec.speed
  e.baseAmp = 18
  e.freq = 1.1 + Math.random() * 0.4
  e.hp = hp
  e.maxHp = hp
  e.score = spec.score
  e.city = spec.city
  retune(e, o.unit)
}

export function armShard(e: Enemy, parent: Enemy, angle: number, unit: number): void {
  const spec = BALANCE.shard
  e.active = true
  e.kind = 'shard'
  e.mode = 'shard'
  e.attract = false
  e.baseR = spec.radius
  e.baseSpeed = spec.speed * (0.85 + Math.random() * 0.3)
  e.baseAmp = 0
  e.speedMul = parent.speedMul
  e.hp = spec.hp
  e.maxHp = spec.hp
  e.score = spec.score
  e.city = spec.city
  e.x = parent.x
  e.y = parent.y
  e.targetX = parent.x + Math.cos(angle) * 400
  e.targetY = parent.y + 800
  e.flash = 0
  e.phase = angle
  e.seed = Math.random()
  retune(e, unit)
  e.angle = angle
}

export function armFlyby(e: Enemy, w: number, h: number, unit: number): void {
  e.active = true
  e.kind = 'drone'
  e.mode = 'flyby'
  e.attract = true
  e.baseR = BALANCE.drone.radius * 0.9
  e.baseSpeed = 90 + Math.random() * 40
  e.baseAmp = 0
  e.speedMul = 1
  e.hp = 1
  e.maxHp = 1
  e.score = 0
  e.city = 0
  e.x = -40
  e.y = h * (0.14 + Math.random() * 0.22)
  e.phase = Math.random() * Math.PI * 2
  e.freq = 1.4
  e.scriptKill = true
  e.killX = w * (0.35 + Math.random() * 0.35)
  e.flash = 0
  e.seed = Math.random()
  retune(e, unit)
  e.vx = e.speed
  e.vy = 0
  e.angle = 0
}

/** Returns true when a flyby should burst apart. */
export function armCarrier(e: Enemy, o: ArmBase & { entryX: number }): void {
  armDrone(e, o)
  const spec = BOSSES.carrier
  e.kind = 'carrier'
  e.baseR = spec.radius
  e.baseSpeed = spec.speed
  e.baseAmp = 18
  e.freq = 0.7
  e.hp = spec.hp
  e.maxHp = spec.hp
  e.score = spec.score
  e.city = spec.city
  retune(e, o.unit)
}

export function armArmour(e: Enemy, o: ArmBase & { arc: boolean; arcAmp: number }): void {
  armMissile(e, o)
  const spec = BOSSES.armour
  e.kind = 'armour'
  e.baseR = spec.radius
  e.baseSpeed = spec.speed
  e.hp = spec.hp
  e.maxHp = spec.hp
  e.score = spec.score
  e.city = spec.city
  retune(e, o.unit)
  if (o.arc) {
    const dist = Math.hypot(o.targetX - o.x, o.targetY - o.y) || 1
    e.duration = Math.max(3.2, dist / Math.max(1, e.speed))
  }
}

export function armScout(e: Enemy, o: ArmBase & { entryX: number }): void {
  armDrone(e, o)
  e.kind = 'scout'
  e.baseR = 12
  e.baseSpeed = 118
  e.baseAmp = 14
  e.hp = 1
  e.maxHp = 1
  e.score = 80
  e.city = 4
  retune(e, o.unit)
}

export function armTank(e: Enemy, o: ArmBase & { entryX: number }): void {
  armDrone(e, o)
  e.kind = 'tank'
  e.baseR = 20
  e.baseSpeed = 40
  e.baseAmp = 10
  e.hp = 3
  e.maxHp = 3
  e.score = 180
  e.city = 10
  retune(e, o.unit)
}

export function armSplitter(e: Enemy, o: ArmBase & { entryX: number }): void {
  armDrone(e, o)
  e.kind = 'splitter'
  e.baseR = 22
  e.baseSpeed = 48
  e.hp = 4
  e.maxHp = 4
  e.score = 200
  e.city = 12
  retune(e, o.unit)
}

export function armKamikaze(e: Enemy, o: ArmBase & { arc: boolean; arcAmp: number }): void {
  armMissile(e, o)
  e.kind = 'kamikaze'
  e.baseR = 11
  e.baseSpeed = 168
  e.hp = 1
  e.maxHp = 1
  e.score = 140
  e.city = 14
  retune(e, o.unit)
}

export function armShield(e: Enemy, o: ArmBase & { entryX: number }, shield: number): void {
  armDrone(e, o)
  e.kind = 'shield'
  e.baseR = 18
  e.baseSpeed = 52
  e.hp = 2
  e.maxHp = 2
  e.shield = shield
  e.maxShield = shield
  e.score = 160
  e.city = 8
  retune(e, o.unit)
}

export function stepEnemy(e: Enemy, dt: number, world: StepWorld): boolean {
  if (e.flash > 0) e.flash -= dt
  if (e.stun > 0) {
    e.stun -= dt
    return false
  }
  if (e.mode === 'flyby') {
    e.x += e.vx * dt
    e.phase += dt * e.freq
    e.y += Math.sin(e.phase) * 18 * world.unit * dt
    e.angle = Math.sin(e.phase) * 0.3
    if (e.scriptKill && e.x > e.killX) return true
    if (e.x > world.w + 50) e.active = false
    return false
  }

  if (e.mode === 'weave') {
    e.phase += e.freq * dt
    const roof = roofAt(world.buildings, e.targetX, world.groundY)
    const progress = clamp(e.y / Math.max(80, roof), 0, 1)
    e.centerX += (e.targetX - e.centerX) * Math.min(1, dt * 0.55)
    e.x = e.centerX + Math.sin(e.phase) * e.amp * (1 - progress * 0.28)
    e.y += e.speed * dt
    e.angle = Math.cos(e.phase) * 0.55
    e.x = clamp(e.x, e.r, world.w - e.r)
    return false
  }

  if (e.mode === 'arc') {
    e.age += dt
    const p = clamp(e.age / e.duration, 0, 1)
    const omt = 1 - p
    const x = omt * omt * e.x0 + 2 * omt * p * e.cpx + p * p * e.targetX
    const y = omt * omt * e.y0 + 2 * omt * p * e.cpy + p * p * e.targetY
    const tx = 2 * omt * (e.cpx - e.x0) + 2 * p * (e.targetX - e.cpx)
    const ty = 2 * omt * (e.cpy - e.y0) + 2 * p * (e.targetY - e.cpy)
    e.x = x
    e.y = y
    e.angle = Math.atan2(ty, tx)
    return false
  }

  e.x += e.vx * dt
  e.y += e.vy * dt
  if (e.mode === 'shard') {
    e.vy += world.unit * 70 * dt
    e.angle = Math.atan2(e.vy, e.vx)
    if (e.x < e.r) {
      e.x = e.r
      e.vx = Math.abs(e.vx)
    } else if (e.x > world.w - e.r) {
      e.x = world.w - e.r
      e.vx = -Math.abs(e.vx)
    }
  } else {
    e.angle = Math.atan2(e.vy, e.vx)
  }
  return false
}
