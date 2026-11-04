import { audio } from './audio'
import { emitCommand, onView } from './bridge'
import { LEVELS } from './campaign'
import { GAME_TITLE, MISSILE_SKINS, SHOP, UPGRADES, rankCost, type MissileSkinId, type UpgradeId, type WeaponId } from './config'
import { todayKey } from './daily'
import { formatInt } from './math'
import { renderShareCard, shareCard } from './sharecard'
import { loadSave } from './storage'
import type { Snapshot } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`
}

const ICO = {
  gear: icon(
    '<circle cx="12" cy="12" r="3"/><path d="M12 3.2v2.2M12 18.6V21M3.2 12h2.2M18.6 12H21M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5"/>',
  ),
  sound: icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  haptic: icon('<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M5 9.5v5M19 9.5v5"/>'),
  cross: icon('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v4.2M12 17v4.2M2.8 12h4.2M17 12h4.2"/>'),
  endless: icon('<circle cx="8" cy="12" r="3.2"/><circle cx="16" cy="12" r="3.2"/>'),
  daily: icon('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>'),
  armoury: icon('<path d="M12 3.2 19 6v5.6c0 4.2-2.8 7-7 8.8-4.2-1.8-7-4.6-7-8.8V6z"/>'),
  pause: icon('<path d="M7 4h3.2v16H7zM13.8 4H17v16h-3.2z"/>'),
  rate: icon('<path d="M4 16 9 10l3.5 3L20 5"/><path d="M14 5h6v6"/>'),
  spread: icon('<path d="M12 20V9M12 9 6 5M12 9l6-4"/>'),
  damage: icon('<path d="m12 3 2 6.2L20.5 12 14 14.8 12 21l-2-6.2L3.5 12 10 9.2z"/>'),
  laser: icon('<path d="M3 12h18M8 8 6 12l2 4M16 8l2 4-2 4"/>'),
  missile: icon('<path d="M12 3.5 14.5 9 12 11 9.5 9zM12 11v9M8.5 16.5 12 20l3.5-3.5"/>'),
  emp: icon('<circle cx="12" cy="12" r="2.4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>'),
}

const UPGRADE_ICON: Record<UpgradeId, string> = {
  rate: ICO.rate,
  spread: ICO.spread,
  damage: ICO.damage,
}

function formatDay(iso: string): string {
  const parts = iso.split('-')
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day || month > 12) return iso
  return `${MONTHS[month - 1]} ${day}`
}

function finePointer(): boolean {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export function mountUi(root: HTMLElement): void {
  const touchUi = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
  document.body.classList.toggle('touch-ui', touchUi)

  root.innerHTML = `
    <div id="hurt"></div>
    <div id="flash"></div>
    <div id="vignette"></div>
    <div id="hud" hidden>
      <div class="hud-top">
        <div class="stat score-stat">
          <span class="k">Score</span>
          <span class="v" id="score">0</span>
          <span class="best-flag" id="best-flag" hidden>Best</span>
        </div>
        <div class="stat">
          <span class="k">Wave</span>
          <span class="v" id="wave">1</span>
        </div>
        <div class="stat">
          <span class="k">Combo</span>
          <span class="v" id="combo">x1</span>
        </div>
        <div class="stat" id="coin-stat"><span class="k">Coins</span><span class="v" id="coins">0</span></div>
        <div class="hud-actions">
          <button type="button" class="hud-btn icon" id="auto-btn" aria-pressed="false" aria-label="Auto-fire">${ICO.cross}</button>
          <button type="button" class="hud-btn icon" id="mute-btn" aria-pressed="false" aria-label="Mute sound">${ICO.sound}</button>
          <button type="button" class="hud-btn icon" id="pause-btn" aria-label="Pause">${ICO.pause}</button>
        </div>
      </div>
      <div class="hp-row">
        <span class="k">City</span>
        <div class="hp-track" aria-hidden="true"><div id="hp-fill"></div></div>
      </div>
      <div class="weapon-row" id="weapons"></div>
      <p id="weapon-hint" class="weapon-hint" hidden></p>
      <div id="banner"></div>
      <div id="tutorial" hidden>
        <p id="tutorial-text"></p>
        <button type="button" class="ghost" id="skip-tutorial">Skip</button>
      </div>
    </div>
    <section class="overlay menu-screen" id="menu">
      <button type="button" class="icon-btn corner-gear" id="menu-gear" aria-expanded="false" aria-controls="settings-sheet" aria-label="Settings">${ICO.gear}</button>
      <div class="sheet settings-sheet" id="settings-sheet" hidden role="dialog" aria-label="Settings">
        <button type="button" class="toggle" id="menu-mute" aria-pressed="true">
          <span class="toggle-ico" aria-hidden="true">${ICO.sound}</span>
          <span class="toggle-name">Sound</span>
          <span class="toggle-state">On</span>
        </button>
        <button type="button" class="toggle" id="menu-haptics" aria-pressed="true">
          <span class="toggle-ico" aria-hidden="true">${ICO.haptic}</span>
          <span class="toggle-name">Haptics</span>
          <span class="toggle-state">On</span>
        </button>
        <button type="button" class="toggle" id="menu-auto" aria-pressed="false">
          <span class="toggle-ico" aria-hidden="true">${ICO.cross}</span>
          <span class="toggle-name">Auto-fire</span>
          <span class="toggle-state">Off</span>
        </button>
      </div>
      <div class="menu-cluster">
        <div class="menu-brand">
          <div class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <circle class="ring" cx="32" cy="32" r="16"/>
              <path class="ticks" d="M32 8v8M32 48v8M8 32h8M48 32h8"/>
              <circle class="dot" cx="32" cy="32" r="3"/>
            </svg>
          </div>
          <p class="eyebrow">Close-in battery</p>
          <h1 class="logo" id="title"><span id="title-a"></span><span id="title-b"></span></h1>
          <p class="tag">Hold the skyline.</p>
          <p class="keys keys-desktop">Space fires · F auto-fire · M mute</p>
        </div>
        <button type="button" class="primary play-btn" id="campaign">
          <span class="play-kicker">Campaign</span>
          <span class="play-label">Play</span>
        </button>
        <div class="mode-row">
          <button type="button" class="mode-card" id="endless">
            <span class="mode-ico" aria-hidden="true">${ICO.endless}</span>
            <span class="mode-name">Endless</span>
            <span class="mode-sub"><span class="mode-line">Best <strong id="menu-best">0</strong></span></span>
          </button>
          <button type="button" class="mode-card" id="daily">
            <span class="mode-ico" aria-hidden="true">${ICO.daily}</span>
            <span class="mode-name">Daily</span>
            <span class="mode-sub" id="menu-daily"><span id="menu-daily-date">—</span><span id="menu-daily-best">Best —</span></span>
          </button>
          <button type="button" class="mode-card" id="armoury">
            <span class="mode-ico" aria-hidden="true">${ICO.armoury}</span>
            <span class="mode-name">Armoury</span>
            <span class="mode-sub">Weapons and skins</span>
          </button>
        </div>
        <button type="button" class="text-btn" id="howto-open" aria-expanded="false" aria-controls="howto-sheet">How to play</button>
      </div>
      <div class="sheet howto-sheet" id="howto-sheet" hidden role="dialog" aria-label="How to play">
        <p class="eyebrow">Field notes</p>
        <h2>How to play</h2>
        <ul class="howto">
          <li>Aim with the pointer. Hold to fire, or switch on auto-fire.</li>
          <li>Drones weave. Missiles dive. Swarms split.</li>
          <li>Clear a wave, then pick one upgrade. They stack.</li>
          <li>EMP is a tap. It stuns and damages nearby drones, then cools down.</li>
        </ul>
        <p class="keys">Space fires · F auto-fire · M mute</p>
        <button type="button" class="ghost" id="howto-close">Close</button>
      </div>
    </section>
    <section class="overlay" id="map" hidden>
      <div class="panel">
        <p class="eyebrow">Campaign</p>
        <h2>Level map</h2>
        <p class="sub" id="map-coins"></p>
        <div class="map" id="map-nodes"></div>
        <div class="stack row">
          <button type="button" class="ghost" id="map-back">Menu</button>
          <button type="button" class="primary" id="map-shop">Armoury</button>
        </div>
      </div>
    </section>
    <section class="overlay" id="shop" hidden>
      <div class="panel">
        <p class="eyebrow">Armoury</p>
        <h2>Fit the battery</h2>
        <p class="sub" id="shop-coins"></p>
        <div class="choices" id="shop-weapons"></div>
        <div class="choices" id="shop-ranks"></div>
        <p class="eyebrow skins-label">Missile skins</p>
        <p class="sub">Colours and trails for homing missiles.</p>
        <div class="skin-grid" id="shop-skins"></div>
        <button type="button" class="ghost" id="shop-back">Back</button>
      </div>
    </section>
    <section class="overlay" id="clear" hidden>
      <div class="panel">
        <p class="eyebrow">Level clear</p>
        <h2 id="clear-title">Sky held</h2>
        <p class="final" id="clear-stars">★★★</p>
        <p class="sub" id="clear-detail"></p>
        <div class="stack">
          <button type="button" class="primary" id="clear-map">Level map</button>
          <button type="button" class="ghost" id="clear-shop">Spend coins</button>
        </div>
      </div>
    </section>
    <section class="overlay" id="upgrade" hidden>
      <div class="panel">
        <p class="eyebrow">Between waves</p>
        <h2>Choose an upgrade</h2>
        <p class="sub" id="upgrade-sub"></p>
        <div class="choices" id="choices"></div>
      </div>
    </section>
    <section class="overlay" id="pause" hidden>
      <div class="panel">
        <p class="eyebrow">Battery hold</p>
        <h2>Paused</h2>
        <p class="sub">The sky waits.</p>
        <div class="stack">
          <button type="button" class="primary" id="resume">Resume</button>
          <button type="button" class="ghost" id="pause-menu">Menu</button>
        </div>
      </div>
    </section>
    <section class="overlay" id="over" hidden>
      <div class="panel">
        <p class="eyebrow">Game over</p>
        <h2>The skyline fell</h2>
        <p class="final" id="final-score">0</p>
        <p class="new-best" id="new-best" hidden>New best</p>
        <p class="sub" id="final-detail"></p>
        <p class="best-line">Best <strong id="over-best">0</strong></p>
        <div class="stack">
          <button type="button" class="primary" id="restart">Restart</button>
          <button type="button" class="ghost" id="share">Share</button>
        </div>
        <img id="card-preview" alt="Daily share card" hidden />
        <p class="note" id="share-note" aria-live="polite"></p>
        <input id="share-fallback" hidden readonly aria-label="Share text" />
      </div>
    </section>
  `

  const titleA = root.querySelector('#title-a')
  const titleB = root.querySelector('#title-b')
  const splitAt = GAME_TITLE.indexOf(' ')
  if (titleA && titleB && splitAt > 0) {
    titleA.textContent = GAME_TITLE.slice(0, splitAt)
    titleB.textContent = GAME_TITLE.slice(splitAt + 1)
  } else if (titleA) {
    titleA.textContent = GAME_TITLE
  }

  const choices = root.querySelector('#choices')
  if (choices) {
    for (const upgrade of UPGRADES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'choice'
      button.dataset.id = upgrade.id
      button.innerHTML = `
        <span class="choice-kicker"></span>
        <span class="choice-name">${UPGRADE_ICON[upgrade.id]}${upgrade.name}</span>
        <span class="choice-blurb">${upgrade.blurb}</span>
        <span class="choice-stat"></span>
      `
      button.addEventListener('click', () => {
        audio.unlock()
        emitCommand({ type: 'upgrade', id: upgrade.id })
      })
      choices.appendChild(button)
    }
  }

  const restart = root.querySelector<HTMLButtonElement>('#restart')
  const share = root.querySelector<HTMLButtonElement>('#share')
  const menuAuto = root.querySelector<HTMLButtonElement>('#menu-auto')
  const menuMute = root.querySelector<HTMLButtonElement>('#menu-mute')
  const menuHaptics = root.querySelector<HTMLButtonElement>('#menu-haptics')
  const autoBtn = root.querySelector<HTMLButtonElement>('#auto-btn')
  const muteBtn = root.querySelector<HTMLButtonElement>('#mute-btn')
  const pauseBtn = root.querySelector<HTMLButtonElement>('#pause-btn')
  const note = root.querySelector<HTMLElement>('#share-note')
  const fallback = root.querySelector<HTMLInputElement>('#share-fallback')
  const gear = root.querySelector<HTMLButtonElement>('#menu-gear')
  const settings = root.querySelector<HTMLElement>('#settings-sheet')
  const howtoOpen = root.querySelector<HTMLButtonElement>('#howto-open')
  const howto = root.querySelector<HTMLElement>('#howto-sheet')
  const campaignBtn = root.querySelector<HTMLButtonElement>('#campaign')
  const endlessBtn = root.querySelector<HTMLButtonElement>('#endless')

  const setSheet = (sheet: HTMLElement | null, open: boolean, toggle?: HTMLButtonElement | null): void => {
    if (sheet) sheet.hidden = !open
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false')
  }

  let shopReturn: 'menu' | 'map' = 'menu'
  const closeSheets = (): void => {
    setSheet(settings, false, gear)
    setSheet(howto, false, howtoOpen)
  }

  gear?.addEventListener('click', (event) => {
    event.stopPropagation()
    const open = settings?.hidden !== false
    setSheet(settings, open, gear)
    setSheet(howto, false, howtoOpen)
  })
  howtoOpen?.addEventListener('click', (event) => {
    event.stopPropagation()
    const open = howto?.hidden !== false
    setSheet(howto, open, howtoOpen)
    setSheet(settings, false, gear)
  })
  root.querySelector('#howto-close')?.addEventListener('click', () => setSheet(howto, false, howtoOpen))

  const menu = root.querySelector<HTMLElement>('#menu')
  menu?.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (settings && !settings.hidden && !gear?.contains(target) && !settings.contains(target)) setSheet(settings, false, gear)
    if (howto && !howto.hidden && !howtoOpen?.contains(target) && !howto.contains(target)) setSheet(howto, false, howtoOpen)
  })

  campaignBtn?.addEventListener('click', () => {
    closeSheets()
    audio.unlock()
    emitCommand({ type: 'open-map' })
  })
  endlessBtn?.addEventListener('click', () => {
    closeSheets()
    audio.unlock()
    emitCommand({ type: 'start-endless' })
  })
  root.querySelector('#daily')?.addEventListener('click', () => {
    closeSheets()
    audio.unlock()
    emitCommand({ type: 'start-daily' })
  })
  root.querySelector('#armoury')?.addEventListener('click', () => {
    closeSheets()
    shopReturn = 'menu'
    audio.unlock()
    emitCommand({ type: 'open-armoury' })
  })
  root.querySelector('#map-back')?.addEventListener('click', () => emitCommand({ type: 'back-menu' }))
  root.querySelector('#map-shop')?.addEventListener('click', () => {
    shopReturn = 'map'
    emitCommand({ type: 'open-armoury' })
  })
  root.querySelector('#clear-shop')?.addEventListener('click', () => {
    shopReturn = 'map'
    emitCommand({ type: 'open-armoury' })
  })
  root.querySelector('#shop-back')?.addEventListener('click', () => {
    emitCommand({ type: shopReturn === 'map' ? 'open-map' : 'back-menu' })
  })
  root.querySelector('#clear-map')?.addEventListener('click', () => emitCommand({ type: 'to-map' }))
  root.querySelector('#skip-tutorial')?.addEventListener('click', () => emitCommand({ type: 'skip-tutorial' }))
  menuHaptics?.addEventListener('click', () => emitCommand({ type: 'toggle-haptics' }))
  pauseBtn?.addEventListener('click', () => emitCommand({ type: 'pause' }))
  root.querySelector('#resume')?.addEventListener('click', () => {
    audio.unlock()
    emitCommand({ type: 'resume' })
  })
  root.querySelector('#pause-menu')?.addEventListener('click', () => emitCommand({ type: 'back-menu' }))
  wireWeapons(root)
  restart?.addEventListener('click', () => {
    audio.unlock()
    emitCommand({ type: 'restart' })
  })
  share?.addEventListener('click', () => {
    if (latest?.mode === 'daily') return
    audio.unlock()
    void shareScore(latest, note, fallback)
  })
  for (const button of [menuAuto, autoBtn]) {
    button?.addEventListener('click', () => {
      audio.unlock()
      emitCommand({ type: 'toggle-autofire' })
    })
  }
  for (const button of [menuMute, muteBtn]) {
    button?.addEventListener('click', () => {
      audio.unlock()
      emitCommand({ type: 'toggle-mute' })
    })
  }

  let phase: Snapshot['phase'] | null = null
  const map = root.querySelector<HTMLElement>('#map')
  const shop = root.querySelector<HTMLElement>('#shop')
  const clear = root.querySelector<HTMLElement>('#clear')
  const upgrade = root.querySelector<HTMLElement>('#upgrade')
  const pause = root.querySelector<HTMLElement>('#pause')
  const over = root.querySelector<HTMLElement>('#over')
  const hud = root.querySelector<HTMLElement>('#hud')
  const tutorial = root.querySelector<HTMLElement>('#tutorial')
  const flashEl = root.querySelector<HTMLElement>('#flash')
  const scoreEl = root.querySelector<HTMLElement>('#score')
  const waveEl = root.querySelector<HTMLElement>('#wave')
  const comboEl = root.querySelector<HTMLElement>('#combo')
  const hpFill = root.querySelector<HTMLElement>('#hp-fill')
  const banner = root.querySelector<HTMLElement>('#banner')
  const bestFlag = root.querySelector<HTMLElement>('#best-flag')
  const hurt = root.querySelector<HTMLElement>('#hurt')
  const vignette = root.querySelector<HTMLElement>('#vignette')
  const resumeBtn = root.querySelector<HTMLButtonElement>('#resume')

  const seen = {
    score: '',
    wave: '',
    combo: '',
    hp: '',
    banner: '',
    auto: '',
    mute: '',
    bestFlag: false,
    low: false,
    hurt: '',
    paused: false,
  }

  onView((snapshot) => {
    latest = snapshot
    if (snapshot.phase !== phase) {
      phase = snapshot.phase
      if (menu) menu.hidden = snapshot.phase !== 'menu'
      if (map) map.hidden = snapshot.phase !== 'map'
      if (shop) shop.hidden = snapshot.phase !== 'armoury'
      if (clear) clear.hidden = snapshot.phase !== 'clear'
      if (upgrade) upgrade.hidden = snapshot.phase !== 'upgrade'
      if (over) over.hidden = snapshot.phase !== 'gameover'
      const showHud = snapshot.phase === 'playing' || snapshot.phase === 'upgrade' || snapshot.phase === 'clear' || snapshot.phase === 'gameover'
      if (hud) hud.hidden = !showHud
      document.body.classList.toggle('is-playing', snapshot.phase === 'playing')
      if (snapshot.phase === 'menu') closeSheets()
      if (snapshot.phase === 'map') fillMap(root)
      if (snapshot.phase === 'armoury') fillShop(root)
      if (snapshot.phase === 'clear') fillClear(root, snapshot)
      if (snapshot.phase === 'gameover' && snapshot.mode === 'daily') void showDailyCard(root, snapshot)
      if (snapshot.phase === 'menu' && finePointer()) campaignBtn?.focus()
      if (snapshot.phase === 'upgrade') {
        fillUpgrades(root, snapshot)
        if (finePointer()) root.querySelector<HTMLButtonElement>('#choices .choice')?.focus()
      }
      if (snapshot.phase === 'gameover') {
        fillGameOver(root, snapshot)
        if (note) note.textContent = ''
        if (fallback) fallback.hidden = true
        if (finePointer()) restart?.focus()
      }
    } else if (snapshot.phase === 'upgrade') {
      fillUpgrades(root, snapshot)
    }

    if (pauseBtn) pauseBtn.hidden = snapshot.phase !== 'playing'
    const showPause = snapshot.paused && snapshot.phase === 'playing'
    if (pause && pause.hidden === showPause) {
      pause.hidden = !showPause
      if (showPause && finePointer()) resumeBtn?.focus()
    }

    const scoreText = formatInt(snapshot.score)
    if (seen.score !== scoreText && scoreEl) {
      scoreEl.textContent = scoreText
      seen.score = scoreText
    }
    const waveText = snapshot.wave > 0 ? String(snapshot.wave) : '–'
    if (seen.wave !== waveText && waveEl) {
      waveEl.textContent = waveText
      seen.wave = waveText
    }
    const comboText = `x${snapshot.mult}`
    if (seen.combo !== comboText && comboEl) {
      comboEl.textContent = comboText
      comboEl.classList.toggle('hot', snapshot.comboHot)
      comboEl.classList.toggle('max', snapshot.mult >= 4)
      seen.combo = comboText
    }
    const hp = String(Math.max(0, snapshot.cityHp / snapshot.cityMax))
    if (seen.hp !== hp && hpFill) {
      hpFill.style.transform = `scaleX(${hp})`
      const ratio = snapshot.cityHp / snapshot.cityMax
      hpFill.classList.toggle('mid', ratio <= 0.6 && ratio > 0.35)
      hpFill.classList.toggle('low', snapshot.low)
      seen.hp = hp
    }
    if (seen.banner !== snapshot.banner && banner) {
      banner.textContent = snapshot.banner
      banner.classList.toggle('show', snapshot.banner.length > 0)
      seen.banner = snapshot.banner
    }
    const showBest = snapshot.newBest && snapshot.score > 0 && snapshot.phase === 'playing'
    if (seen.bestFlag !== showBest && bestFlag) {
      bestFlag.hidden = !showBest
      seen.bestFlag = showBest
    }
    const autoKey = snapshot.autoFire ? '1' : '0'
    if (seen.auto !== autoKey) {
      setAuto(menuAuto, snapshot.autoFire, true)
      setAuto(autoBtn, snapshot.autoFire, false)
      seen.auto = autoKey
    }
    const muteKey = snapshot.muted ? '1' : '0'
    if (seen.mute !== muteKey) {
      setMute(menuMute, snapshot.muted, true)
      setMute(muteBtn, snapshot.muted, false)
      seen.mute = muteKey
    }
    const hurtKey = snapshot.hurt.toFixed(2)
    if (seen.hurt !== hurtKey && hurt) {
      hurt.style.opacity = String(snapshot.hurt * 0.65)
      seen.hurt = hurtKey
    }
    if (seen.low !== snapshot.low && vignette) {
      vignette.classList.toggle('low', snapshot.low && snapshot.phase !== 'menu')
      seen.low = snapshot.low
    }
    const menuBest = root.querySelector('#menu-best')
    if (menuBest && snapshot.phase === 'menu') menuBest.textContent = formatInt(snapshot.best)
    const dailyDate = root.querySelector('#menu-daily-date')
    const dailyBest = root.querySelector('#menu-daily-best')
    if (dailyDate && dailyBest && snapshot.phase === 'menu') {
      const save = loadSave()
      const date = todayKey()
      const best = save.dailyBest[date]
      dailyDate.textContent = formatDay(date)
      dailyBest.textContent = best ? `Best ${formatInt(best)}` : 'Best —'
    }
    const coinsEl = root.querySelector('#coins')
    if (coinsEl) coinsEl.textContent = formatInt(snapshot.coins)
    if (tutorial) {
      tutorial.hidden = snapshot.tutorial.length === 0 || snapshot.phase !== 'playing'
      const text = root.querySelector('#tutorial-text')
      if (text) text.textContent = snapshot.tutorial
    }
    if (menuHaptics) setHaptics(menuHaptics, loadSave().haptics)
    if (snapshot.phase === 'armoury') {
      const shopKey = `${snapshot.coins}:${snapshot.weapon}:${snapshot.ownedLaser}:${snapshot.ownedMissile}:${snapshot.ownedEmp}:${snapshot.missileSkin}:${snapshot.ownedSkinKey}`
      if (shopKey !== root.dataset.shop) {
        root.dataset.shop = shopKey
        fillShop(root)
      }
    }
    paintEmpHint(root, snapshot)
    paintWeaponRow(root, snapshot)
    if (flashEl) flashEl.style.opacity = String(snapshot.flash * 0.72)
  })

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault()
      audio.unlock()
      emitCommand({ type: 'toggle-mute' })
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault()
      audio.unlock()
      emitCommand({ type: 'toggle-autofire' })
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (latest?.paused) emitCommand({ type: 'resume' })
      else if (latest?.phase === 'playing') emitCommand({ type: 'pause' })
    } else if (event.key === '1') emitCommand({ type: 'equip', id: 'cannon' })
    else if (event.key === '2') emitCommand({ type: 'equip', id: 'laser' })
    else if (event.key === '3') emitCommand({ type: 'equip', id: 'missile' })
    else if (event.key === '4') emitCommand({ type: 'equip', id: 'emp' })
  })
}

let empHintShown = false
let latest: Snapshot | null = null

function wireWeapons(root: HTMLElement): void {
  const row = root.querySelector('#weapons')
  if (!row) return
  const items: { id: WeaponId; label: string }[] = [
    { id: 'cannon', label: 'Cannon' },
    { id: 'laser', label: 'Laser' },
    { id: 'missile', label: 'Missiles' },
    { id: 'emp', label: 'EMP' },
  ]
  for (const item of items) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'hud-btn'
    button.dataset.weapon = item.id
    const sub = item.id === 'emp' ? '<span class="weapon-sub" hidden>Tap</span>' : ''
    button.innerHTML = `<span class="cd-ring" hidden></span><span class="weapon-label">${item.label}</span>${sub}`
    button.addEventListener('click', () => {
      audio.unlock()
      const snap = latest
      if (snap && snap.weapon === item.id && snap.phase === 'playing') {
        emitCommand(item.id === 'emp' ? { type: 'fire-emp' } : { type: 'tap-fire' })
        return
      }
      emitCommand({ type: 'equip', id: item.id })
    })
    row.appendChild(button)
  }
}

function paintEmpHint(root: HTMLElement, snapshot: Snapshot): void {
  const hint = root.querySelector<HTMLElement>('#weapon-hint')
  if (!hint || empHintShown || snapshot.weapon !== 'emp' || loadSave().empHintSeen) return
  empHintShown = true
  hint.hidden = false
  hint.textContent = 'EMP: stuns and damages all drones nearby. Tap to fire.'
  window.setTimeout(() => {
    hint.hidden = true
  }, 4800)
  emitCommand({ type: 'mark-emp-hint' })
}

function paintWeaponRow(root: HTMLElement, snapshot: Snapshot): void {
  const owned: Record<WeaponId, boolean> = {
    cannon: true,
    laser: snapshot.ownedLaser,
    missile: snapshot.ownedMissile,
    emp: snapshot.ownedEmp,
  }
  root.querySelectorAll<HTMLButtonElement>('#weapons button').forEach((button) => {
    const id = button.dataset.weapon as WeaponId
    const has = owned[id]
    button.hidden = !has
    button.classList.toggle('on', snapshot.weapon === id)
    const ring = button.querySelector<HTMLElement>('.cd-ring')
    const sub = button.querySelector<HTMLElement>('.weapon-sub')
    if (id !== 'emp') {
      if (ring) ring.hidden = true
      button.setAttribute('aria-label', button.querySelector('.weapon-label')?.textContent ?? id)
      return
    }
    const cooling = snapshot.empCd > 0.12 && snapshot.empMax > 0
    const p = cooling ? Math.round((snapshot.empCd / snapshot.empMax) * 100) : 0
    if (ring) {
      ring.hidden = !cooling
      ring.style.setProperty('--p', String(p))
    }
    if (sub) sub.hidden = cooling || snapshot.weapon !== 'emp'
    button.setAttribute(
      'aria-label',
      cooling ? `EMP cooling down, ${snapshot.empCd.toFixed(1)} seconds` : 'EMP, tap to fire',
    )
  })
}

function fillMap(root: HTMLElement): void {
  const save = loadSave()
  const coins = root.querySelector('#map-coins')
  if (coins) coins.textContent = `${formatInt(save.coins)} coins`
  const host = root.querySelector('#map-nodes')
  if (!host) return
  host.replaceChildren()
  for (const level of LEVELS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'node'
    const locked = level.id > save.unlocked
    if (locked) button.classList.add('locked')
    if (level.boss !== 'none') button.classList.add('boss')
    const stars = save.stars[level.id] ?? 0
    button.disabled = locked
    const starText = locked ? 'Locked' : '★★★'.slice(0, stars) + '☆☆☆'.slice(stars)
    button.innerHTML = `<span class="k">${level.id}</span><strong>${level.name}</strong><span class="stars">${starText}</span>`
    button.addEventListener('click', () => {
      audio.unlock()
      emitCommand({ type: 'start-level', id: level.id })
    })
    host.appendChild(button)
  }
}

function fillShop(root: HTMLElement): void {
  const save = loadSave()
  const coins = root.querySelector('#shop-coins')
  if (coins) coins.textContent = `${formatInt(save.coins)} coins · equipped ${save.equipped}`
  const weapons = root.querySelector('#shop-weapons')
  const ranks = root.querySelector('#shop-ranks')
  if (!weapons || !ranks) return
  weapons.replaceChildren()
  const list: { id: 'laser' | 'missile' | 'emp'; name: string; ico: string }[] = [
    { id: 'laser', name: 'Laser', ico: ICO.laser },
    { id: 'missile', name: 'Missile battery', ico: ICO.missile },
    { id: 'emp', name: 'EMP', ico: ICO.emp },
  ]
  for (const item of list) {
    const owned = save.owned[item.id]
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'choice'
    const cost = SHOP.unlock[item.id]
    button.innerHTML = `<span class="choice-name">${item.ico}${item.name}</span><span class="choice-stat">${owned ? (save.equipped === item.id ? 'Equipped' : 'Equip') : `${cost} coins`}</span>`
    button.addEventListener('click', () => {
      audio.unlock()
      emitCommand({ type: 'buy-weapon', id: item.id })
    })
    weapons.appendChild(button)
  }
  ranks.replaceChildren()
  const rankIds: UpgradeId[] = ['rate', 'spread', 'damage']
  const names = { rate: 'Rapid Cycle', spread: 'Flak Burst', damage: 'Heavy Rounds' }
  for (const id of rankIds) {
    const rank = save.ranks[id]
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'choice'
    button.disabled = rank >= SHOP.maxRank
    button.innerHTML = `<span class="choice-name">${UPGRADE_ICON[id]}${names[id]}</span><span class="choice-stat">${rank >= SHOP.maxRank ? 'Max' : `Lv ${rank} · ${rankCost(rank)} coins`}</span>`
    button.addEventListener('click', () => {
      audio.unlock()
      emitCommand({ type: 'buy-rank', id })
    })
    ranks.appendChild(button)
  }
  const skins = root.querySelector('#shop-skins')
  if (!skins) return
  skins.replaceChildren()
  for (const skin of MISSILE_SKINS) {
    const owned = save.ownedSkins[skin.id]
    const equipped = save.missileSkin === skin.id
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'skin-card'
    if (equipped) button.classList.add('on')
    const badge = equipped ? 'Equipped' : owned ? 'Unlocked' : 'Locked'
    const action = equipped ? 'Equipped' : owned ? 'Equip' : `${skin.cost} coins`
    button.disabled = !owned && skin.cost > save.coins
    button.innerHTML = `<span class="badge">${badge}</span>${skinPreview(skin.id)}<span class="choice-name">${skin.name}</span><span class="choice-blurb">${skin.blurb}</span><span class="choice-stat">${action}</span>`
    button.addEventListener('click', () => {
      audio.unlock()
      emitCommand({ type: 'buy-skin', id: skin.id })
    })
    skins.appendChild(button)
  }
}

function skinPreview(id: MissileSkinId): string {
  if (id === 'flare') {
    return '<svg class="skin-svg" viewBox="0 0 120 36" aria-hidden="true"><path d="M6 18h62" stroke="#ff6a2a" stroke-width="7" stroke-linecap="round"/><path d="M70 18l34-12v24z" fill="#ffb15a"/><path d="M78 18l16-6v12z" fill="#fff6d2"/></svg>'
  }
  if (id === 'needle') {
    return '<svg class="skin-svg" viewBox="0 0 120 36" aria-hidden="true"><path d="M4 18h92" stroke="#f7fbff" stroke-width="2"/><path d="M96 18l20-4v8z" fill="#9af6ff"/></svg>'
  }
  if (id === 'comet') {
    return '<svg class="skin-svg" viewBox="0 0 120 36" aria-hidden="true"><circle cx="28" cy="18" r="3" fill="#ffb15a"/><circle cx="48" cy="18" r="4" fill="#e4d8ff"/><circle cx="70" cy="18" r="5" fill="#c9a6ff"/><circle cx="96" cy="18" r="8" fill="#6a4cff"/><circle cx="99" cy="16" r="3" fill="#f4f1ea"/></svg>'
  }
  return '<svg class="skin-svg" viewBox="0 0 120 36" aria-hidden="true"><path d="M8 18h64" stroke="#9af6ff" stroke-width="3" stroke-linecap="round"/><path d="M74 18l28-9 6 9-6 9z" fill="#f4f1ea"/></svg>'
}

function fillClear(root: HTMLElement, snapshot: Snapshot): void {
  const title = root.querySelector('#clear-title')
  const stars = root.querySelector('#clear-stars')
  const detail = root.querySelector('#clear-detail')
  if (title) title.textContent = snapshot.levelName || 'Sky held'
  if (stars) stars.textContent = '★★★'.slice(0, snapshot.clearStars) + '☆☆☆'.slice(snapshot.clearStars)
  if (detail) detail.textContent = `+${formatInt(snapshot.clearCoins)} coins · ${formatInt(snapshot.coins)} total`
}

async function showDailyCard(root: HTMLElement, snapshot: Snapshot): Promise<void> {
  const preview = root.querySelector<HTMLImageElement>('#card-preview')
  if (!preview || preview.dataset.ready === '1') return
  const input = {
    score: snapshot.score,
    wave: Math.max(1, snapshot.wave),
    date: snapshot.dailyDate || todayKey(),
    url: window.location.origin,
  }
  const blob = await renderShareCard(input)
  preview.src = URL.createObjectURL(blob)
  preview.hidden = false
  preview.dataset.ready = '1'
  const share = root.querySelector<HTMLButtonElement>('#share')
  if (!share) return
  share.textContent = 'Share card'
  share.onclick = () => {
    void shareCard(blob, input).then((result) => {
      const note = root.querySelector('#share-note')
      if (note) note.textContent = result === 'shared' ? 'Shared.' : 'Card saved. Link copied.'
    })
  }
}

function setAuto(button: HTMLButtonElement | null, on: boolean, labeled: boolean): void {
  if (!button) return
  button.setAttribute('aria-pressed', on ? 'true' : 'false')
  button.classList.toggle('on', on)
  button.setAttribute('aria-label', on ? 'Auto-fire on' : 'Auto-fire off')
  if (!labeled) return
  const state = button.querySelector('.toggle-state')
  if (state) state.textContent = on ? 'On' : 'Off'
}

function setMute(button: HTMLButtonElement | null, muted: boolean, menu: boolean): void {
  if (!button) return
  if (menu) {
    const on = !muted
    button.setAttribute('aria-pressed', on ? 'true' : 'false')
    button.classList.toggle('on', on)
    button.setAttribute('aria-label', on ? 'Sound on' : 'Sound off')
    const state = button.querySelector('.toggle-state')
    if (state) state.textContent = on ? 'On' : 'Off'
    return
  }
  button.setAttribute('aria-pressed', muted ? 'true' : 'false')
  button.classList.toggle('on', muted)
  button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound')
}

function setHaptics(button: HTMLButtonElement, on: boolean): void {
  button.setAttribute('aria-pressed', on ? 'true' : 'false')
  button.classList.toggle('on', on)
  button.setAttribute('aria-label', on ? 'Haptics on' : 'Haptics off')
  const state = button.querySelector('.toggle-state')
  if (state) state.textContent = on ? 'On' : 'Off'
}

function fillUpgrades(root: HTMLElement, snapshot: Snapshot): void {
  const sub = root.querySelector('#upgrade-sub')
  if (sub) {
    const repair = snapshot.repair > 0 ? `Crews restore ${snapshot.repair} integrity. ` : 'Integrity is full. '
    const bonus = snapshot.cleanBonus > 0 ? `Clean sky +${formatInt(snapshot.cleanBonus)}. ` : ''
    sub.textContent = `${bonus}${repair}Wave ${snapshot.wave + 1} is next.`
  }
  const buttons = root.querySelectorAll<HTMLButtonElement>('#choices .choice')
  buttons.forEach((button) => {
    const id = button.dataset.id
    const kicker = button.querySelector('.choice-kicker')
    const stat = button.querySelector('.choice-stat')
    if (id === 'rate') {
      if (kicker) kicker.textContent = `Lv ${snapshot.rateLevel} → ${snapshot.rateLevel + 1}`
      if (stat) stat.textContent = `${snapshot.intervalMs} → ${snapshot.nextIntervalMs} ms`
    } else if (id === 'spread') {
      if (kicker) kicker.textContent = `Lv ${snapshot.spreadLevel} → ${snapshot.spreadLevel + 1}`
      if (stat) {
        stat.textContent =
          snapshot.nextPellets > snapshot.pellets
            ? `${snapshot.pellets} → ${snapshot.nextPellets} shells`
            : `Splash ${snapshot.splash} → ${snapshot.nextSplash}`
      }
    } else if (id === 'damage') {
      if (kicker) kicker.textContent = `Lv ${snapshot.damageLevel} → ${snapshot.damageLevel + 1}`
      if (stat) stat.textContent = `${snapshot.damage} → ${snapshot.nextDamage} damage`
    }
  })
}

function fillGameOver(root: HTMLElement, snapshot: Snapshot): void {
  const score = root.querySelector('#final-score')
  const detail = root.querySelector('#final-detail')
  const best = root.querySelector('#over-best')
  const badge = root.querySelector<HTMLElement>('#new-best')
  if (score) score.textContent = formatInt(snapshot.score)
  if (detail) {
    const wave = `Wave ${Math.max(1, snapshot.wave)} · ${formatInt(snapshot.kills)} intercepts`
    detail.textContent =
      snapshot.mode === 'daily'
        ? `${snapshot.dailyDate} · ${wave}`
        : snapshot.mode === 'campaign'
          ? `${snapshot.levelName} · ${wave}`
          : wave
  }
  if (best) best.textContent = formatInt(snapshot.best)
  if (badge) badge.hidden = !snapshot.newBest
}

async function shareScore(
  snapshot: Snapshot | null,
  note: HTMLElement | null,
  fallback: HTMLInputElement | null,
): Promise<void> {
  if (!snapshot) return
  const url = window.location.origin
  const text = `I scored ${formatInt(snapshot.score)} in ${GAME_TITLE} (wave ${Math.max(1, snapshot.wave)}).`
  const full = `${text} ${url}`
  if (note) note.textContent = ''
  if (fallback) fallback.hidden = true
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: GAME_TITLE, text, url })
      if (note) note.textContent = 'Shared.'
      return
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      if (name === 'AbortError') {
        if (note) note.textContent = 'Share cancelled.'
        return
      }
    }
  }
  try {
    await navigator.clipboard.writeText(full)
    if (note) note.textContent = 'Copied to clipboard.'
  } catch {
    if (fallback) {
      fallback.hidden = false
      fallback.value = full
      fallback.focus()
      fallback.select()
    }
    if (note) note.textContent = 'Select the line above and copy it.'
  }
}
