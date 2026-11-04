import { mulberry32 } from './math'

export interface LitWindow {
  x: number
  y: number
  w: number
  h: number
  cool: boolean
  phase: number
  alt: number
}

export interface Building {
  x: number
  y: number
  w: number
  h: number
  color: number
  windows: LitWindow[]
  mast: number
  beacon: number
}

export interface Skyline {
  buildings: Building[]
  groundY: number
  turretX: number
  turretY: number
  barrel: number
  tallest: number
  plaza: number
}

const TONES = [0x2a3854, 0x334564, 0x243044, 0x3c5174, 0x2c3d5c, 0x465c80]

export function roofAt(buildings: readonly Building[], x: number, groundY: number): number {
  let y = groundY
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]
    if (x >= b.x && x <= b.x + b.w) y = Math.min(y, b.y)
  }
  return y
}

export function buildSkyline(w: number, h: number, unit: number): Skyline {
  const rand = mulberry32(2026)
  const groundY = Math.round(h - Math.max(4, h * 0.012))
  const portrait = h >= w
  const tallest = h * (portrait ? 0.16 : 0.24)
  const turretX = w * 0.5
  const plaza = Math.max(72, Math.min(w * 0.2, unit * 130))
  const turretY = groundY - Math.max(8, unit * 4)
  const barrel = Math.max(unit * 42, Math.min(tallest * 0.62, unit * 86))

  const buildings: Building[] = []
  const plazaL = turretX - plaza * 0.5
  const plazaR = turretX + plaza * 0.5
  let x = Math.round(w * 0.02)
  const right = w * 0.98
  let guard = 0

  while (x < right - unit * 14 && guard < 48) {
    guard++
    const bw = Math.min(right - x, unit * (20 + rand() * 28))
    if (bw < unit * 14) break

    if (x < plazaR && x + bw > plazaL) {
      if (x < plazaL - unit * 18) {
        const fit = plazaL - unit * 5 - x
        if (fit >= unit * 14) {
          buildings.push(makeBuilding(x, groundY, fit, tallest, buildings.length, unit, rand))
        }
      }
      x = plazaR + unit * 5
      continue
    }

    buildings.push(makeBuilding(x, groundY, bw, tallest, buildings.length, unit, rand))
    x += bw + unit * (4 + rand() * 8)
  }

  return { buildings, groundY, turretX, turretY, barrel, tallest, plaza }
}

function makeBuilding(
  x: number,
  groundY: number,
  bw: number,
  tallest: number,
  index: number,
  unit: number,
  rand: () => number,
): Building {
  const bh = tallest * (0.42 + rand() * 0.58)
  const building: Building = {
    x,
    y: groundY - bh,
    w: bw,
    h: bh,
    color: TONES[index % TONES.length],
    windows: [],
    mast: 0,
    beacon: rand() * Math.PI * 2,
  }
  if (rand() < 0.34 && bh > tallest * 0.62) {
    building.mast = unit * (12 + rand() * 18)
  }
  addWindows(building, unit, rand)
  return building
}

function addWindows(b: Building, unit: number, rand: () => number): void {
  const padX = Math.max(3, unit * 2.6)
  const padY = Math.max(4, unit * 3)
  const cols = Math.min(4, Math.max(1, Math.floor((b.w - padX * 2) / Math.max(8, unit * 7))))
  const rows = Math.min(6, Math.max(1, Math.floor((b.h - padY * 2) / Math.max(9, unit * 8.5))))
  const winW = Math.max(2, unit * 2.1)
  const winH = Math.max(2.5, unit * 3.1)
  const innerW = b.w - padX * 2
  const innerH = b.h - padY * 2
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.16) continue
      b.windows.push({
        x: b.x + padX + (c + 0.5) * (innerW / cols) - winW / 2,
        y: b.y + padY + (r + 0.5) * (innerH / rows) - winH / 2,
        w: winW,
        h: winH,
        cool: rand() < 0.16,
        phase: 0.7 + rand() * 3.2,
        alt: rand(),
      })
    }
  }
}
