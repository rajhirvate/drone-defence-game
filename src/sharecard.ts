import { GAME_TITLE } from './config'

export interface ShareCardInput {
  score: number
  wave: number
  date: string
  url: string
}

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  try {
    await document.fonts.load('700 72px Orbitron')
  } catch {
    /* canvas falls back to the generic family */
  }
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('no canvas'))
  const sky = ctx.createLinearGradient(0, 0, 0, 630)
  sky.addColorStop(0, '#070914')
  sky.addColorStop(0.62, '#142848')
  sky.addColorStop(1, '#2a1c16')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1200, 630)
  ctx.fillStyle = 'rgba(154, 246, 255, 0.16)'
  ctx.beginPath()
  ctx.arc(980, 108, 48, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 241, 214, 0.2)'
  ctx.beginPath()
  ctx.arc(980, 108, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a2c4a'
  const roofs = [80, 140, 60, 170, 100, 150, 70, 120, 90, 160]
  let x = 36
  for (let i = 0; i < roofs.length; i++) {
    const w = 78 + (i % 3) * 16
    const y = 630 - roofs[i] - 36
    ctx.fillRect(x, y, w, roofs[i])
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 177, 90, 0.75)' : 'rgba(154, 246, 255, 0.7)'
    ctx.fillRect(x + 12, y + 16, 10, 10)
    ctx.fillRect(x + 30, y + 36, 10, 10)
    ctx.fillStyle = '#1a2c4a'
    x += w + 12
  }
  ctx.fillStyle = '#ffb15a'
  ctx.fillRect(0, 590, 1200, 6)
  ctx.fillStyle = '#9af6ff'
  ctx.fillRect(0, 598, 1200, 2)
  ctx.strokeStyle = 'rgba(154, 246, 255, 0.45)'
  ctx.lineWidth = 3
  ctx.strokeRect(28, 28, 1144, 574)
  ctx.strokeStyle = 'rgba(255, 177, 90, 0.7)'
  ctx.lineWidth = 2
  ctx.strokeRect(36, 36, 1128, 558)
  ctx.fillStyle = '#ffb15a'
  ctx.font = '700 22px Orbitron, ui-monospace, monospace'
  ctx.fillText('DAILY CHALLENGE', 72, 100)
  ctx.fillStyle = '#f4f1ea'
  ctx.shadowColor = 'rgba(255, 177, 90, 0.65)'
  ctx.shadowBlur = 22
  ctx.font = '700 68px Orbitron, system-ui, sans-serif'
  ctx.fillText(GAME_TITLE.toUpperCase(), 72, 186)
  ctx.shadowBlur = 0
  ctx.font = '700 92px Orbitron, ui-monospace, monospace'
  ctx.fillText(input.score.toLocaleString('en-US'), 72, 320)
  ctx.fillStyle = 'rgba(244,241,234,0.82)'
  ctx.font = '700 32px Orbitron, system-ui, sans-serif'
  ctx.fillText(`WAVE ${input.wave}`, 72, 384)
  ctx.font = '700 28px Orbitron, system-ui, sans-serif'
  ctx.fillText(input.date, 72, 430)
  ctx.font = '700 24px ui-monospace, monospace'
  ctx.fillStyle = '#9af6ff'
  ctx.fillText(input.url, 72, 530)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('png failed'))
    }, 'image/png')
  })
}

export async function shareCard(blob: Blob, input: ShareCardInput): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], `drone-defence-${input.date}.png`, { type: 'image/png' })
  const text = `I scored ${input.score.toLocaleString('en-US')} on the ${input.date} daily in ${GAME_TITLE}.`
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: GAME_TITLE, text, url: input.url })
      return 'shared'
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      if (name === 'AbortError') return 'shared'
    }
  }
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = file.name
  link.click()
  URL.revokeObjectURL(href)
  try {
    await navigator.clipboard.writeText(`${text} ${input.url}`)
  } catch {
    /* clipboard may be blocked; the PNG still downloaded */
  }
  return 'downloaded'
}
