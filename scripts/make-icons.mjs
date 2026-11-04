import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function png(size, paint) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const pix = new Uint8ClampedArray(size * size * 4)
  paint(pix, size)
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4
      const d = row + 1 + x * 4
      raw[d] = pix[s]
      raw[d + 1] = pix[s + 1]
      raw[d + 2] = pix[s + 2]
      raw[d + 3] = pix[s + 3]
    }
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function set(pix, size, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  const src = a / 255
  const dst = pix[i + 3] / 255
  const out = src + dst * (1 - src)
  if (out <= 0) return
  pix[i] = (r * src + pix[i] * dst * (1 - src)) / out
  pix[i + 1] = (g * src + pix[i + 1] * dst * (1 - src)) / out
  pix[i + 2] = (b * src + pix[i + 2] * dst * (1 - src)) / out
  pix[i + 3] = out * 255
}

function rect(pix, size, x, y, w, h, color) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.ceil(x + w)
  const y1 = Math.ceil(y + h)
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) set(pix, size, xx, yy, color[0], color[1], color[2], color[3] ?? 255)
  }
}

function circle(pix, size, cx, cy, radius, color) {
  const r = radius
  const x0 = Math.floor(cx - r - 1)
  const y0 = Math.floor(cy - r - 1)
  const x1 = Math.ceil(cx + r + 1)
  const y1 = Math.ceil(cy + r + 1)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const alpha = Math.max(0, Math.min(1, r - d + 0.5))
      if (alpha > 0) set(pix, size, x, y, color[0], color[1], color[2], (color[3] ?? 255) * alpha)
    }
  }
}

function roundRect(pix, size, radius, color) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x < radius ? radius - x : x > size - radius ? x - (size - radius) : 0
      const dy = y < radius ? radius - y : y > size - radius ? y - (size - radius) : 0
      if (dx * dx + dy * dy <= radius * radius) set(pix, size, x, y, color[0], color[1], color[2])
    }
  }
}

function paint(pix, size) {
  const u = size / 64
  roundRect(pix, size, 14 * u, [16, 24, 44])
  circle(pix, size, 48 * u, 16 * u, 5 * u, [244, 239, 226, 230])
  rect(pix, size, 6 * u, 46 * u, 8 * u, 12 * u, [26, 39, 68])
  rect(pix, size, 16 * u, 38 * u, 10 * u, 20 * u, [36, 54, 86])
  rect(pix, size, 36 * u, 42 * u, 8 * u, 16 * u, [26, 39, 68])
  rect(pix, size, 46 * u, 34 * u, 12 * u, 24 * u, [36, 54, 86])
  rect(pix, size, 29 * u, 18 * u, 6 * u, 22 * u, [213, 222, 234])
  rect(pix, size, 24 * u, 36 * u, 16 * u, 8 * u, [255, 177, 90])
  circle(pix, size, 32 * u, 16 * u, 3 * u, [154, 246, 255])
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png(size, paint))
}
