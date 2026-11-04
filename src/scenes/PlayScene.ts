import Phaser from 'phaser'
import { audio } from '../audio'
import { emitView, onCommand } from '../bridge'
import { buildLevelWave, levelById } from '../campaign'
import {
  BALANCE,
  BOSSES,
  COINS,
  FEEL,
  SHOP,
  TUTORIAL,
  WEAPONS,
  fireInterval,
  pelletCount,
  rankCost,
  shellDamage,
  splashRadius,
  spreadStep,
  starsFor,
  type UpgradeId,
  type WeaponId,
} from '../config'
import { dailyRand, todayKey } from '../daily'
import { paintAction, paintBackdrop, type ActionFrame, type BackdropFrame, type Beam } from '../draw'
import { armArmour, armCarrier, armDrone, armFlyby, armMissile, armShard, armSwarm, makeEnemy, retune, stepEnemy } from '../entities/enemy'
import { clamp, clampAim, lerpAngle, mulberry32 } from '../math'
import { buildSkyline, roofAt, type Building, type Skyline } from '../skyline'
import { defaultAutoFire, loadSave, saveGame, type SaveData } from '../storage'
import { blankSnapshot, type Bullet, type Command, type Enemy, type Fire, type Marker, type Particle, type Snapshot, type Star } from '../types'
import { buildWave, type SpawnEvent } from '../waves'

const BOOM = [0xfff1d6, 0xffb15a, 0xff6a3d]
const SWARM_FX = [0xe4d8ff, 0xffb15a, 0xffffff]
const CITY_FX = [0xff5d73, 0xffb15a, 0xffe1a8]

interface Floater {
  text: Phaser.GameObjects.Text
  life: number
  vy: number
}

export class PlayScene extends Phaser.Scene {
  private cityGfx!: Phaser.GameObjects.Graphics
  private fx!: Phaser.GameObjects.Graphics
  private enemies: Enemy[] = []
  private bullets: Bullet[] = []
  private particles: Particle[] = []
  private markers: Marker[] = []
  private fires: Fire[] = []
  private stars: Star[] = []
  private floaters: Floater[] = []
  private splashBuf: Enemy[] = []
  private buildings: Building[] = []
  private spawns: SpawnEvent[] = []
  private queueIndex = 0
  private viewW = 0
  private viewH = 0
  private unit = 1
  private groundY = 0
  private tallest = 0
  private turretX = 0
  private turretY = 0
  private barrel = 40
  private aim = -Math.PI / 2
  private aimDisplay = -Math.PI / 2
  private spin = 0
  private spinSpeed = 0
  private muzzle = 0
  private fireCooldown = 0
  private pointerDown = false
  private spaceDown = false
  private showReticle = false
  private reticleX = 0
  private reticleY = 0
  private phase: Snapshot['phase'] = 'menu'
  private score = 0
  private best = 0
  private wave = 0
  private cityHp: number = BALANCE.cityMax
  private kills = 0
  private killsThisWave = 0
  private mult = 1
  private comboTime = 0
  private rateLevel = 0
  private spreadLevel = 0
  private damageLevel = 0
  private autoFire = false
  private muted = false
  private newBest = false
  private banner = ''
  private bannerT = 0
  private speedMul = 1
  private clearDelay = 0
  private awaitingClear = false
  private hurt = 0
  private clock = 0
  private bgTimer = 0
  private bgDirty = true
  private reduce = false
  private attractT = 0.4
  private shakeReady = 0
  private waveDamage = 0
  private repairShown = 0
  private cleanShown = 0
  private flybyCount = 0
  private waveClock = 0
  private haptics = true
  private mode: 'endless' | 'campaign' | 'daily' = 'endless'
  private levelId = 1
  private weapon: WeaponId = 'cannon'
  private save: SaveData = loadSave()
  private timeScale = 1
  private slowT = 0
  private hitStop = 0
  private flash = 0
  private empCd = 0
  private laserTick = 0
  private laserOn = false
  private laserX = 0
  private laserY = 0
  private muzzleX = 0
  private muzzleY = 0
  private carrierTimer = 0
  private tutorialStep = -1
  private tutorialT = 0
  private rng: () => number = Math.random
  private dailyDate = ''
  private runCoins = 0
  private clearStars = 0
  private clearCoins = 0
  private paused = false
  private beams: Beam[] = []
  private readonly view: Snapshot = blankSnapshot()
  private offCommand: (() => void) | null = null

  constructor() {
    super('play')
  }

  create(): void {
    this.cityGfx = this.add.graphics().setDepth(0)
    this.fx = this.add.graphics().setDepth(2)
    this.save = loadSave()
    this.best = this.save.bestEndless
    this.muted = this.save.muted
    this.autoFire = this.save.autoFire ?? defaultAutoFire()
    this.weapon = this.save.equipped
    this.haptics = this.save.haptics
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    audio.setMuted(this.muted)
    this.stars = makeStars(72)
    this.preallocate()
    this.cameras.main.setBackgroundColor('#070914')

    this.layout(this.scale.width, this.scale.height)
    this.scale.on(Phaser.Scale.Events.RESIZE, (size: Phaser.Structs.Size) => {
      this.layout(size.width, size.height)
    })

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.unlock()
      this.pointerDown = true
      if (this.phase === 'playing') this.aimAt(p.worldX, p.worldY)
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.phase !== 'playing') return
      if (p.wasTouch && !p.isDown) return
      this.aimAt(p.worldX, p.worldY)
    })
    this.input.on('pointerup', () => {
      this.pointerDown = false
    })
    this.input.on('pointerupoutside', () => {
      this.pointerDown = false
    })

    if (this.input.keyboard) {
      this.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE])
      this.input.keyboard.on('keydown-SPACE', (event: KeyboardEvent) => {
        if (event.repeat) return
        this.spaceDown = true
      })
      this.input.keyboard.on('keyup-SPACE', () => {
        this.spaceDown = false
      })
    }

    const onVis = (): void => {
      if (document.hidden) this.scene.pause()
      else this.scene.resume()
    }
    document.addEventListener('visibilitychange', onVis)
    this.offCommand = onCommand((command) => this.onCommand(command))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVis)
      this.offCommand?.()
      this.offCommand = null
    })

    this.pushView()
  }

  update(_time: number, delta: number): void {
    if (this.paused && this.phase === 'playing') return
    const dt = Math.min(0.033, delta / 1000)
    this.clock += dt
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dt)
    if (this.slowT > 0) {
      this.slowT -= dt
      if (this.slowT <= 0) this.timeScale = 1
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6)
    if (this.empCd > 0) this.empCd = Math.max(0, this.empCd - dt)
    const sim = this.hitStop > 0 ? 0 : dt * this.timeScale
    if (this.shakeReady > 0) this.shakeReady -= dt
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt * 2.4)
    if (this.muzzle > 0) this.muzzle = Math.max(0, this.muzzle - dt)
    this.tickTutorial(dt)
    if (this.bannerT > 0) {
      this.bannerT -= dt
      if (this.bannerT <= 0) this.banner = ''
    }
    if (this.comboTime > 0) {
      this.comboTime -= dt
      if (this.comboTime <= 0) this.mult = 1
    }

    this.bgTimer -= dt
    if (this.bgDirty || this.bgTimer <= 0) {
      this.paintCity()
      this.bgDirty = false
      this.bgTimer = 0.18
    }

    const firing = this.wantsFire()
    const targetSpin = firing ? 26 : 0.45
    this.spinSpeed += (targetSpin - this.spinSpeed) * Math.min(1, dt * 6)
    this.spin += this.spinSpeed * dt
    this.aimDisplay = lerpAngle(this.aimDisplay, this.aim, 1 - Math.exp(-16 * dt))

    const idle = this.phase === 'menu' || this.phase === 'map' || this.phase === 'armoury'
    if (idle) {
      this.aimAttract()
      this.updateAttract(dt)
    } else if (this.phase === 'playing') {
      this.updateCombat(sim, firing)
    } else {
      this.decayFx(dt)
    }

    this.updateFloaters(dt)
    this.drawAction(firing)
    this.pushView()
  }

  private onCommand(command: Command): void {
    switch (command.type) {
      case 'start':
      case 'start-endless':
        this.mode = 'endless'
        this.beginRun()
        break
      case 'start-daily':
        this.mode = 'daily'
        this.dailyDate = todayKey()
        this.rng = dailyRand(this.dailyDate)
        this.beginRun()
        break
      case 'start-level':
        this.mode = 'campaign'
        this.levelId = command.id
        this.rng = mulberry32(4000 + command.id)
        this.beginRun()
        break
      case 'restart':
        if (this.mode === 'daily') this.rng = dailyRand(this.dailyDate || todayKey())
        this.beginRun()
        break
      case 'upgrade':
        this.pickUpgrade(command.id)
        break
      case 'open-map':
      case 'to-map':
        this.paused = false
        this.phase = 'map'
        this.deactivateAll()
        break
      case 'open-armoury':
        this.paused = false
        this.phase = 'armoury'
        this.deactivateAll()
        break
      case 'back-menu':
        this.paused = false
        this.phase = 'menu'
        this.deactivateAll()
        break
      case 'pause':
        if (this.phase === 'playing') this.paused = true
        break
      case 'resume':
        this.paused = false
        break
      case 'equip':
        if (this.save.owned[command.id]) {
          this.save.equipped = command.id
          this.weapon = command.id
          saveGame(this.save)
          audio.play('ui')
        }
        break
      case 'buy-weapon':
        this.buyWeapon(command.id)
        break
      case 'buy-rank':
        this.buyRank(command.id)
        break
      case 'toggle-mute':
        this.muted = !this.muted
        this.save.muted = this.muted
        audio.setMuted(this.muted)
        saveGame(this.save)
        if (!this.muted) audio.unlock()
        audio.play('ui')
        break
      case 'toggle-autofire':
        this.autoFire = !this.autoFire
        this.save.autoFire = this.autoFire
        saveGame(this.save)
        audio.play('ui')
        break
      case 'toggle-haptics':
        this.haptics = !this.haptics
        this.save.haptics = this.haptics
        saveGame(this.save)
        audio.play('ui')
        break
      case 'skip-tutorial':
        this.tutorialStep = -1
        this.save.tutorialSeen = true
        saveGame(this.save)
        break
    }
    this.pushView()
  }

  private beginRun(): void {
    if (this.phase === 'playing') return
    this.paused = false
    audio.unlock()
    audio.play('ui')
    this.score = 0
    this.wave = 0
    this.cityHp = BALANCE.cityMax
    this.kills = 0
    this.mult = 1
    this.comboTime = 0
    this.rateLevel = this.save.ranks.rate
    this.spreadLevel = this.save.ranks.spread
    this.damageLevel = this.save.ranks.damage
    this.newBest = false
    this.repairShown = 0
    this.cleanShown = 0
    this.hurt = 0
    this.runCoins = 0
    this.empCd = 0
    this.timeScale = 1
    this.slowT = 0
    this.hitStop = 0
    this.weapon = this.save.equipped
    this.carrierTimer = 1.2
    if (this.mode === 'endless') this.rng = Math.random
    if (this.mode === 'daily') {
      this.dailyDate = this.dailyDate || todayKey()
      this.rng = dailyRand(this.dailyDate)
    }
    this.deactivateAll()
    this.phase = 'playing'
    this.aim = -Math.PI / 2
    this.aimDisplay = this.aim
    if (!this.save.tutorialSeen) {
      this.tutorialStep = 0
      this.tutorialT = 5
    } else {
      this.tutorialStep = -1
    }
    this.beginWave()
  }

  private beginWave(): void {
    this.wave += 1
    this.killsThisWave = 0
    this.waveDamage = 0
    this.awaitingClear = false
    this.clearDelay = 0
    const spec =
      this.mode === 'campaign' ? buildLevelWave(levelById(this.levelId)) : buildWave(this.wave, this.rng)
    this.speedMul = spec.speed
    this.spawns = spec.events
    this.queueIndex = 0
    const level = this.mode === 'campaign' ? levelById(this.levelId) : null
    this.banner = level ? level.name.toUpperCase() : `WAVE ${this.wave}`
    this.bannerT = BALANCE.bannerTime
    this.fireCooldown = 0
    this.waveClock = 0
    for (let i = 0; i < this.bullets.length; i++) this.bullets[i].active = false
    for (let i = 0; i < this.markers.length; i++) this.markers[i].active = false
    audio.play('wave')
  }

  private pickUpgrade(id: UpgradeId): void {
    if (this.phase !== 'upgrade') return
    if (id === 'rate') this.rateLevel += 1
    else if (id === 'spread') this.spreadLevel += 1
    else this.damageLevel += 1
    audio.play('upgrade')
    this.phase = 'playing'
    this.beginWave()
  }

  private wantsFire(): boolean {
    if (this.phase !== 'playing') return false
    if (this.autoFire) return true
    if (this.pointerDown) return true
    if (this.spaceDown && !buttonFocused()) return true
    return false
  }

  private updateCombat(dt: number, firing: boolean): void {
    const teaching = this.tutorialStep === 0 || this.tutorialStep === 1
    if (!teaching) {
      this.waveClock += dt
      this.spawnDue()
    }
    const world = {
      w: this.viewW,
      h: this.viewH,
      unit: this.unit,
      groundY: this.groundY,
      buildings: this.buildings,
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active || e.attract) continue
      stepEnemy(e, dt, world)
    }

    this.laserOn = false
    if (firing && this.weapon === 'laser') this.fireLaser(dt)
    else if (firing && this.weapon === 'emp') this.tryEmp()
    else if (firing && this.weapon !== 'emp') {
      this.fireCooldown -= dt
      let guard = 0
      const interval = this.weapon === 'missile' ? WEAPONS.missile.interval : fireInterval(this.rateLevel)
      while (this.fireCooldown <= 0 && guard < 3) {
        this.shoot()
        this.fireCooldown += interval
        guard++
      }
    } else if (this.fireCooldown < 0) {
      this.fireCooldown = 0
    }
    this.launchCarrierMinis(dt)

    this.updateBullets(dt)
    this.impacts()
    this.decayFx(dt)

    if (this.phase !== 'playing') return
    if (!this.awaitingClear && this.bannerT <= 0 && !this.hostilesRemain()) {
      this.awaitingClear = true
      this.clearDelay = BALANCE.clearDelay
    }
    if (this.awaitingClear) {
      this.clearDelay -= dt
      if (this.clearDelay <= 0) this.onWaveCleared()
    }
  }

  private updateAttract(dt: number): void {
    this.attractT -= dt
    this.flybyCount = 0
    const world = {
      w: this.viewW,
      h: this.viewH,
      unit: this.unit,
      groundY: this.groundY,
      buildings: this.buildings,
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active) continue
      this.flybyCount++
      const pop = stepEnemy(e, dt, world)
      if (pop) {
        this.fireAttractBeam(e.x, e.y)
        this.burst(e.x, e.y, 'drone', false)
        e.active = false
      }
    }
    if (this.attractT <= 0 && this.flybyCount < 3) {
      const e = this.takeEnemy()
      if (e) armFlyby(e, this.viewW, this.viewH, this.unit)
      this.attractT = this.reduce ? 2.6 : 1.35 + Math.random() * 1.2
    }
    this.tickBeams(dt)
    this.decayFx(dt)
  }

  private aimAttract(): void {
    let target: Enemy | null = null
    let best = Infinity
    const pivotX = this.turretX
    const pivotY = this.turretY - this.unit * 16
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active || !e.attract) continue
      const dx = e.x - pivotX
      const dy = e.y - pivotY
      const dist = dx * dx + dy * dy
      if (dist < best) {
        best = dist
        target = e
      }
    }
    if (target) {
      this.aim = clampAim(Math.atan2(target.y - pivotY, target.x - pivotX), BALANCE.aimMin, BALANCE.aimMax)
      return
    }
    if (this.reduce) {
      this.aim = -Math.PI / 2
      return
    }
    this.aim = -Math.PI / 2 + Math.sin(this.clock * 0.55) * 0.8
  }

  private fireAttractBeam(x: number, y: number): void {
    const pivotX = this.turretX
    const pivotY = this.turretY - this.unit * 16
    const angle = Math.atan2(y - pivotY, x - pivotX)
    const aim = clampAim(angle, BALANCE.aimMin, BALANCE.aimMax)
    this.aim = aim
    this.aimDisplay = aim
    const c = Math.cos(aim)
    const s = Math.sin(aim)
    const tipX = pivotX + c * this.barrel
    const tipY = pivotY + s * this.barrel
    this.muzzle = 0.07
    if (this.reduce) return
    this.beams.push({ x1: tipX, y1: tipY, x2: x, y2: y, life: 0.18, max: 0.18 })
    if (this.beams.length > 4) this.beams.shift()
  }

  private tickBeams(dt: number): void {
    let write = 0
    for (let i = 0; i < this.beams.length; i++) {
      const beam = this.beams[i]
      beam.life -= dt
      if (beam.life > 0) this.beams[write++] = beam
    }
    this.beams.length = write
  }

  private spawnDue(): void {
    let spawned = 0
    while (this.queueIndex < this.spawns.length && spawned < 2) {
      const ev = this.spawns[this.queueIndex]
      if (ev.at > this.waveClock) break
      if (ev.kind !== 'marker' && this.activeHostiles() >= BALANCE.maxActive) break
      this.queueIndex++
      if (ev.kind === 'marker') this.spawnMarker(ev)
      else this.spawnEnemy(ev)
      spawned++
    }
  }

  private hostilesRemain(): boolean {
    for (let i = this.queueIndex; i < this.spawns.length; i++) {
      if (this.spawns[i].kind !== 'marker') return true
    }
    return this.activeHostiles() > 0
  }

  private activeHostiles(): number {
    let n = 0
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (e.active && !e.attract) n++
    }
    return n
  }

  private spawnMarker(ev: SpawnEvent): void {
    const spot = this.entryPoint(ev)
    const m = this.takeMarker()
    if (!m) return
    m.active = true
    m.life = 0.42
    m.max = 0.42
    if (ev.side === 'left') {
      m.x = 18
      m.y = spot.y
      m.angle = 0
    } else if (ev.side === 'right') {
      m.x = this.viewW - 18
      m.y = spot.y
      m.angle = Math.PI
    } else {
      m.x = spot.targetX
      m.y = Math.max(64, this.viewH * 0.1)
      m.angle = Math.PI / 2
    }
    audio.play('warn')
  }

  private spawnEnemy(ev: SpawnEvent): void {
    const e = this.takeEnemy()
    if (!e) return
    const spot = this.entryPoint(ev)
    const common = {
      unit: this.unit,
      speedMul: this.speedMul,
      wave: this.wave,
      x: spot.x,
      y: spot.y,
      targetX: spot.targetX,
      targetY: spot.targetY,
    }
    if (ev.kind === 'drone') {
      const entryX = clamp(spot.targetX + (Math.random() - 0.5) * this.unit * 90, 16, this.viewW - 16)
      armDrone(e, { ...common, entryX, y: -24 })
    } else if (ev.kind === 'swarm') {
      const entryX = clamp(spot.targetX + (Math.random() - 0.5) * this.unit * 40, 20, this.viewW - 20)
      armSwarm(e, { ...common, entryX, y: -28 })
    } else if (ev.kind === 'missile' || ev.kind === 'armour') {
      const opts = { ...common, arc: ev.arc, arcAmp: ev.arcAmp * this.viewW * 0.16 }
      if (ev.kind === 'armour') armArmour(e, opts)
      else armMissile(e, opts)
    } else if (ev.kind === 'carrier') {
      armCarrier(e, { ...common, entryX: spot.targetX, y: -40 })
      this.carrierTimer = 1.4
    }
  }

  private entryPoint(ev: SpawnEvent): { x: number; y: number; targetX: number; targetY: number } {
    const targetX = clamp(ev.lane, 0.05, 0.95) * this.viewW
    const targetY = roofAt(this.buildings, targetX, this.groundY) + 2
    if (ev.side === 'left') {
      return { x: -28, y: this.viewH * 0.16, targetX, targetY }
    }
    if (ev.side === 'right') {
      return { x: this.viewW + 28, y: this.viewH * 0.16, targetX, targetY }
    }
    return { x: targetX, y: -30, targetX, targetY }
  }

  private shoot(): void {
    const pivotX = this.turretX
    const pivotY = this.turretY - this.unit * 16
    const angle = this.aimDisplay
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const tipX = pivotX + c * this.barrel
    const tipY = pivotY + s * this.barrel
    const homing = this.weapon === 'missile'
    const pellets = homing ? 1 : pelletCount(this.spreadLevel)
    const step = spreadStep(this.spreadLevel)
    const start = -step * (pellets - 1) * 0.5
    const damage = homing ? WEAPONS.missile.damage + this.damageLevel : shellDamage(this.damageLevel)
    const splash = homing ? 0 : splashRadius(this.spreadLevel, this.unit)
    const speed = (homing ? WEAPONS.missile.speed : BALANCE.bulletSpeed) * this.unit
    for (let i = 0; i < pellets; i++) {
      const b = this.takeBullet()
      if (!b) break
      const a = angle + start + step * i
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      b.active = true
      b.x = tipX + ca * 6
      b.y = tipY + sa * 6
      b.px = b.x
      b.py = b.y
      b.vx = ca * speed
      b.vy = sa * speed
      b.life = homing ? 2.4 : BALANCE.bulletLife
      b.damage = damage
      b.splash = splash
      b.r = (homing ? 6 : BALANCE.bulletRadius) * this.unit
      b.flak = !homing && this.spreadLevel > 0
      b.homing = homing
      b.turn = WEAPONS.missile.turn
    }
    this.muzzle = 0.045
    this.noteTutorial(1)
    audio.play(homing ? 'homing' : 'shot')
    this.buzz(8)
  }

  private updateBullets(dt: number): void {
    const w = this.viewW
    const h = this.viewH
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i]
      if (!b.active) continue
      b.px = b.x
      b.py = b.y
      if (b.homing) this.steerHoming(b, dt)
      const dist = Math.hypot(b.vx * dt, b.vy * dt)
      const steps = Math.max(1, Math.min(4, Math.ceil(dist / Math.max(8, this.unit * 10))))
      const sdt = dt / steps
      let hit: Enemy | null = null
      for (let s = 0; s < steps; s++) {
        b.x += b.vx * sdt
        b.y += b.vy * sdt
        hit = this.bulletHit(b)
        if (hit) break
      }
      b.life -= dt
      if (hit) {
        if (b.splash > 0) this.collectSplash(b, hit)
        this.damageEnemy(hit, b.damage)
        for (let s = 0; s < this.splashBuf.length; s++) this.damageEnemy(this.splashBuf[s], b.damage)
        this.spark(b.x, b.y, b.flak ? 0xffe1a3 : 0x9af6ff)
        b.active = false
        continue
      }
      if (b.life <= 0 || b.y < -40 || b.x < -40 || b.x > w + 40 || b.y > h + 40) b.active = false
    }
  }

  private bulletHit(b: Bullet): Enemy | null {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active || e.attract) continue
      const dx = e.x - b.x
      const dy = e.y - b.y
      const rr = e.r * 1.28 + b.r
      if (dx * dx + dy * dy <= rr * rr) return e
    }
    return null
  }

  private collectSplash(b: Bullet, primary: Enemy): void {
    this.splashBuf.length = 0
    const r = b.splash
    const r2 = r * r
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active || e.attract || e === primary) continue
      const dx = e.x - b.x
      const dy = e.y - b.y
      if (dx * dx + dy * dy <= r2) this.splashBuf.push(e)
    }
  }

  private damageEnemy(e: Enemy, amount: number): void {
    if (!e.active || e.attract) return
    e.hp -= amount
    e.flash = 0.07
    if (amount >= 1) this.popup(String(Math.ceil(amount)), e.x + e.r * 0.4, e.y - e.r, '#ffffff')
    if (e.hp <= 0) this.killEnemy(e)
  }

  private killEnemy(e: Enemy): void {
    const kind = e.kind
    const x = e.x
    const y = e.y
    e.active = false
    if (kind === 'swarm' || kind === 'carrier') this.spawnShards(e)
    const boss = kind === 'carrier' || kind === 'armour'
    this.registerKill(e, x, y)
    this.burst(x, y, kind === 'carrier' || kind === 'armour' ? 'swarm' : kind, true)
    if (boss) this.burst(x, y, 'city', true)
    if (boss || kind === 'swarm' || kind === 'missile') this.kick(boss ? 0.01 : 0.004, boss ? 180 : 90)
    if (boss || (this.mode === 'campaign' && !this.hostilesRemain())) this.celebrate(boss)
    this.noteTutorial(2)
    audio.play(boss ? 'bigboom' : 'boom')
  }

  private spawnShards(parent: Enemy): void {
    const angles = [Math.PI / 2 - 0.75, Math.PI / 2, Math.PI / 2 + 0.75]
    for (let i = 0; i < angles.length; i++) {
      const shard = this.takeEnemy()
      if (!shard) return
      armShard(shard, parent, angles[i], this.unit)
    }
  }

  private registerKill(e: Enemy, x: number, y: number): void {
    this.kills += 1
    this.killsThisWave += 1
    if (this.comboTime > 0) this.mult = Math.min(BALANCE.maxMult, this.mult + 1)
    else this.mult = 1
    this.comboTime = BALANCE.comboWindow
    const gained = e.score * this.mult
    this.score += gained
    const coins = COINS[e.kind]
    this.save.coins += coins
    this.runCoins += coins
    saveGame(this.save)
    this.noteBest()
    const color = this.mult >= 4 ? '#ffb15a' : this.mult >= 2 ? '#9af6ff' : '#f4f1ea'
    this.popup(`+${gained}`, x, y - e.r, color)
    audio.combo(this.mult)
  }

  private impacts(): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active || e.attract) continue
      const roof = roofAt(this.buildings, e.x, this.groundY)
      if (e.y + e.r * 0.35 >= roof) this.cityImpact(e)
    }
  }

  private cityImpact(e: Enemy): void {
    e.active = false
    this.cityHp = Math.max(0, this.cityHp - e.city)
    this.waveDamage += e.city
    this.hurt = 1
    this.bgDirty = true
    this.burst(e.x, roofAt(this.buildings, e.x, this.groundY), 'city', true)
    this.addFire(e.x / Math.max(1, this.viewW))
    this.kick(0.011, 160, true)
    audio.play('city')
    this.buzz(this.reduce ? 0 : 28)
    this.comboTime = 0
    this.mult = 1
    if (this.cityHp <= 0) this.gameOver()
  }

  private openUpgrade(): void {
    if (this.phase !== 'playing') return
    const repair = Math.min(BALANCE.repair, BALANCE.cityMax - this.cityHp)
    this.cityHp += repair
    this.repairShown = repair
    this.bgDirty = true
    if (this.waveDamage === 0 && this.killsThisWave > 0) {
      this.cleanShown = BALANCE.cleanBonusPerWave * this.wave
      this.score += this.cleanShown
      this.noteBest()
      this.popup(`CLEAN SKY +${this.cleanShown}`, this.viewW * 0.5, this.viewH * 0.28, '#ffb15a')
    } else {
      this.cleanShown = 0
    }
    this.phase = 'upgrade'
    audio.play('clear')
  }

  private onWaveCleared(): void {
    if (this.phase !== 'playing') return
    if (this.mode === 'campaign') this.finishLevel()
    else if (this.mode === 'daily') this.beginWave()
    else this.openUpgrade()
  }

  private finishLevel(): void {
    const level = levelById(this.levelId)
    const stars = starsFor(this.cityHp, BALANCE.cityMax)
    const bonus = level.coins + stars * 8
    this.save.coins += bonus
    this.save.stars[level.id] = Math.max(this.save.stars[level.id] ?? 0, stars)
    if (level.id >= this.save.unlocked && level.id < 12) this.save.unlocked = level.id + 1
    if (level.grant) this.save.owned[level.grant] = true
    this.save.tutorialSeen = true
    this.tutorialStep = -1
    saveGame(this.save)
    this.clearStars = stars
    this.clearCoins = bonus
    this.phase = 'clear'
    audio.play('clear')
  }

  private gameOver(): void {
    if (this.phase === 'gameover') return
    this.phase = 'gameover'
    this.banner = ''
    this.bannerT = 0
    this.awaitingClear = false
    this.noteBest()
    audio.play('over')
    this.buzz(this.reduce ? 0 : 70)
  }

  private noteBest(): void {
    if (this.mode === 'daily') {
      const date = this.dailyDate || todayKey()
      const prev = this.save.dailyBest[date] ?? 0
      if (this.score > prev) {
        this.save.dailyBest[date] = this.score
        this.newBest = true
        saveGame(this.save)
      }
      this.best = this.save.dailyBest[date] ?? this.score
      return
    }
    if (this.mode !== 'endless') return
    if (this.score > this.save.bestEndless) {
      this.save.bestEndless = this.score
      this.best = this.score
      this.newBest = true
      saveGame(this.save)
    }
  }

  private aimAt(x: number, y: number): void {
    const pivotX = this.turretX
    const pivotY = this.turretY - this.unit * 16
    const dx = x - pivotX
    const dy = y - pivotY
    if (dx * dx + dy * dy < 36) return
    const next = clampAim(Math.atan2(dy, dx), BALANCE.aimMin, BALANCE.aimMax)
    if (Math.abs(next - this.aim) > 0.08) this.noteTutorial(0)
    this.aim = next
    this.reticleX = x
    this.reticleY = y
    this.showReticle = true
  }

  private decayFx(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.active) continue
      if (p.ring) p.r += dt * 140 * this.unit
      else {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += p.grav * dt
      }
      p.life -= dt
      if (p.life <= 0) p.active = false
    }
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i]
      if (!m.active) continue
      m.life -= dt
      if (m.life <= 0) m.active = false
    }
    for (let i = 0; i < this.fires.length; i++) {
      const f = this.fires[i]
      if (!f.active) continue
      f.life -= dt
      if (f.life <= 0) f.active = false
    }
  }

  private burst(x: number, y: number, kind: Enemy['kind'] | 'city', big: boolean): void {
    const colors = kind === 'swarm' ? SWARM_FX : kind === 'city' ? CITY_FX : BOOM
    const count = this.reduce ? 6 : big ? 18 : 11
    for (let i = 0; i < count; i++) {
      const p = this.takeParticle()
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4
      const sp = (60 + Math.random() * 170) * this.unit
      p.active = true
      p.ring = false
      p.x = x
      p.y = y
      p.vx = Math.cos(a) * sp
      p.vy = Math.sin(a) * sp
      p.max = 0.25 + Math.random() * 0.28
      p.life = p.max
      p.r = (2.4 + Math.random() * 4.2) * this.unit
      p.color = colors[i % colors.length]
      p.grav = 30 * this.unit
    }
    if (big && !this.reduce) {
      const ring = this.takeParticle()
      ring.active = true
      ring.ring = true
      ring.x = x
      ring.y = y
      ring.vx = 0
      ring.vy = 0
      ring.max = 0.28
      ring.life = ring.max
      ring.r = 6 * this.unit
      ring.color = colors[0]
      ring.grav = 0
    }
  }

  private spark(x: number, y: number, color: number): void {
    const n = this.reduce ? 2 : 4
    for (let i = 0; i < n; i++) {
      const p = this.takeParticle()
      const a = Math.random() * Math.PI * 2
      const sp = (40 + Math.random() * 90) * this.unit
      p.active = true
      p.ring = false
      p.x = x
      p.y = y
      p.vx = Math.cos(a) * sp
      p.vy = Math.sin(a) * sp
      p.max = 0.12 + Math.random() * 0.1
      p.life = p.max
      p.r = (1.2 + Math.random() * 1.6) * this.unit
      p.color = color
      p.grav = 0
    }
  }

  private addFire(fx: number): void {
    let slot: Fire | null = null
    for (let i = 0; i < this.fires.length; i++) {
      if (!this.fires[i].active) {
        slot = this.fires[i]
        break
      }
    }
    if (!slot) {
      if (this.fires.length >= 8) slot = this.fires[0]
      else {
        slot = { active: false, fx: 0, life: 0, max: 0, seed: 0 }
        this.fires.push(slot)
      }
    }
    slot.active = true
    slot.fx = clamp(fx, 0.02, 0.98)
    slot.max = 7
    slot.life = 7
    slot.seed = Math.random() * 10
  }

  private popup(message: string, x: number, y: number, color: string): void {
    const floater = this.takeFloater()
    floater.text.setText(message)
    floater.text.setColor(color)
    floater.text.setPosition(x, y)
    floater.text.setAlpha(1)
    floater.text.setVisible(true)
    floater.text.setFontSize(Math.max(14, Math.round(12 + this.unit * 5)))
    floater.life = 0.7
    floater.vy = -36 * this.unit
  }

  private updateFloaters(dt: number): void {
    for (let i = 0; i < this.floaters.length; i++) {
      const f = this.floaters[i]
      if (!f.text.visible) continue
      f.life -= dt
      if (f.life <= 0) {
        f.text.setVisible(false)
        continue
      }
      f.text.y += f.vy * dt
      f.text.setAlpha(Math.min(1, f.life / 0.25))
    }
  }

  private kick(intensity: number, duration = 100, force = false): void {
    if (this.reduce) return
    if (!force && this.shakeReady > 0) return
    this.shakeReady = 0.09
    this.cameras.main.shake(duration, intensity)
  }

  private layout(width: number, height: number): void {
    const w = Math.floor(width)
    const h = Math.floor(height)
    if (w < 20 || h < 20) return
    if (w === this.viewW && h === this.viewH && this.buildings.length > 0) return
    const prevW = this.viewW
    const prevH = this.viewH
    const city: Skyline = buildSkyline(w, h, Math.min(w, h) / 480)
    this.viewW = w
    this.viewH = h
    this.unit = Math.min(w, h) / 480
    this.buildings = city.buildings
    this.groundY = city.groundY
    this.tallest = city.tallest
    this.turretX = city.turretX
    this.turretY = city.turretY
    this.barrel = city.barrel
    if (prevW > 0 && prevH > 0) this.scaleWorld(w / prevW, h / prevH)
    this.bgDirty = true
    this.paintCity()
  }

  private scaleWorld(sx: number, sy: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active) continue
      e.x *= sx
      e.y *= sy
      e.centerX *= sx
      e.targetX *= sx
      e.targetY *= sy
      e.x0 *= sx
      e.y0 *= sy
      e.cpx *= sx
      e.cpy *= sy
      e.vx *= sx
      e.vy *= sy
      e.killX *= sx
      retune(e, this.unit)
    }
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i]
      if (!b.active) continue
      b.x *= sx
      b.y *= sy
      b.px *= sx
      b.py *= sy
      b.vx *= sx
      b.vy *= sy
      b.r = BALANCE.bulletRadius * this.unit
      b.splash *= (sx + sy) * 0.5
    }
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.active) continue
      p.x *= sx
      p.y *= sy
      p.vx *= sx
      p.vy *= sy
    }
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i]
      if (!m.active) continue
      m.x *= sx
      m.y *= sy
    }
  }

  private paintCity(): void {
    if (this.viewW < 20) return
    const frame: BackdropFrame = {
      w: this.viewW,
      h: this.viewH,
      unit: this.unit,
      time: this.clock,
      groundY: this.groundY,
      tallest: this.tallest,
      buildings: this.buildings,
      hpRatio: this.cityHp / BALANCE.cityMax,
    }
    paintBackdrop(this.cityGfx, frame)
  }

  private drawAction(firing: boolean): void {
    const frame: ActionFrame = {
      w: this.viewW,
      h: this.viewH,
      unit: this.unit,
      time: this.clock,
      groundY: this.groundY,
      buildings: this.buildings,
      stars: this.stars,
      enemies: this.enemies,
      bullets: this.bullets,
      particles: this.particles,
      markers: this.markers,
      fires: this.fires,
      turretX: this.turretX,
      turretY: this.turretY,
      barrel: this.barrel,
      aim: this.aimDisplay,
      spin: this.spin,
      muzzle: this.muzzle,
      firing,
      reticleX: this.reticleX,
      reticleY: this.reticleY,
      showReticle: this.showReticle,
      phase: this.phase,
      laserOn: this.laserOn,
      laserX: this.laserX,
      laserY: this.laserY,
      muzzleX: this.muzzleX,
      muzzleY: this.muzzleY,
      reduceMotion: this.reduce,
      beams: this.beams,
    }
    paintAction(this.fx, frame)
  }

  private pushView(): void {
    const v = this.view
    v.phase = this.phase
    v.score = this.score
    v.best = this.best
    v.wave = this.wave
    v.cityHp = this.cityHp
    v.cityMax = BALANCE.cityMax
    v.mult = this.mult
    v.comboHot = this.comboTime > 0 && this.mult > 1
    v.kills = this.kills
    v.rateLevel = this.rateLevel
    v.spreadLevel = this.spreadLevel
    v.damageLevel = this.damageLevel
    v.autoFire = this.autoFire
    v.muted = this.muted
    v.newBest = this.newBest
    v.banner = this.banner
    v.hurt = this.hurt
    v.low = this.cityHp > 0 && this.cityHp / BALANCE.cityMax <= 0.35
    v.repair = this.repairShown
    v.cleanBonus = this.cleanShown
    v.intervalMs = Math.round(fireInterval(this.rateLevel) * 1000)
    v.nextIntervalMs = Math.round(fireInterval(this.rateLevel + 1) * 1000)
    v.pellets = pelletCount(this.spreadLevel)
    v.nextPellets = pelletCount(this.spreadLevel + 1)
    v.damage = shellDamage(this.damageLevel)
    v.nextDamage = shellDamage(this.damageLevel + 1)
    v.splash = Math.round(splashRadius(this.spreadLevel, 1))
    v.nextSplash = Math.round(splashRadius(this.spreadLevel + 1, 1))
    v.mode = this.mode
    v.coins = this.save.coins
    v.weapon = this.weapon
    v.ownedLaser = this.save.owned.laser
    v.ownedMissile = this.save.owned.missile
    v.ownedEmp = this.save.owned.emp
    v.empCd = this.empCd
    v.empMax = WEAPONS.emp.cooldown
    v.tutorial = this.tutorialStep >= 0 ? TUTORIAL[Math.min(3, this.tutorialStep)] : ''
    v.levelName = this.mode === 'campaign' ? levelById(this.levelId).name : ''
    v.clearStars = this.clearStars
    v.clearCoins = this.clearCoins
    v.flash = this.flash
    v.dailyDate = this.dailyDate
    v.dailyBest = this.save.dailyBest[this.dailyDate] ?? 0
    v.paused = this.paused
    if (this.mode === 'endless') v.best = this.save.bestEndless
    emitView(v)
  }

  private tickTutorial(dt: number): void {
    if (this.tutorialStep < 0 || this.phase !== 'playing') return
    this.tutorialT -= dt
    if (this.tutorialT <= 0) {
      this.tutorialStep += 1
      this.tutorialT = 5
      if (this.tutorialStep > 3) {
        this.tutorialStep = -1
        this.save.tutorialSeen = true
        saveGame(this.save)
      }
    }
  }

  private noteTutorial(step: number): void {
    if (this.tutorialStep !== step) return
    this.tutorialStep += 1
    this.tutorialT = 5
    if (this.tutorialStep > 3) {
      this.tutorialStep = -1
      this.save.tutorialSeen = true
      saveGame(this.save)
    }
  }

  private buyWeapon(id: 'laser' | 'missile' | 'emp'): void {
    if (this.save.owned[id]) {
      this.save.equipped = id
      this.weapon = id
      saveGame(this.save)
      return
    }
    const cost = SHOP.unlock[id]
    if (this.save.coins < cost) return
    this.save.coins -= cost
    this.save.owned[id] = true
    this.save.equipped = id
    this.weapon = id
    saveGame(this.save)
    audio.play('upgrade')
  }

  private buyRank(id: UpgradeId): void {
    const rank = this.save.ranks[id]
    if (rank >= SHOP.maxRank) return
    const cost = rankCost(rank)
    if (this.save.coins < cost) return
    this.save.coins -= cost
    this.save.ranks[id] = rank + 1
    saveGame(this.save)
    audio.play('upgrade')
  }

  private fireLaser(dt: number): void {
    const pivotX = this.turretX
    const pivotY = this.turretY - this.unit * 16
    const angle = this.aimDisplay
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    this.muzzleX = pivotX + c * this.barrel
    this.muzzleY = pivotY + s * this.barrel
    const range = WEAPONS.laser.range * this.unit
    let best: Enemy | null = null
    let bestT = range
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active || e.attract) continue
      const dx = e.x - this.muzzleX
      const dy = e.y - this.muzzleY
      const along = dx * c + dy * s
      if (along < 0 || along > range) continue
      const side = Math.abs(dx * -s + dy * c)
      if (side > e.r + this.unit * 6) continue
      if (along < bestT) {
        bestT = along
        best = e
      }
    }
    this.laserOn = true
    this.laserX = this.muzzleX + c * (best ? bestT : range)
    this.laserY = this.muzzleY + s * (best ? bestT : range)
    this.muzzle = 0.04
    audio.play('laser')
    this.noteTutorial(1)
    if (!best) return
    this.laserTick -= dt
    if (this.laserTick <= 0) {
      this.damageEnemy(best, WEAPONS.laser.damage + this.damageLevel * 0.4)
      this.laserTick = WEAPONS.laser.tick
      this.spark(best.x, best.y, 0xff8aa0)
    }
  }

  private tryEmp(): void {
    if (this.empCd > 0) return
    const radius = WEAPONS.emp.radius * this.unit
    const r2 = radius * radius
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active || e.attract) continue
      const dx = e.x - this.turretX
      const dy = e.y - (this.turretY - this.barrel)
      if (dx * dx + dy * dy <= r2) e.stun = WEAPONS.emp.stun
    }
    this.empCd = WEAPONS.emp.cooldown
    this.burst(this.turretX, this.turretY - this.barrel * 0.5, 'swarm', true)
    this.flash = 0.65
    this.kick(0.006, 120, true)
    audio.play('emp')
    this.buzz(18)
    this.noteTutorial(1)
  }

  private steerHoming(b: Bullet, dt: number): void {
    let target: Enemy | null = null
    let best = Infinity
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]
      if (!e.active || e.attract) continue
      const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2
      if (d < best) {
        best = d
        target = e
      }
    }
    if (!target) return
    const speed = Math.hypot(b.vx, b.vy) || 1
    const desired = Math.atan2(target.y - b.y, target.x - b.x)
    const current = Math.atan2(b.vy, b.vx)
    const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current))
    const next = current + clamp(diff, -b.turn * dt, b.turn * dt)
    b.vx = Math.cos(next) * speed
    b.vy = Math.sin(next) * speed
  }

  private launchCarrierMinis(dt: number): void {
    this.carrierTimer -= dt
    if (this.carrierTimer > 0) return
    let carrier: Enemy | null = null
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].active && this.enemies[i].kind === 'carrier') carrier = this.enemies[i]
    }
    if (!carrier) return
    this.carrierTimer = BOSSES.carrier.launchEvery
    for (let n = 0; n < 2; n++) {
      const mini = this.takeEnemy()
      if (!mini) return
      armDrone(mini, {
        unit: this.unit,
        speedMul: this.speedMul,
        wave: Math.max(1, this.wave),
        x: carrier.x,
        y: carrier.y,
        targetX: clamp(carrier.x + (n === 0 ? -40 : 40), 20, this.viewW - 20),
        targetY: this.groundY,
        entryX: carrier.x + (n === 0 ? -18 : 18),
      })
      mini.y = carrier.y + 10
      mini.hp = 1
      mini.maxHp = 1
    }
  }

  private celebrate(boss: boolean): void {
    this.hitStop = FEEL.hitStop
    this.timeScale = FEEL.slowScale
    this.slowT = boss ? FEEL.bossSlow : FEEL.slowTime
    this.flash = 1
    this.buzz(boss ? 40 : 16)
  }

  private buzz(ms: number): void {
    if (!this.haptics || this.reduce || ms <= 0) return
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(ms)
    } catch {
      /* ignore */
    }
  }

  private deactivateAll(): void {
    this.beams.length = 0
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].active = false
    for (let i = 0; i < this.bullets.length; i++) this.bullets[i].active = false
    for (let i = 0; i < this.particles.length; i++) this.particles[i].active = false
    for (let i = 0; i < this.markers.length; i++) this.markers[i].active = false
    for (let i = 0; i < this.fires.length; i++) this.fires[i].active = false
    for (let i = 0; i < this.floaters.length; i++) this.floaters[i].text.setVisible(false)
  }

  private preallocate(): void {
    for (let i = 0; i < BALANCE.maxEnemies; i++) this.enemies.push(makeEnemy())
    for (let i = 0; i < 24; i++) this.bullets.push(makeBullet())
    for (let i = 0; i < 40; i++) this.particles.push(makeParticle())
    for (let i = 0; i < 8; i++) this.markers.push(makeMarker())
  }

  private takeEnemy(): Enemy | null {
    for (let i = 0; i < this.enemies.length; i++) {
      if (!this.enemies[i].active) return this.enemies[i]
    }
    if (this.enemies.length >= BALANCE.maxEnemies + 8) return null
    const e = makeEnemy()
    this.enemies.push(e)
    return e
  }

  private takeBullet(): Bullet | null {
    for (let i = 0; i < this.bullets.length; i++) {
      if (!this.bullets[i].active) return this.bullets[i]
    }
    if (this.bullets.length >= BALANCE.maxBullets) return null
    const b = makeBullet()
    this.bullets.push(b)
    return b
  }

  private takeParticle(): Particle {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) return this.particles[i]
    }
    if (this.particles.length < BALANCE.maxParticles) {
      const p = makeParticle()
      this.particles.push(p)
      return p
    }
    let best = this.particles[0]
    for (let i = 1; i < this.particles.length; i++) {
      if (this.particles[i].life < best.life) best = this.particles[i]
    }
    return best
  }

  private takeMarker(): Marker | null {
    for (let i = 0; i < this.markers.length; i++) {
      if (!this.markers[i].active) return this.markers[i]
    }
    if (this.markers.length >= 12) return null
    const m = makeMarker()
    this.markers.push(m)
    return m
  }

  private takeFloater(): Floater {
    for (let i = 0; i < this.floaters.length; i++) {
      if (!this.floaters[i].text.visible) return this.floaters[i]
    }
    if (this.floaters.length < 12) {
      const text = this.add
        .text(0, 0, '', {
          fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#f4f1ea',
        })
        .setOrigin(0.5, 1)
        .setDepth(6)
      text.setResolution(Math.min(2, window.devicePixelRatio || 1))
      const floater = { text, life: 0, vy: 0 }
      this.floaters.push(floater)
      return floater
    }
    return this.floaters[0]
  }
}

function buttonFocused(): boolean {
  const el = document.activeElement
  return el instanceof HTMLButtonElement
}

function makeBullet(): Bullet {
  return {
    active: false,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    life: 0,
    damage: 1,
    splash: 0,
    r: 3,
    flak: false,
    homing: false,
    turn: 2,
  }
}

function makeParticle(): Particle {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    r: 2,
    color: 0xffffff,
    grav: 0,
    ring: false,
  }
}

function makeMarker(): Marker {
  return { active: false, x: 0, y: 0, life: 0, max: 1, angle: Math.PI / 2 }
}

function makeStars(count: number): Star[] {
  const rand = mulberry32(99)
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      fx: rand(),
      fy: rand() * 0.85,
      z: 0.25 + rand() * 0.75,
      size: 1 + rand() * 1.8,
      phase: rand() * Math.PI * 2,
      tw: 0.4 + rand() * 2.4,
    })
  }
  return stars
}
