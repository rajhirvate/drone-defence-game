import { GAME_TITLE } from './config'

export interface ShareCardInput {
  score: number
  wave: number
  date: string
  url: string
}

export function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('no canvas'))
  const sky = ctx.createLinearGradient(0, 0, 0, 630)
  sky.addColorStop(0, '#070914')
  sky.addColorStop(0.72, '#1a3358')
  sky.addColorStop(1, '#3a261c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1200, 630)
  ctx.fillStyle = 'rgba(244, 239, 226, 0.18)'
  ctx.beginPath()
  ctx.arc(980, 110, 46, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#243656'
  const roofs = [80, 140, 60, 170, 100, 150, 70, 120, 90, 160]
  let x = 40
  for (let i = 0; i < roofs.length; i++) {
    const w = 70 + (i % 3) * 18
    ctx.fillRect(x, 630 - roofs[i] - 40, w, roofs[i])
    x += w + 16
  }
  ctx.fillStyle = '#ffb15a'
  ctx.fillRect(0, 586, 1200, 4)
  ctx.fillStyle = '#ffb15a'
  ctx.font = '600 22px ui-monospace, monospace'
  ctx.fillText('DAILY CHALLENGE', 72, 92)
  ctx.fillStyle = '#f4f1ea'
  ctx.font = '700 72px system-ui, sans-serif'
  ctx.fillText(GAME_TITLE, 72, 180)
  ctx.font = '700 92px ui-monospace, monospace'
  ctx.fillText(input.score.toLocaleString('en-US'), 72, 310)
  ctx.fillStyle = 'rgba(244,241,234,0.78)'
  ctx.font = '500 32px system-ui, sans-serif'
  ctx.fillText(`Wave ${input.wave}`, 72, 370)
  ctx.fillText(input.date, 72, 418)
  ctx.font = '500 26px ui-monospace, monospace'
  ctx.fillStyle = '#9af6ff'
  ctx.fillText(input.url, 72, 520)
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
