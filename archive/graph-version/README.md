# Freeze-Up

A game for the Glitch MILAN Game Jam '26 (theme: **Time is Money**).

Gold rush, Canada, 1898. The last boat home leaves Dawson before the river freezes.
Cross the map with 30 gold before time runs out. Every choice trades time for gold
or gold for time: dig or work to earn gold, pay for a horse, dog sled or canoe to
travel faster, and fight off wolves, bandits and bears on the trail.

## Play

Open `index.html` in a browser. No install and no server needed.

For itch.io: zip the whole folder (with `index.html` at the top level) and upload it
as an HTML game.

## Controls

- Click a lit stop (or press 1–4), then pick how to travel.
- Space: do the first action at the current stop.
- In fights: click enemies, R to reload, 1–4 to change weapon.
- P or Esc: pause. M: mute.

## Map codes

Every map comes from a map code, such as `wolf-4821`. Type a code on the title
screen, or open `index.html?code=wolf-4821`. The same code always gives the same map.

## Fair maps

Each map uses a fixed mix of stop types, so no map is flooded with gold mines.
Then `src/solver.js` checks every route with typical luck. A map is only used if
its best route leaves 8–18 spare hours (`MIN_SPARE_HOURS` and `MAX_SPARE_HOURS`
in `src/config.js`). Otherwise the game builds another map from the same code.
So every map code can be won, and none is trivial.

Check fairness with `node tools/sim.js perseed 200 20`: it plays 200 maps 20
times each and shows how many maps a simple bot wins how often.

## Project layout

- `src/config.js`: all balance numbers (time, prices, transport, weapons, enemies).
- `src/map.js`: builds the map from the code.
- `src/game.js`: rules for stops, travel, debts, winning and losing.
- `src/combat.js`: trail fights.
- `src/solver.js`: checks that a map can be won.
- `src/render.js`: canvas drawing. `src/ui.js`: HUD, popups, tutorial.
- `src/main.js`: input and the frame loop.
- `src/icons.js`: generated from `assets/icons` by `python3 tools/build_icons.py`.
- `tools/sim.js`: balance check. `node tools/sim.js 2000` plays 2000 runs with bots.

## Dev shortcuts

- `?play=1` skips the title and tutorial.
- `?play=1&demo=choose` opens the travel popup.
- `?play=1&demo=fight&foe=bear&warp=3` starts a fight and skips 3 seconds.

## Credits

See `CREDITS.md`.
