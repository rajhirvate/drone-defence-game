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
- **Threats:** drones weave, missiles fly straight or on an arc (a red chevron warns you), and swarms split into shards when they break.
- **City:** the integrity bar is the skyline. Leaks damage it. A few hits are survivable; a missile hurts more than a drone.
- **Combo:** quick consecutive kills raise a multiplier, up to x8. A hit on the city breaks the chain.
- **Waves:** count, speed, and mix ramp up. After each clear you pick one upgrade — Rapid Cycle (fire rate), Flak Burst (extra shells and splash), or Heavy Rounds (damage). Upgrades stack for the rest of the run. A clean wave (no city damage) pays a bonus, and crews patch a little integrity.
- **Mute:** the button or `M`. Saved in `localStorage`.
- **Best score:** stored locally and shown on the title screen and the game over screen.
- **Share:** on game over, the Web Share API sends your score and `window.location.origin`. If sharing is unavailable, the score line is copied to the clipboard.

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
