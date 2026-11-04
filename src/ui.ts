import { audio } from './audio'
import { emitCommand, onView } from './bridge'
import { LEVELS } from './campaign'
import { GAME_TITLE, SHOP, UPGRADES, rankCost, type UpgradeId, type WeaponId } from './config'
import { todayKey } from './daily'
import { formatInt } from './math'
import { renderShareCard, shareCard } from './sharecard'
import { loadSave } from './storage'
import type { Snapshot } from './types'

export function mountUi(root: HTMLElement): void {
  root.innerHTML = `
    <div id="hurt"></div>
    <div id="flash"></div>
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
        <div class="stat" id="coin-stat"><span class="k">Coins</span><span class="v" id="coins">0</span></div>
        <button type="button" class="hud-btn" id="auto-btn" aria-pressed="false">Auto</button>
        <button type="button" class="hud-btn icon" id="mute-btn" aria-pressed="false" aria-label="Mute sound"></button>
      </div>
      <div class="hp-row">
        <span class="k">City</span>
        <div class="hp-track" aria-hidden="true"><div id="hp-fill"></div></div>
      </div>
      <div class="weapon-row" id="weapons"></div>
      <div id="banner"></div>
      <div id="tutorial" hidden>
        <p id="tutorial-text"></p>
        <button type="button" id="skip-tutorial">Skip</button>
      </div>
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
        <p class="best-line">Endless best <strong id="menu-best">0</strong></p>
        <p class="best-line">Daily <strong id="menu-daily">—</strong></p>
        <div class="stack">
          <button type="button" class="primary" id="campaign">Campaign</button>
          <button type="button" class="ghost" id="endless">Endless</button>
          <button type="button" class="ghost" id="daily">Daily challenge</button>
          <button type="button" class="ghost" id="armoury">Armoury</button>
          <button type="button" class="ghost" id="menu-auto" aria-pressed="false">Auto-fire off</button>
          <button type="button" class="ghost" id="menu-mute" aria-pressed="false">Sound on</button>
          <button type="button" class="ghost" id="menu-haptics" aria-pressed="true">Haptics on</button>
        </div>
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

  const restart = root.querySelector<HTMLButtonElement>('#restart')
  const share = root.querySelector<HTMLButtonElement>('#share')
  const menuAuto = root.querySelector<HTMLButtonElement>('#menu-auto')
  const menuMute = root.querySelector<HTMLButtonElement>('#menu-mute')
  const autoBtn = root.querySelector<HTMLButtonElement>('#auto-btn')
  const muteBtn = root.querySelector<HTMLButtonElement>('#mute-btn')
  const note = root.querySelector<HTMLElement>('#share-note')
  const fallback = root.querySelector<HTMLInputElement>('#share-fallback')

  let shopReturn: 'menu' | 'map' = 'menu'
  const play = root.querySelector<HTMLButtonElement>('#endless')
  root.querySelector('#campaign')?.addEventListener('click', () => {
    audio.unlock()
    emitCommand({ type: 'open-map' })
  })
  play?.addEventListener('click', () => {
    audio.unlock()
    emitCommand({ type: 'start-endless' })
  })
  root.querySelector('#daily')?.addEventListener('click', () => {
    audio.unlock()
    emitCommand({ type: 'start-daily' })
  })
  root.querySelector('#armoury')?.addEventListener('click', () => {
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
  root.querySelector('#menu-haptics')?.addEventListener('click', () => emitCommand({ type: 'toggle-haptics' }))
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

  muteBtn?.insertAdjacentHTML(
    'beforeend',
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
  )

  let latest: Snapshot | null = null
  let phase: Snapshot['phase'] | null = null
  const menu = root.querySelector<HTMLElement>('#menu')
  const map = root.querySelector<HTMLElement>('#map')
  const shop = root.querySelector<HTMLElement>('#shop')
  const clear = root.querySelector<HTMLElement>('#clear')
  const upgrade = root.querySelector<HTMLElement>('#upgrade')
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
      if (map) map.hidden = snapshot.phase !== 'map'
      if (shop) shop.hidden = snapshot.phase !== 'armoury'
      if (clear) clear.hidden = snapshot.phase !== 'clear'
      if (upgrade) upgrade.hidden = snapshot.phase !== 'upgrade'
      if (over) over.hidden = snapshot.phase !== 'gameover'
      const showHud = snapshot.phase === 'playing' || snapshot.phase === 'upgrade' || snapshot.phase === 'clear' || snapshot.phase === 'gameover'
      if (hud) hud.hidden = !showHud
      document.body.classList.toggle('is-playing', snapshot.phase === 'playing')
      if (snapshot.phase === 'map') fillMap(root)
      if (snapshot.phase === 'armoury') fillShop(root)
      if (snapshot.phase === 'clear') fillClear(root, snapshot)
      if (snapshot.phase === 'gameover' && snapshot.mode === 'daily') void showDailyCard(root, snapshot)
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
    const dailyLine = root.querySelector('#menu-daily')
    if (dailyLine && snapshot.phase === 'menu') {
      const save = loadSave()
      const date = todayKey()
      const best = save.dailyBest[date]
      dailyLine.textContent = best ? `${date} best ${formatInt(best)}` : date
    }
    const coinsEl = root.querySelector('#coins')
    if (coinsEl) coinsEl.textContent = formatInt(snapshot.coins)
    if (tutorial) {
      tutorial.hidden = snapshot.tutorial.length === 0 || snapshot.phase !== 'playing'
      const text = root.querySelector('#tutorial-text')
      if (text) text.textContent = snapshot.tutorial
    }
    const haptics = root.querySelector<HTMLButtonElement>('#menu-haptics')
    if (haptics) {
      const on = loadSave().haptics
      haptics.textContent = on ? 'Haptics on' : 'Haptics off'
      haptics.classList.toggle('on', on)
      haptics.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
    if (snapshot.phase === 'armoury') {
      const shopKey = `${snapshot.coins}:${snapshot.weapon}:${snapshot.ownedLaser}:${snapshot.ownedMissile}:${snapshot.ownedEmp}`
      if (shopKey !== root.dataset.shop) {
        root.dataset.shop = shopKey
        fillShop(root)
      }
    }
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
    } else if (event.key === '1') emitCommand({ type: 'equip', id: 'cannon' })
    else if (event.key === '2') emitCommand({ type: 'equip', id: 'laser' })
    else if (event.key === '3') emitCommand({ type: 'equip', id: 'missile' })
    else if (event.key === '4') emitCommand({ type: 'equip', id: 'emp' })
  })
}

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
    button.textContent = item.label
    button.addEventListener('click', () => {
      audio.unlock()
      emitCommand({ type: 'equip', id: item.id })
    })
    row.appendChild(button)
  }
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
    if (id === 'emp') {
      button.textContent = snapshot.empCd > 0.15 ? `EMP ${snapshot.empCd.toFixed(1)}` : 'EMP'
    }
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
    const stars = save.stars[level.id] ?? 0
    button.disabled = locked
    button.innerHTML = `<span class="k">${level.id}</span><strong>${level.name}</strong><span>${locked ? 'Locked' : '★★★'.slice(0, stars) + '☆☆☆'.slice(stars)}</span>`
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
  const list: { id: 'laser' | 'missile' | 'emp'; name: string }[] = [
    { id: 'laser', name: 'Laser' },
    { id: 'missile', name: 'Missile battery' },
    { id: 'emp', name: 'EMP' },
  ]
  for (const item of list) {
    const owned = save.owned[item.id]
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'choice'
    const cost = SHOP.unlock[item.id]
    button.innerHTML = `<span class="choice-name">${item.name}</span><span class="choice-stat">${owned ? (save.equipped === item.id ? 'Equipped' : 'Equip') : `${cost} coins`}</span>`
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
    button.innerHTML = `<span class="choice-name">${names[id]}</span><span class="choice-stat">${rank >= SHOP.maxRank ? 'Max' : `Lv ${rank} · ${rankCost(rank)} coins`}</span>`
    button.addEventListener('click', () => {
      audio.unlock()
      emitCommand({ type: 'buy-rank', id })
    })
    ranks.appendChild(button)
  }
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
    const wave = `Wave ${Math.max(1, snapshot.wave)} · ${formatInt(snapshot.kills)} intercepts`
    detail.textContent = snapshot.mode === 'daily' ? `${snapshot.dailyDate} · ${wave}` : snapshot.mode === 'campaign' ? `${snapshot.levelName} · ${wave}` : wave
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
