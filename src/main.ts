import Phaser from 'phaser'
import { audio } from './audio'
import { GAME_TITLE } from './config'
import { PlayScene } from './scenes/PlayScene'
import { mountUi } from './ui'
import './style.css'

document.title = GAME_TITLE

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id}`)
  return el
}

const app = requireEl('app')
const gameRoot = requireEl('game')
const uiRoot = requireEl('ui')

mountUi(uiRoot)

function blockGesture(event: Event): void {
  event.preventDefault()
}

document.addEventListener('contextmenu', blockGesture)
document.addEventListener('gesturestart', blockGesture)
document.addEventListener('gesturechange', blockGesture)
document.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length > 1) event.preventDefault()
  },
  { passive: false },
)
document.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) event.preventDefault()
  },
  { passive: false },
)
window.addEventListener('pointerdown', () => audio.unlock(), { passive: true })

const holder = window as Window & { __DRONE_GAME__?: Phaser.Game }
holder.__DRONE_GAME__?.destroy(true)

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  backgroundColor: '#070914',
  banner: false,
  title: GAME_TITLE,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  fps: { target: 60, min: 30, smoothStep: true },
  input: { activePointers: 3 },
  disableContextMenu: true,
  autoFocus: false,
  audio: { noAudio: true },
  powerPreference: 'high-performance',
  scene: [PlayScene],
})

holder.__DRONE_GAME__ = game

function fitViewport(): void {
  const viewport = window.visualViewport
  const width = viewport?.width ?? window.innerWidth
  const height = viewport?.height ?? window.innerHeight
  app.style.width = `${width}px`
  app.style.height = `${height}px`
  if (game.isBooted) game.scale.refresh()
}

fitViewport()
window.addEventListener('resize', fitViewport)
window.visualViewport?.addEventListener('resize', fitViewport)
window.visualViewport?.addEventListener('scroll', fitViewport)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true)
    if (holder.__DRONE_GAME__ === game) holder.__DRONE_GAME__ = undefined
  })
}
