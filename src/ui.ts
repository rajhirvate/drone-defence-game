import { audio } from './audio'
import { emitCommand, onView } from './bridge'
import { GAME_TITLE, UPGRADES, type UpgradeId } from './config'
import { formatInt } from './math'
import type { Snapshot } from './types'

export function mountUi(root: HTMLElement): void {
  root.innerHTML = `
    <div id="hurt"></div>
    <div id="vignette"></div>
    <div id="hud" hidden>
      <div class="hud-top">
        <div class="stat">
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
        <button type="button" class="hud-btn" id="auto-btn" aria-pressed="false">Auto</button>
        <button type="button" class="hud-btn icon" id="mute-btn" aria-pressed="false" aria-label="Mute sound"></button>
      </div>
      <div class="hp-row">
        <span class="k">City</span>
        <div class="hp-track" aria-hidden="true"><div id="hp-fill"></div></div>
      </div>
      <div id="banner"></div>
    </div>
    <section class="overlay" id="menu">
      <div class="panel">
        <p class="eyebrow">Close-in battery</p>
        <h1 id="title"></h1>
        <p class="tag">Hold the skyline.</p>
        <ul class="howto">
          <li>Aim with the pointer. Hold to fire, or switch on auto-fire.</li>
          <li>Drones weave. Missiles dive. Swarms split.</li>
          <li>Clear a wave, then pick one upgrade. They stack.</li>
        </ul>
        <p class="keys">Space fires · F auto-fire · M mute</p>
        <p class="best-line">Best <strong id="menu-best">0</strong></p>
        <div class="stack">
          <button type="button" class="primary" id="play">Play</button>
          <button type="button" class="ghost" id="menu-auto" aria-pressed="false">Auto-fire off</button>
          <button type="button" class="ghost" id="menu-mute" aria-pressed="false">Sound on</button>
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
        <p class="note" id="share-note" aria-live="polite"></p>
        <input id="share-fallback" hidden readonly aria-label="Share text" />
      </div>
    </section>
  `

  const title = root.querySelector('#title')
  if (title) title.textContent = GAME_TITLE

  const choices = root.querySelector('#choices')
  if (choices) {
    for (const upgrade of UPGRADES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'choice'
      button.dataset.id = upgrade.id
      button.innerHTML = `
        <span class="choice-kicker"></span>
        <span class="choice-name">${upgrade.name}</span>
        <span class="choice-blurb">${upgrade.blurb}</span>
        <span class="choice-stat"></span>
      `
      button.addEventListener('click', () => {
        audio.unlock()
        emitCommand({ type: 'upgrade', id: upgrade.id as UpgradeId })
      })
      choices.appendChild(button)
    }
  }

  const play = root.querySelector<HTMLButtonElement>('#play')
  const restart = root.querySelector<HTMLButtonElement>('#restart')
  const share = root.querySelector<HTMLButtonElement>('#share')
  const menuAuto = root.querySelector<HTMLButtonElement>('#menu-auto')
  const menuMute = root.querySelector<HTMLButtonElement>('#menu-mute')
  const autoBtn = root.querySelector<HTMLButtonElement>('#auto-btn')
  const muteBtn = root.querySelector<HTMLButtonElement>('#mute-btn')
  const note = root.querySelector<HTMLElement>('#share-note')
  const fallback = root.querySelector<HTMLInputElement>('#share-fallback')

  play?.addEventListener('click', () => {
    audio.unlock()
    emitCommand({ type: 'start' })
  })
  restart?.addEventListener('click', () => {
    audio.unlock()
    emitCommand({ type: 'restart' })
  })
  share?.addEventListener('click', () => {
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

  muteBtn?.insertAdjacentHTML(
    'beforeend',
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
  )

  let latest: Snapshot | null = null
  let phase: Snapshot['phase'] | null = null
  const menu = root.querySelector<HTMLElement>('#menu')
  const upgrade = root.querySelector<HTMLElement>('#upgrade')
  const over = root.querySelector<HTMLElement>('#over')
  const hud = root.querySelector<HTMLElement>('#hud')
  const scoreEl = root.querySelector<HTMLElement>('#score')
  const waveEl = root.querySelector<HTMLElement>('#wave')
  const comboEl = root.querySelector<HTMLElement>('#combo')
  const hpFill = root.querySelector<HTMLElement>('#hp-fill')
  const banner = root.querySelector<HTMLElement>('#banner')
  const bestFlag = root.querySelector<HTMLElement>('#best-flag')
  const hurt = root.querySelector<HTMLElement>('#hurt')
  const vignette = root.querySelector<HTMLElement>('#vignette')

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
  }

  onView((snapshot) => {
    latest = snapshot
    if (snapshot.phase !== phase) {
      phase = snapshot.phase
      if (menu) menu.hidden = snapshot.phase !== 'menu'
      if (upgrade) upgrade.hidden = snapshot.phase !== 'upgrade'
      if (over) over.hidden = snapshot.phase !== 'gameover'
      if (hud) hud.hidden = snapshot.phase === 'menu'
      document.body.classList.toggle('is-playing', snapshot.phase === 'playing')
      if (snapshot.phase === 'menu') play?.focus()
      if (snapshot.phase === 'upgrade') {
        fillUpgrades(root, snapshot)
        root.querySelector<HTMLButtonElement>('.choice')?.focus()
      }
      if (snapshot.phase === 'gameover') {
        fillGameOver(root, snapshot)
        if (note) note.textContent = ''
        if (fallback) fallback.hidden = true
        restart?.focus()
      }
    } else if (snapshot.phase === 'upgrade') {
      fillUpgrades(root, snapshot)
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
    }
  })
}

function setAuto(button: HTMLButtonElement | null, on: boolean, long: boolean): void {
  if (!button) return
  button.setAttribute('aria-pressed', on ? 'true' : 'false')
  button.classList.toggle('on', on)
  button.textContent = long ? (on ? 'Auto-fire on' : 'Auto-fire off') : 'Auto'
}

function setMute(button: HTMLButtonElement | null, muted: boolean, long: boolean): void {
  if (!button) return
  button.setAttribute('aria-pressed', muted ? 'true' : 'false')
  button.classList.toggle('on', muted)
  if (long) button.textContent = muted ? 'Sound off' : 'Sound on'
  else button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound')
}

function fillUpgrades(root: HTMLElement, snapshot: Snapshot): void {
  const sub = root.querySelector('#upgrade-sub')
  if (sub) {
    const repair =
      snapshot.repair > 0 ? `Crews restore ${snapshot.repair} integrity. ` : 'Integrity is full. '
    const bonus = snapshot.cleanBonus > 0 ? `Clean sky +${formatInt(snapshot.cleanBonus)}. ` : ''
    sub.textContent = `${bonus}${repair}Wave ${snapshot.wave + 1} is next.`
  }
  const buttons = root.querySelectorAll<HTMLButtonElement>('.choice')
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
    detail.textContent = `Wave ${Math.max(1, snapshot.wave)} · ${formatInt(snapshot.kills)} intercepts`
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
