import Phaser from 'phaser'
import { mixHex } from './math'
import { type Building, type LitWindow } from './skyline'
import type { Bullet, Enemy, Fire, Marker, Particle, Star } from './types'
import type { MissileSkinId, TurretSkinId } from './config'

const hexPts: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
]

export interface BackdropFrame {
  w: number
  h: number
  unit: number
  time: number
  groundY: number
  tallest: number
  buildings: readonly Building[]
  hpRatio: number
}

export interface ActionFrame {
  w: number
  h: number
  unit: number
  time: number
  groundY: number
  buildings: readonly Building[]
  stars: readonly Star[]
  enemies: readonly Enemy[]
  bullets: readonly Bullet[]
  particles: readonly Particle[]
  markers: readonly Marker[]
  fires: readonly Fire[]
  turretX: number
  turretY: number
  barrel: number
  aim: number
  spin: number
  muzzle: number
  firing: boolean
  reticleX: number
  reticleY: number
  showReticle: boolean
  phase: string
  laserOn: boolean
  laserX: number
  laserY: number
  muzzleX: number
  muzzleY: number
  reduceMotion: boolean
  beams: readonly Beam[]
  empPulses: readonly EmpPulseDraw[]
  turretSkin: TurretSkinId
  drops: readonly { x: number; y: number; kind: string }[]
}

export interface Beam {
  x1: number
  y1: number
  x2: number
  y2: number
  life: number
  max: number
}

export interface EmpPulseDraw {
  x: number
  y: number
  r: number
  max: number
  life: number
  maxLife: number
}

export function paintBackdrop(g: Phaser.GameObjects.Graphics, f: BackdropFrame): void {
  g.clear()
  const bands = 48
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1)
    const sky = mixHex(0x070914, 0x1a335c, Math.pow(t, 0.85))
    const warm = mixHex(sky, 0x3a261c, Math.max(0, (t - 0.62) / 0.38))
    g.fillStyle(warm, 1)
    const y = (f.h * i) / bands
    g.fillRect(0, y, f.w + 2, f.h / bands + 1)
  }

  g.fillStyle(0xf3ecdc, 0.1)
  g.fillCircle(f.w * 0.8, f.h * 0.13, f.unit * 34)
  g.fillStyle(0xf7f1e4, 0.2)
  g.fillCircle(f.w * 0.8, f.h * 0.13, f.unit * 16)

  g.fillStyle(0xffb15a, 0.05)
  g.fillEllipse(f.w * 0.5, f.groundY, f.w * 0.95, f.h * 0.1)

  for (let i = 0; i < f.buildings.length; i++) {
    drawBuilding(g, f.buildings[i], f.unit, f.time, f.hpRatio)
  }

  g.fillStyle(0x080b12, 1)
  g.fillRect(0, f.groundY, f.w + 2, f.h - f.groundY + 4)
  g.fillStyle(0xffb15a, 0.35)
  g.fillRect(0, f.groundY, f.w + 2, Math.max(1, f.unit))
}

function drawBuilding(
  g: Phaser.GameObjects.Graphics,
  b: Building,
  unit: number,
  time: number,
  hpRatio: number,
): void {
  g.fillStyle(b.color, 1)
  g.fillRect(b.x, b.y, b.w, b.h)
  g.fillStyle(0x7f97b8, 0.95)
  g.fillRect(b.x, b.y, b.w, Math.max(2, unit * 2))
  g.fillStyle(0x8ea4c4, 0.35)
  g.fillRect(b.x, b.y, Math.max(2, unit), b.h)

  const damaged = 1 - hpRatio
  const windows = b.windows
  for (let i = 0; i < windows.length; i++) {
    drawWindow(g, windows[i], time, damaged)
  }

  if (b.mast > 0) {
    const mx = b.x + b.w * 0.5
    g.fillStyle(0x0c111c, 1)
    g.fillRect(mx - Math.max(1, unit * 0.6), b.y - b.mast, Math.max(2, unit * 1.2), b.mast)
    const blink = Math.sin(time * 3.2 + b.beacon) > 0.15
    g.fillStyle(blink ? 0xff445f : 0x5a2030, 1)
    g.fillRect(mx - unit * 1.3, b.y - b.mast - unit * 1.4, unit * 2.6, unit * 2.6)
  }
}

function drawWindow(g: Phaser.GameObjects.Graphics, w: LitWindow, time: number, damaged: number): void {
  const flicker = 0.55 + 0.45 * Math.sin(time * w.phase + w.alt * 12)
  const forcedOff = w.alt < damaged * 0.92
  if (forcedOff || flicker < 0.22) {
    g.fillStyle(0x0b1018, 0.85)
  } else {
    g.fillStyle(w.cool ? 0x8fd4ff : 0xffb15a, 0.45 + flicker * 0.5)
  }
  g.fillRect(w.x, w.y, w.w, w.h)
}

export function paintAction(g: Phaser.GameObjects.Graphics, f: ActionFrame): void {
  g.clear()

  for (let i = 0; i < f.stars.length; i++) {
    const s = f.stars[i]
    const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(f.time * s.tw + s.phase))
    g.fillStyle(0xf4f7ff, a * (0.35 + s.z * 0.65))
    const size = s.size * (0.7 + s.z)
    g.fillRect(s.fx * f.w, s.fy * f.h * 0.78, size, size)
  }

  drawSkyBeams(g, f)

  for (let i = 0; i < f.markers.length; i++) {
    const m = f.markers[i]
    if (!m.active) continue
    const alpha = Math.max(0, m.life / m.max) * (0.45 + 0.55 * Math.abs(Math.sin(f.time * 14)))
    strokeChevron(g, m.x, m.y, m.angle, 8 + f.unit * 6, alpha)
  }

  for (let i = 0; i < f.enemies.length; i++) {
    const e = f.enemies[i]
    if (!e.active) continue
    drawEnemy(g, e, f.time, f.unit)
  }

  for (let i = 0; i < f.bullets.length; i++) {
    const b = f.bullets[i]
    if (!b.active) continue
    if (b.homing) drawPlayerMissile(g, b, f.unit)
    else drawShell(g, b, f.unit)
  }

  drawEmpPulses(g, f)

  for (let i = 0; i < f.particles.length; i++) {
    const p = f.particles[i]
    if (!p.active) continue
    const alpha = Math.max(0, p.life / p.max)
    if (p.ring) {
      g.lineStyle(Math.max(1, f.unit * 1.4), p.color, alpha * 0.8)
      g.strokeCircle(p.x, p.y, p.r)
    } else {
      g.fillStyle(p.color, alpha)
      const s = p.r * (0.45 + 0.55 * alpha)
      g.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s)
    }
  }

  for (let i = 0; i < f.fires.length; i++) {
    const fire = f.fires[i]
    if (!fire.active) continue
    drawFire(g, fire, f)
  }

  drawTurret(g, f)
  for (let i = 0; i < f.drops.length; i++) {
    const drop = f.drops[i]
    const color = drop.kind === 'rapid' ? 0xffb15a : drop.kind === 'spread' ? 0x9af6ff : drop.kind === 'shield' ? 0xb6f27a : 0xc9a6ff
    g.fillStyle(color, 0.9)
    g.fillCircle(drop.x, drop.y, Math.max(5, f.unit * 6))
    g.lineStyle(Math.max(1, f.unit), 0xf7fbff, 0.8)
    g.strokeCircle(drop.x, drop.y, Math.max(7, f.unit * 8))
  }
  if (f.laserOn) {
    g.lineStyle(Math.max(3, f.unit * 4), 0xff4d6a, 0.35)
    g.beginPath()
    g.moveTo(f.muzzleX, f.muzzleY)
    g.lineTo(f.laserX, f.laserY)
    g.strokePath()
    g.lineStyle(Math.max(1.5, f.unit * 1.6), 0xffd0d8, 0.95)
    g.beginPath()
    g.moveTo(f.muzzleX, f.muzzleY)
    g.lineTo(f.laserX, f.laserY)
    g.strokePath()
  }

  if (f.showReticle && f.phase === 'playing') {
    const x = f.reticleX
    const y = f.reticleY
    const s = Math.max(7, f.unit * 8)
    g.lineStyle(Math.max(1, f.unit), 0xf4efe4, 0.8)
    g.beginPath()
    g.moveTo(x - s, y)
    g.lineTo(x - s * 0.35, y)
    g.moveTo(x + s * 0.35, y)
    g.lineTo(x + s, y)
    g.moveTo(x, y - s)
    g.lineTo(x, y - s * 0.35)
    g.moveTo(x, y + s * 0.35)
    g.lineTo(x, y + s)
    g.strokePath()
    g.strokeCircle(x, y, s * 0.55)
  }
}

function drawSkyBeams(g: Phaser.GameObjects.Graphics, f: ActionFrame): void {
  const idle = f.phase === 'menu' || f.phase === 'map' || f.phase === 'armoury'
  if (idle) {
    const spots = [0.2, 0.56, 0.8]
    const colors = [0xfff3c4, 0xfff3c4, 0x9af6ff]
    for (let i = 0; i < spots.length; i++) {
      const ox = f.w * spots[i]
      let oy = f.groundY
      const buildings = f.buildings
      for (let b = 0; b < buildings.length; b++) {
        const building = buildings[b]
        if (ox >= building.x && ox <= building.x + building.w) oy = Math.min(oy, building.y)
      }
      const sweep = f.reduceMotion ? -0.18 + i * 0.16 : Math.sin(f.time * (0.42 + i * 0.07) + i * 1.8) * 0.66
      const dir = -Math.PI / 2 + sweep
      const len = f.h * 0.95
      const spread = 0.1
      const x1 = ox + Math.cos(dir - spread) * len
      const y1 = oy + Math.sin(dir - spread) * len
      const x2 = ox + Math.cos(dir + spread) * len
      const y2 = oy + Math.sin(dir + spread) * len
      g.fillStyle(colors[i], i === 2 ? 0.04 : 0.055)
      g.fillTriangle(ox, oy, x1, y1, x2, y2)
      g.lineStyle(Math.max(1, f.unit * 0.8), colors[i], 0.18)
      g.beginPath()
      g.moveTo(ox, oy)
      g.lineTo(ox + Math.cos(dir) * len, oy + Math.sin(dir) * len)
      g.strokePath()
    }
  }

  const beams = f.beams
  for (let i = 0; i < beams.length; i++) {
    const beam = beams[i]
    if (beam.life <= 0) continue
    const alpha = Math.max(0, beam.life / beam.max)
    g.lineStyle(Math.max(2, f.unit * 2.4), 0xd8fbff, 0.9 * alpha)
    g.beginPath()
    g.moveTo(beam.x1, beam.y1)
    g.lineTo(beam.x2, beam.y2)
    g.strokePath()
    g.fillStyle(0xffffff, alpha)
    const head = Math.max(2, f.unit * 2.6)
    g.fillRect(beam.x2 - head, beam.y2 - head, head * 2, head * 2)
  }
}

function drawShell(g: Phaser.GameObjects.Graphics, b: Bullet, unit: number): void {
  const speed = Math.hypot(b.vx, b.vy) || 1
  const trail = Math.max(18, unit * 48)
  g.lineStyle(Math.max(2.5, unit * 3.2), b.flak ? 0xffe1a3 : 0xb8fbff, 0.95)
  g.beginPath()
  g.moveTo(b.x - (b.vx / speed) * trail, b.y - (b.vy / speed) * trail)
  g.lineTo(b.x, b.y)
  g.strokePath()
  g.fillStyle(0xffffff, 1)
  const head = Math.max(2, b.r)
  g.fillRect(b.x - head, b.y - head, head * 2, head * 2)
}

function drawPlayerMissile(g: Phaser.GameObjects.Graphics, b: Bullet, unit: number): void {
  const speed = Math.hypot(b.vx, b.vy) || 1
  const ux = b.vx / speed
  const uy = b.vy / speed
  const ang = Math.atan2(uy, ux)
  const skin: MissileSkinId = b.skin
  if (skin === 'flare') {
    g.lineStyle(Math.max(5, unit * 7), 0xff6a2a, 0.45)
    g.beginPath()
    g.moveTo(b.x - ux * unit * 78, b.y - uy * unit * 78)
    g.lineTo(b.x, b.y)
    g.strokePath()
    g.lineStyle(Math.max(2.5, unit * 3), 0xffe1a3, 0.95)
    g.beginPath()
    g.moveTo(b.x - ux * unit * 48, b.y - uy * unit * 48)
    g.lineTo(b.x, b.y)
    g.strokePath()
    g.fillStyle(0xffb15a, 1)
    diamond(g, b.x, b.y, Math.max(6, unit * 8), ang)
    g.fillStyle(0xfff6d2, 1)
    diamond(g, b.x - ux * unit * 4, b.y - uy * unit * 4, Math.max(3, unit * 3.5), ang)
    return
  }
  if (skin === 'needle') {
    g.lineStyle(Math.max(1.4, unit * 1.5), 0xf7fbff, 0.95)
    g.beginPath()
    g.moveTo(b.x - ux * unit * 110, b.y - uy * unit * 110)
    g.lineTo(b.x, b.y)
    g.strokePath()
    g.fillStyle(0xffffff, 1)
    quad(g, b.x - ux * unit * 8, b.y - uy * unit * 8, unit * 28, Math.max(2, unit * 2.2), ang)
    g.fillStyle(0x9af6ff, 1)
    diamond(g, b.x + ux * unit * 6, b.y + uy * unit * 6, Math.max(3, unit * 3), ang)
    return
  }
  if (skin === 'halo') {
    g.lineStyle(Math.max(2, unit * 2.2), 0xffb15a, 0.7)
    g.strokeCircle(b.x - ux * unit * 16, b.y - uy * unit * 16, Math.max(5, unit * 7))
    g.lineStyle(Math.max(2, unit * 2.4), 0x9af6ff, 0.9)
    g.beginPath()
    g.moveTo(b.x - ux * unit * 42, b.y - uy * unit * 42)
    g.lineTo(b.x, b.y)
    g.strokePath()
    g.fillStyle(0x9af6ff, 1)
    g.fillCircle(b.x, b.y, Math.max(3.5, unit * 4))
    g.fillStyle(0xfff6d2, 1)
    g.fillCircle(b.x, b.y, Math.max(1.6, unit * 1.8))
    return
  }
  if (skin === 'viper') {
    const px = -uy
    const py = ux
    g.lineStyle(Math.max(1.6, unit * 1.8), 0xb6f27a, 0.9)
    g.beginPath()
    g.moveTo(b.x - ux * unit * 70 + px * unit * 3, b.y - uy * unit * 70 + py * unit * 3)
    g.lineTo(b.x, b.y)
    g.moveTo(b.x - ux * unit * 70 - px * unit * 3, b.y - uy * unit * 70 - py * unit * 3)
    g.lineTo(b.x, b.y)
    g.strokePath()
    g.fillStyle(0xd6ff9a, 1)
    diamond(g, b.x, b.y, Math.max(5, unit * 6), ang)
    g.fillStyle(0xffb15a, 1)
    diamond(g, b.x - ux * unit * 6, b.y - uy * unit * 6, Math.max(2, unit * 2.4), ang)
    return
  }
  if (skin === 'lantern') {
    g.lineStyle(Math.max(4, unit * 5), 0xff8a3d, 0.35)
    g.beginPath()
    g.moveTo(b.x - ux * unit * 36, b.y - uy * unit * 36)
    g.lineTo(b.x, b.y)
    g.strokePath()
    g.fillStyle(0xffb15a, 0.35)
    g.fillCircle(b.x, b.y, Math.max(8, unit * 10))
    g.fillStyle(0xffe1a8, 1)
    g.fillCircle(b.x, b.y, Math.max(4, unit * 5))
    g.fillStyle(0xfff6d2, 1)
    g.fillCircle(b.x, b.y, Math.max(2, unit * 2.2))
    return
  }
  if (skin === 'prism') {
    g.lineStyle(Math.max(1.5, unit * 1.6), 0x9af6ff, 0.8)
    g.beginPath()
    g.moveTo(b.x - ux * unit * 28, b.y - uy * unit * 28)
    g.lineTo(b.x, b.y)
    g.strokePath()
    g.fillStyle(0xf7fbff, 1)
    diamond(g, b.x, b.y, Math.max(5, unit * 6), ang)
    g.fillStyle(0x9af6ff, 1)
    diamond(g, b.x - ux * unit * 8 + uy * unit * 4, b.y - uy * unit * 8 - ux * unit * 4, Math.max(2.4, unit * 2.6), ang)
    g.fillStyle(0xffb15a, 1)
    diamond(g, b.x - ux * unit * 8 - uy * unit * 4, b.y - uy * unit * 8 + ux * unit * 4, Math.max(2.4, unit * 2.6), ang)
    return
  }
  if (skin === 'comet') {
    g.lineStyle(Math.max(3, unit * 3.4), 0xc9a6ff, 0.55)
    g.beginPath()
    g.moveTo(b.x - ux * unit * 64, b.y - uy * unit * 64)
    g.lineTo(b.x, b.y)
    g.strokePath()
    for (let i = 1; i <= 4; i++) {
      g.fillStyle(i % 2 === 0 ? 0xffb15a : 0xe4d8ff, 0.9 - i * 0.15)
      const d = i * unit * 10
      const s = Math.max(1.6, unit * (3.4 - i * 0.45))
      g.fillCircle(b.x - ux * d, b.y - uy * d, s)
    }
    g.fillStyle(0x6a4cff, 1)
    g.fillCircle(b.x, b.y, Math.max(4, unit * 5))
    g.fillStyle(0xf4f1ea, 1)
    g.fillCircle(b.x + ux * unit * 1.5, b.y + uy * unit * 1.5, Math.max(2, unit * 2.2))
    return
  }
  g.lineStyle(Math.max(2.5, unit * 3.2), 0xb8fbff, 0.95)
  g.beginPath()
  g.moveTo(b.x - ux * unit * 48, b.y - uy * unit * 48)
  g.lineTo(b.x, b.y)
  g.strokePath()
  g.fillStyle(0xffffff, 1)
  diamond(g, b.x, b.y, Math.max(4, unit * 5), ang)
  g.fillStyle(0x9af6ff, 1)
  diamond(g, b.x - ux * unit * 3, b.y - uy * unit * 3, Math.max(2, unit * 2.4), ang)
}

function drawEmpPulses(g: Phaser.GameObjects.Graphics, f: ActionFrame): void {
  const pulses = f.empPulses
  for (let i = 0; i < pulses.length; i++) {
    const pulse = pulses[i]
    const alpha = Math.max(0.15, pulse.life / pulse.maxLife)
    g.lineStyle(Math.max(3, f.unit * 4), 0x9af6ff, 0.9 * alpha)
    g.strokeCircle(pulse.x, pulse.y, Math.max(4, pulse.r))
    g.lineStyle(Math.max(1.5, f.unit * 2), 0xffb15a, 0.75 * alpha)
    g.strokeCircle(pulse.x, pulse.y, Math.max(2, pulse.r * 0.86))
    g.fillStyle(0x9af6ff, 0.08 * alpha)
    g.fillCircle(pulse.x, pulse.y, Math.max(4, pulse.r))
  }
}

function drawFire(g: Phaser.GameObjects.Graphics, fire: Fire, f: ActionFrame): void {
  const x = fire.fx * f.w
  let y = f.groundY
  const buildings = f.buildings
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]
    if (x >= b.x && x <= b.x + b.w) y = Math.min(y, b.y)
  }
  const flick = 0.65 + 0.35 * Math.sin(f.time * 22 + fire.seed)
  const fade = Math.min(1, fire.life / 0.4)
  g.fillStyle(0xff5a2a, 0.75 * fade)
  g.fillRect(x - f.unit * 3 * flick, y - f.unit * 8 * flick, f.unit * 6 * flick, f.unit * 8 * flick)
  g.fillStyle(0xffd27a, 0.9 * fade)
  g.fillRect(x - f.unit * 1.4, y - f.unit * 11 * flick, f.unit * 2.8, f.unit * 5)
}

function drawEnemy(g: Phaser.GameObjects.Graphics, e: Enemy, time: number, unit: number): void {
  const flash = e.flash > 0
  if (e.kind === 'carrier') drawCarrier(g, e, time, flash, unit)
  else if (e.kind === 'armour') drawArmour(g, e, time, flash)
  else if (e.kind === 'missile' || e.kind === 'kamikaze') drawMissile(g, e, time, flash)
  else if (e.kind === 'swarm' || e.kind === 'splitter') drawSwarm(g, e, time, flash, unit)
  else if (e.kind === 'shard') drawShard(g, e, flash)
  else if (e.kind === 'tank') {
    g.fillStyle(flash ? 0xffffff : 0x8a97a8, 1)
    g.fillCircle(e.x, e.y, e.r)
    g.fillStyle(flash ? 0xfff6d2 : 0xffb15a, 1)
    g.fillCircle(e.x, e.y, e.r * 0.35)
  } else drawDrone(g, e, flash, unit)
  if (e.kind === 'scout') {
    g.lineStyle(Math.max(1, unit), 0x9af6ff, 0.9)
    g.strokeCircle(e.x, e.y, e.r * 1.15)
  }
  if (e.kind === 'kamikaze') {
    g.fillStyle(0xff4d63, 1)
    g.fillCircle(e.x, e.y, Math.max(2, e.r * 0.35))
  }
  if (e.shield > 0) {
    g.lineStyle(Math.max(1.5, unit * 1.6), 0x9af6ff, 0.85)
    g.strokeCircle(e.x, e.y, e.r + unit * 4)
  }
  if (e.stun > 0) {
    g.lineStyle(Math.max(2, unit * 1.7), 0x9af6ff, 0.95)
    g.strokeCircle(e.x, e.y, e.r + unit * 4)
    g.lineStyle(Math.max(1, unit), 0xffb15a, 0.75)
    g.strokeCircle(e.x, e.y, e.r + unit * 8)
  }

  const boss = e.kind === 'carrier' || e.kind === 'armour'
  if (!e.attract && e.kind !== 'shard' && (boss || e.hp < e.maxHp)) {
    const w = e.r * 1.7
    const h = Math.max(2, unit * 2)
    const y = e.y - e.r - h - 3
    g.fillStyle(0x000000, 0.45)
    g.fillRect(e.x - w / 2, y, w, h)
    g.fillStyle(0xffb15a, 1)
    g.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), h)
  }
}

function drawDrone(g: Phaser.GameObjects.Graphics, e: Enemy, flash: boolean, unit: number): void {
  const arm = e.r * 1.15
  g.fillStyle(flash ? 0xffffff : 0x8ea0b4, 1)
  quad(g, e.x, e.y, arm * 2, Math.max(2, unit * 1.5), Math.PI / 4 + e.angle * 0.2)
  quad(g, e.x, e.y, arm * 2, Math.max(2, unit * 1.5), -Math.PI / 4 + e.angle * 0.2)
  g.fillStyle(flash ? 0xffffff : 0xd5deea, 1)
  const rotor = Math.max(2.5, e.r * 0.28)
  const spots = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]
  for (let i = 0; i < spots.length; i++) {
    const a = spots[i] + e.angle * 0.2
    g.fillRect(
      e.x + Math.cos(a) * arm - rotor / 2,
      e.y + Math.sin(a) * arm * 0.72 - rotor / 2,
      rotor,
      rotor,
    )
  }
  g.fillStyle(flash ? 0xffffff : 0xb7c3d2, 1)
  diamond(g, e.x, e.y, e.r * 0.55, e.angle * 0.15)
  g.fillStyle(0xff3558, 1)
  const eye = Math.max(2, e.r * 0.16)
  g.fillRect(e.x - eye / 2, e.y - eye / 2, eye, eye)
}

function drawMissile(g: Phaser.GameObjects.Graphics, e: Enemy, time: number, flash: boolean): void {
  const len = e.r * 2.4
  const wid = e.r * 0.7
  g.fillStyle(flash ? 0xffffff : 0xe6e0d4, 1)
  nose(g, e.x, e.y, e.angle, len, wid)
  const c = Math.cos(e.angle)
  const s = Math.sin(e.angle)
  const tailX = e.x - c * len * 0.45
  const tailY = e.y - s * len * 0.45
  const flick = 0.7 + 0.3 * Math.sin(time * 40 + e.seed * 20)
  g.fillStyle(0xff8a3d, 0.95)
  nose(g, tailX, tailY, e.angle + Math.PI, len * 0.45 * flick, wid * 0.55)
  g.fillStyle(0xffe1a3, 0.9)
  nose(g, tailX, tailY, e.angle + Math.PI, len * 0.22 * flick, wid * 0.28)
}

function drawSwarm(
  g: Phaser.GameObjects.Graphics,
  e: Enemy,
  time: number,
  flash: boolean,
  unit: number,
): void {
  g.fillStyle(flash ? 0xffffff : 0xd8c8ff, 1)
  hex(g, e.x, e.y, e.r)
  g.fillStyle(flash ? 0xfff4ea : 0x5b46a8, 1)
  hex(g, e.x, e.y, e.r * 0.55)
  g.lineStyle(Math.max(2, unit * 1.6), 0xffb15a, 0.9)
  g.strokeCircle(e.x, e.y, e.r * 1.05)
  const lights = 3
  for (let i = 0; i < lights; i++) {
    const a = time * 1.4 + e.phase + (i * Math.PI * 2) / lights
    const on = Math.sin(time * 6 + i) > -0.2
    g.fillStyle(on ? 0xffb15a : 0x5a4630, 1)
    const s = Math.max(2, unit * 2)
    g.fillRect(e.x + Math.cos(a) * e.r * 0.62 - s / 2, e.y + Math.sin(a) * e.r * 0.62 - s / 2, s, s)
  }
}

function drawCarrier(
  g: Phaser.GameObjects.Graphics,
  e: Enemy,
  time: number,
  flash: boolean,
  unit: number,
): void {
  g.fillStyle(flash ? 0xffffff : 0x8ea4ff, 1)
  hex(g, e.x, e.y, e.r)
  g.fillStyle(flash ? 0xfff4ea : 0x24345c, 1)
  hex(g, e.x, e.y, e.r * 0.55)
  g.fillStyle(0xffb15a, 1)
  const pod = Math.max(4, unit * 4)
  g.fillRect(e.x - e.r - pod * 0.2, e.y - pod / 2, pod, pod)
  g.fillRect(e.x + e.r - pod * 0.8, e.y - pod / 2, pod, pod)
  const blink = Math.sin(time * 8) > 0
  g.fillStyle(blink ? 0xff445f : 0x9af6ff, 1)
  g.fillRect(e.x - 2, e.y - 2, 4, 4)
}

function drawArmour(g: Phaser.GameObjects.Graphics, e: Enemy, time: number, flash: boolean): void {
  drawMissile(g, e, time, flash)
  g.fillStyle(flash ? 0xffffff : 0x6a7384, 0.95)
  nose(g, e.x, e.y, e.angle, e.r * 1.3, e.r * 1.15)
}

function drawShard(g: Phaser.GameObjects.Graphics, e: Enemy, flash: boolean): void {
  g.fillStyle(flash ? 0xffffff : 0xd2c4ff, 1)
  diamond(g, e.x, e.y, e.r, e.angle)
}

const TURRET_PAINT = {
  navy: { base: 0x1a2233, mid: 0x31425c, top: 0x5c6e88, barrel: 0x9aa6b8, trim: 0x6a7c94 },
  amber: { base: 0x2a1c10, mid: 0x6a4220, top: 0xffb15a, barrel: 0xffd7a1, trim: 0xc47a32 },
  cyan: { base: 0x102028, mid: 0x1c4a56, top: 0x9af6ff, barrel: 0xd8fbff, trim: 0x3a8a96 },
  violet: { base: 0x1a1428, mid: 0x3a2a58, top: 0xc9a6ff, barrel: 0xe4d8ff, trim: 0x6a4cff },
} as const

function drawTurret(g: Phaser.GameObjects.Graphics, f: ActionFrame): void {
  const x = f.turretX
  const y = f.turretY
  const u = f.unit
  const paint = TURRET_PAINT[f.turretSkin] ?? TURRET_PAINT.navy
  g.fillStyle(paint.base, 1)
  g.fillRect(x - u * 36, y - u * 2, u * 72, u * 16)
  g.fillStyle(paint.mid, 1)
  g.fillRect(x - u * 22, y - u * 14, u * 44, u * 16)
  g.fillStyle(paint.top, 1)
  g.fillRect(x - u * 10, y - u * 20, u * 20, u * 10)

  const pivotX = x
  const pivotY = y - u * 16
  const c = Math.cos(f.aim)
  const s = Math.sin(f.aim)
  const len = f.barrel
  g.fillStyle(paint.barrel, 1)
  quad(g, pivotX + c * len * 0.48, pivotY + s * len * 0.48, len, Math.max(5, u * 7), f.aim)
  g.fillStyle(paint.trim, 1)
  quad(g, pivotX + c * len * 0.48, pivotY + s * len * 0.48, len * 0.92, Math.max(2, u * 2.4), f.aim)

  const tipX = pivotX + c * len
  const tipY = pivotY + s * len
  const px = -s
  const py = c
  for (let i = 0; i < 6; i++) {
    const a = f.spin + (i / 6) * Math.PI * 2
    const ox = Math.cos(a) * u * 4.2
    const oy = Math.sin(a) * u * 1.6
    g.fillStyle(i % 2 === 0 ? 0xd5ddea : 0x667488, 1)
    const s2 = Math.max(2, u * 2.1)
    g.fillRect(tipX + px * ox + c * oy - s2 / 2, tipY + py * ox + s * oy - s2 / 2, s2, s2)
  }

  if (f.phase === 'playing') {
    const reach = Math.min(f.barrel * 1.35, u * 90)
    g.lineStyle(Math.max(1, u * 1.4), 0xffb15a, 0.28)
    g.beginPath()
    g.moveTo(tipX, tipY)
    g.lineTo(tipX + c * reach, tipY + s * reach)
    g.strokePath()
  }

  if (f.muzzle > 0) {
    const m = f.muzzle
    g.fillStyle(0xfff6d2, 0.95)
    const flash = u * (6 + m * 18)
    g.fillRect(tipX + c * u * 4 - flash / 2, tipY + s * u * 4 - flash / 2, flash, flash)
    g.fillStyle(0xffb15a, 0.7)
    const flash2 = flash * 0.45
    g.fillRect(tipX + c * u * 12 - flash2 / 2, tipY + s * u * 12 - flash2 / 2, flash2, flash2)
  }

  const sweep = f.time * 1.4
  g.lineStyle(Math.max(1, u), 0x9af6ff, 0.4)
  g.beginPath()
  g.moveTo(x - u * 16, y - u * 2)
  g.lineTo(x - u * 16 + Math.cos(sweep) * u * 12, y - u * 2 + Math.sin(sweep) * u * 5)
  g.strokePath()

  g.fillStyle(f.firing ? 0xff4d63 : 0xffb15a, 1)
  const lamp = Math.max(2, u * 2.2)
  g.fillRect(x + u * 12, y - u * 8, lamp, lamp)
}

function strokeChevron(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  size: number,
  alpha: number,
): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const px = -s
  const py = c
  g.lineStyle(2, 0xff5d73, alpha)
  g.beginPath()
  g.moveTo(x + px * size, y + py * size)
  g.lineTo(x + c * size, y + s * size)
  g.lineTo(x - px * size, y - py * size)
  g.strokePath()
}

function quad(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  len: number,
  wid: number,
  angle: number,
): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const px = -s
  const py = c
  const hl = len * 0.5
  const hw = wid * 0.5
  const x1 = cx + c * hl + px * hw
  const y1 = cy + s * hl + py * hw
  const x2 = cx + c * hl - px * hw
  const y2 = cy + s * hl - py * hw
  const x3 = cx - c * hl - px * hw
  const y3 = cy - s * hl - py * hw
  const x4 = cx - c * hl + px * hw
  const y4 = cy - s * hl + py * hw
  g.fillTriangle(x1, y1, x2, y2, x3, y3)
  g.fillTriangle(x1, y1, x3, y3, x4, y4)
}

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, angle: number): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  g.fillTriangle(
    x + c * r,
    y + s * r,
    x - s * r * 0.62,
    y + c * r * 0.62,
    x - c * r * 0.7,
    y - s * r * 0.7,
  )
  g.fillTriangle(
    x + c * r,
    y + s * r,
    x - c * r * 0.7,
    y - s * r * 0.7,
    x + s * r * 0.62,
    y - c * r * 0.62,
  )
}

function nose(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  len: number,
  wid: number,
): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const px = -s
  const py = c
  g.fillTriangle(
    x + c * len * 0.55,
    y + s * len * 0.55,
    x - c * len * 0.45 + px * wid,
    y - s * len * 0.45 + py * wid,
    x - c * len * 0.45 - px * wid,
    y - s * len * 0.45 - py * wid,
  )
}

function hex(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    hexPts[i].x = x + Math.cos(a) * r
    hexPts[i].y = y + Math.sin(a) * r
  }
  g.fillPoints(hexPts, true)
}
