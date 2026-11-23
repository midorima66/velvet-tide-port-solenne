# Velvet Tide: Port Solenne

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/midorima66/velvet-tide-port-solenne/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/midorima66/velvet-tide-port-solenne/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original top-down 2D open-world crime game that plays offline in a desktop browser from its own files. Explore the coastal city of Port Solenne on foot and by car: steal cars, dodge or fight the law, and work through a five-chapter story for the Tidewater Diner family.

**Play it:** open `game/index.html` in a desktop browser — no server, no network, no installs.

## The game

- A generated coastal city: downtown towers, suburbs, working docks, a beach, a park, and open water
- On foot and driving, with car theft, lane-keeping traffic, and pedestrians who stroll and flee
- A 1–5 star wanted system: police cruisers navigate the grid, flank, and ram; BUSTED and WASTED respawns cost cash
- Punch and pistol combat with mouse aim
- Five story chapters: a dock pickup, taxi fares, a hot-coupe delivery under ambush, debt collections, and a finale run to Gull Rock Lighthouse
- HUD with health, cash, wanted stars, weapon and ammo, clock and speed — plus a live minimap
- Title, pause, game-over and completion screens; save/continue in localStorage
- Fully synthesized WebAudio: engine, sirens, effects, and a generated music loop (M to mute)
- A day-night cycle: golden-hour start, lit windows, headlight cones, and the lighthouse beam

**Controls:** WASD / arrows — walk & drive · Shift — run · E — enter / exit car · Mouse — aim · Click / J — punch & shoot · P — pause · K — save · C — continue · M — sound

## Entry

Built for the make.fun bounty [Make GTA 6](https://make.fun/bounty/gta6-01). `main.ts` (Node 22) assembles the entry: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` via the vendored `vendor/makefun-game.ts`. All city, characters, vehicles, names, story, art, sound and music are original creations.

---

<sub>Entered on [make.fun](https://make.fun/?ref=niccolo&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
