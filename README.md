# Senja Air

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Jawwxz/senja-air/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Jawwxz/senja-air/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Senja Air is a dusk flight game: fly a little cream-and-teal prop plane between three Indonesian islands as the light fades, thread glowing rings, mind the fuel, and set down on the next island's strip before the time runs out.

Three sorties, each with its own rings, wind and light:

- **Senja Pertama** — Senja to Pulau Api at dusk. Five rings over the strait, then land on the volcano island's strip.
- **Lintasi Badai** — Api to Pulau Padi through a squall. Six rings, a crosswind, and a terraced island to find.
- **Pulang Malam** — Padi to Senja at night. Four rings by their own light, and home by the runway edge lights alone.

## Controls

| Key | Action |
| --- | --- |
| ↑ / ↓ | Pitch up / down |
| ← / → | Bank left / right (banking turns the plane) |
| W / S | Throttle up / down |
| Space | Airbrake |
| Mouse | Steer (move to bank toward the cursor) |
| C | Chase / cockpit camera |
| M | Mute |
| P | Pause |
| R | Restart the sortie |

Take off by opening the throttle and pulling up once you are fast enough. Thread a ring to score 250 points and top the tank up by 10 fuel. Land gently on the destination strip — wings near level, slow, and on the flat grass beside the paint if you are a little wide — to bank the landing bonus plus time and fuel bonuses.

## HUD

Altitude, speed and vertical speed, a compass tape with heading, the artificial horizon, throttle / fuel / hull bars, and the mission panel with rings, score and time left.

## Run it

A complete offline browser game — no network requests, no build step. Open `game/index.html` in desktop Chrome, or serve the folder:

```sh
node serve.ts
# then open http://localhost:8080
```

To hand it in, run `main.ts` (Node 22, standard library only):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`. Run it twice and the outputs are byte-for-byte identical.

## How it is built

- `game/index.html` — the page and the HUD.
- `game/src/config.js` — the world: islands, runways, missions, scoring.
- `game/src/terrain.js` — analytic island terrain (Gaussians), sea, runways with lights, villages, palms, terraces, the volcano.
- `game/src/sky.js` — the dusk gradient dome, sun, stars, drifting clouds.
- `game/src/plane.js` — the plane mesh and the arcade flight model.
- `game/src/rings.js` — the glowing rings.
- `game/src/missions.js` — mission flow, touchdown judging, scoring.
- `game/src/hud.js`, `game/src/input.js`, `game/src/audio.js` — the HUD, keyboard/mouse, and synthesized engine, wind and music (no audio files).
- `game/src/shots.js` — the deterministic screenshot setups.
- `game/vendor/three.module.min.js` — vendored three.js (0.160.0), the only library.

Everything is original: the islands, the plane, the art, the sounds and the music are all made for this game.

---

Entered on [make.fun](https://make.fun/?ref=xzsdsyqa&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
