# Freeze-Up

A game for the Glitch MILAN Game Jam '26 (theme: **Time is Money**).

Gold rush, Canada, 1898. The last boat home leaves Dawson before the river freezes,
and the ticket costs 170 gold. Walk anywhere in an open world, fight wolves,
bandits and bears for gold, and trade time for gold (or gold for time) with your
own hands. The clock never stops.

## Play

Open `index.html` in a browser. No install and no server needed.

For itch.io: zip everything except `archive/` and `tools/` (with `index.html` at
the top level) and upload it as an HTML game.

## How it works

- **Open world.** WASD or arrow keys. Cross the river on bridges. Gold in your bag
  slows you down.
- **Places.** Each place (Wolf Den, Bandit Camp, Bear Cave, Jumpers' Fort) has
  a fight and a gold reward. More stars mean harder fights and more gold. A cleared
  place fills up again after 10 hours and pays 40% less each time.
- **No running away.** A started fight can't be left. If you lose, you drop 25% of
  your gold, then choose: rematch now, or walk away and come back later. Each loss
  weakens that place a little, so nobody is stuck forever.
- **Fixed enemies.** Each place's enemies are set when the world is made and shown
  exactly in its popup. Packs enter together from the right edge.
- **Training (optional).** Two Shooting Ranges sell training for gold and 2 hours.
  Hit 8 of 12 targets to gain a skill level (max 5): more crit chance (double
  damage), faster shots and faster reloads. Each level costs more and the drill
  gets faster. Trained players clear places sooner and lose less.
- **Fights.** Top-down shooter: WASD move, mouse aim, click to shoot, Space to dash,
  R to reload, 1–3 to change weapon. Skill: aiming, dodging, using rocks.
  Luck: enemy mix, spawns, rocks, bullet spread, rewards.
- **Trade ability.** Hold Q: 1 hour becomes 1 gold. Hold E: 4 gold becomes 1 hour.
  Trading back always loses.
- **Shops.** Your Cabin, the Trading Post and Dawson Dock sell shells, dynamite,
  a shotgun and extra hearts. Buy the ticket at Dawson Dock to win.

## Map codes

Every world comes from a map code, such as `wolf-4821`. Type a code on the title
screen, or open `index.html?code=wolf-4821`. The same code always gives the same world.

## Balance tools

- `node tools/fight-sim.js 200` — a human-like bot (slow reactions, shaky aim)
  fights each place 200 times. Shows win rates, including rematches.
- `node tools/run-sim.js 150 '{}' 2` — a bot plays whole games, training up to skill
  level 2 (last number; 0 = never trains). Shows win rate, time left and real
  minutes per run. The JSON overrides config values, for example '{"START_HOURS":50}'.

All balance numbers are in `src/config.js`.

## Project layout

- `src/config.js`: balance numbers, places, enemies, weapons, shop items.
- `src/world.js`: builds the world from the map code; walking and collisions.
- `src/arena.js`: fights and training.
- `src/game.js`: clock, trade ability, rewards, losses, shops, winning.
- `src/render.js`: canvas drawing. `src/ui.js`: HUD, popups, tutorial.
- `src/main.js`: input and the frame loop.
- `src/icons.js`: generated from `assets/icons` by `python3 tools/build_icons.py`.
- `archive/graph-version/`: the earlier node-map version of the game.

## Dev shortcuts

- `?play=1` skips the title and tutorial.
- `?play=1&demo=place` opens a place popup.
- `?play=1&demo=fight&place=cave&warp=3` starts a fight and skips 3 seconds.
- `?play=1&demo=drill` starts training. `?play=1&demo=range` opens a Shooting Range.

## Credits

See `CREDITS.md`.
