# Velvet Tide: Port Solenne — build notes

An original open-world crime game for the make.fun bounty gta6-01 ("Make GTA 6").
Everything — city, people, vehicles, story, art, sound — is invented for this entry;
nothing comes from any commercial game.

## The game

Marlo Reyes, a wheelman who swore he was done, returns to the coastal city of
Port Solenne and takes five errands ("chapters") from his Auntie Vi of the Tidewater
Diner: a crate from the South Docks, three taxi fares, a hot coupe to the chop shop,
three debt collections, and a final drive to Gull Rock Lighthouse. Between chapters
the city is free to roam: steal cars, outrun the Solenne PD, brawl and shoot, heal at
Solenne General, buy a pistol at Harbor Arms, and save the run to the browser.

## Architecture (game/src/, one job per file)

- `config.js` — every tuning number, the street grid, the palette, save key.
- `random.js` — mulberry32 seeded RNG; a seed rebuilds the same city and shots.
- `city.js` — generates Port Solenne: street grid, districts (downtown, suburbs,
  docks, beach, park), buildings (the collision solids), props, named places,
  lane maths, circle-vs-rectangle collision resolution.
- `world.js` — the living state: player, cars, pedestrians, particles, pickups;
  shared car physics (`integrateCar`), car-car collisions, wanted heat, police
  spawning, the busted/wasted verdicts, pickups and car entry/exit.
- `ai.js` — traffic that keeps lanes and turns at intersections, police that pick
  the exit closing on the player and ram at close range, pedestrians who stroll
  the pavements and flee danger.
- `combat.js` — the punch, the pistol, bullets, crowd panic and crime heat.
- `missions.js` — the five-chapter story: dialogue, objectives, markers, fares,
  collections, the hot-car and finale heat, rewards, save/resume of the story.
- `audio.js` — WebAudio-synthesized engine, sirens, a bass/pad music loop and all
  one-shot effects. No audio files exist.
- `input.js` — keyboard/mouse as a sampled state; latched one-shot actions.
- `render.js` — chase camera, city painting with a day-night sunset cycle, lit
  windows, headlight cones, HUD (health, cash, wanted stars, weapon, clock),
  circular story banner, dialogue box, minimap, and the title/pause/over/complete
  screens.
- `shots.js` — the four staged screenshot scenes (`?shot=start|foot|chase|mission`),
  each a real seeded moment played forward with scripted hands.
- `main.js` — boot, the fixed-step loop, screens, busted/wasted respawns, saving.

Root files: `main.ts` hands the game in (copies `game/` + `screenshots/` to the
output and writes `dossier.json` via the kit's `vendor/makefun-game.ts`, copied
unchanged); `serve.ts` is a local static server for playing and screenshotting;
`shots.json` lists the four screenshot scenes.

## Controls

WASD/arrows walk and drive · Shift run · E enter/exit car · mouse aim ·
click or J punch/shoot · P pause · M mute · K save · C continue (title screen).

## Testing

- Node import check of every module (no syntax/reference errors).
- A headless Node simulation driving the real step functions: chapter 1 starts at
  the diner, car theft raises heat and spawns police, a 20 s drive, punch and
  pistol fire, and a 3-minute AI traffic soak — all stable.
- Headless Chromium: the game page loads over the local server with no console
  errors, in normal play and in every `?shot=` scene; screenshots are captured
  from those scenes and eyeballed (see below).

## Screenshots (screenshots/, real renders via headless Chromium)

1. `1-chase.jpg` — cover: a four-star chase on the downtown avenue, police
  cruisers behind Marlo's coupe, HUD, minimap and mission objective all live.
2. `2-downtown.jpg` — on foot outside the Tidewater Diner as chapter one begins:
  Vi's dialogue, traffic, pedestrians, the gold marker toward the docks.
3. `3-docks.jpg` — dusk at Berth 9: the crate loaded, containers and warehouses,
  the drive home ahead.
4. `4-title.jpg` — the title screen over a sunset pan of the city.

Method: `node serve.ts --port 8901`, then headless Chromium at 1280x720 opens
`?shot=<scene>&seed=7`; the page stages the scene, paints, sets
`window.__shotReady`; the PNG is converted to a quality-85 JPEG under 256 KiB.
