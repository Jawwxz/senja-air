// Senja Air — a dusk flight game for best-flight-game-20261126-0057.
// Fly a little cream-and-teal prop plane between three Indonesian islands
// at dusk: thread glowing rings, mind the fuel, and set down on the next
// island's strip before the light (and the time) runs out. Three sorties —
// Senja to Api at dusk, Api to Padi through a squall, Padi to Senja at
// night — each with its own rings, wind and light. Keyboard and mouse,
// full HUD, synthesized engine and music, no network requests.
// Hands the game in: copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json with the vendored make.fun
// library. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in
// for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
