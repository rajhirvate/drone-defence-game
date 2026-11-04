# Drone Defence

A fictional close-in defence arcade game. You hold a city skyline against waves of drones, missiles, and splitting swarms. The skyline, the threats, and the battery are invented — no real places, flags, or conflicts.

Built with Phaser 3, Vite, and TypeScript as a static site. There is no backend, no analytics, and no runtime network calls.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints (it also listens on the network interface).

## Build

```bash
npm install
npm run build
npm run preview
```

`npm run build` typechecks, then writes a static site to `dist/`. Deploy that folder as-is. On Vercel, use the Vite preset (`npm run build`, output `dist`). No `vercel.json` is required: there is no client-side router and no server routes.

Asset URLs are relative (`base: './'`), so the same `dist/` folder works on a host root, a subpath, or inside a WebView.

## How to play

- **Aim:** move the mouse, or drag on a touch screen. The turret only fires into the sky.
- **Fire:** hold the pointer or the space bar. **Auto-fire** (button or `F`) keeps shooting while you steer. Phones start with auto-fire on; desktops start with hold-to-fire. The choice is saved.
- **Weapons:** `1` cannon, `2` laser, `3` homing missiles, `4` EMP. Laser, missiles, and EMP unlock by clearing campaign levels or by spending coins in the armoury.
- **Campaign:** 12 hand-tuned levels on the map. Clear with city health left for up to 3 stars. Levels 5 and 10 are bosses. Coins from kills buy weapon unlocks and permanent cannon ranks.
- **Endless:** the original survival mode. Between waves, pick Rapid Cycle, Flak Burst, or Heavy Rounds. Those picks last for the run and stack on top of armoury ranks.
- **Daily challenge:** one seeded run per local calendar day, so everyone faces the same waves that day. Game over builds a PNG share card (score, wave, date, name, `window.location.origin`) and tries the Web Share API with the file. Otherwise it downloads the PNG and copies the link.
- **Threats:** drones weave, missiles dive, swarms split. The carrier boss launches minis. The armour boss is a heavy missile.
- **City:** the integrity bar is the skyline. A first-run tutorial (about 20 seconds, skippable) points at aim, fire, and the bar.
- **Feel:** layered synthesized shots, a short hit-stop and slow motion on a level's last kill or a boss kill, screen flash, floating damage numbers. Phones can vibrate; the menu has a haptics toggle.
- **Mute:** the button or `M`. Progress, stars, coins, unlocks, daily bests, and settings live in a versioned `localStorage` save. An older endless best score is kept.

## Balancing

Levels, bosses, weapons, coin rewards, and shop prices are data:

- `src/campaign.ts` — the 12 levels
- `src/config.ts` — weapons, shop, coins, stars, boss stats, endless `BALANCE`

## Rename the game

The in-game title is the `GAME_TITLE` constant in `src/config.ts`. The document title, Open Graph tags, and web app manifest are generated from that same constant at dev and build time.

## Capacitor

The build is a static folder with relative asset paths and no server routes, which is what Capacitor expects for `webDir`.

```bash
npm run build
npm i @capacitor/core @capacitor/cli
npx cap init "Drone Defence" app.dronedefence.game --web-dir dist
npx cap add android
npx cap copy
```

Repeat `npm run build` and `npx cap copy` after web changes. The UI already pads `safe-area-inset` for notches, and the playfield rescales in portrait and landscape. Add Capacitor's status-bar or splash plugins in the native project if you want them; the web game does not depend on them.

## Audio, art, and licenses

Sound is synthesized in the browser with the Web Audio API. There are no audio files. Graphics are drawn in code (sky, skyline, turret, threats, tracers, explosions). Both are original to this project.

Phaser is MIT licensed. Vite and TypeScript use their own upstream licenses. This game does not ship third-party art or sample packs.

## Project map

- `src/config.ts` — title and wave / upgrade balance
- `src/waves.ts` — wave composition
- `src/scenes/PlayScene.ts` — the match
- `src/entities/enemy.ts` — threat movement
- `src/draw.ts` — procedural rendering
- `src/ui.ts` — title, HUD, upgrades, game over
- `src/audio.ts` — synthesized effects
