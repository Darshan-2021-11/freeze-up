# Freeze-Up

A game for the Glitch MILAN Game Jam '26 (theme: **Time is Money**).

Gold rush, Canada, 1898. The last boat home leaves Dawson before the river freezes,
and the ticket costs 270 gold. Walk anywhere in an open world, fight wolves,
bandits and bears for gold, and trade time for gold (or gold for time) with your
own hands. The clock never stops.

## Play

Open `index.html` in a browser. No install and no server needed.

For itch.io: zip everything except `archive/` and `tools/` (with `index.html` at
the top level) and upload it as an HTML game.

## How it works

- **Open world.** WASD or arrow keys. Cross the river on bridges. Gold in your bag
  slows you down.
- **Five unique places.** Wolf Den, Bandit Camp, Bear Cave, Frozen Lake (slippery
  ice) and Jumpers' Fort (ends with a boss). Each has three tiers: beat one to unlock
  a harder, better-paid one. The popup shows the exact enemies and a tip.
- **Bounty clock.** Each tier pays its full bounty if you win within a par time,
  then the bounty drops to its floor: half the bounty, but never under 15 gold.
  Time is money inside fights too.
- **Low-time warnings.** At 8 and 3 hours left, the clock stops and a popup shows
  the walk to the dock, the gold still needed and today's price of time, with
  quick buttons to buy 2, 5 or 10 hours.
- **No running away.** A started fight can't be left. If you lose, you lose half
  that tier's bounty. Half of that is gone for good; the other half stays at the place
  and comes back when you win there (so losing on purpose to park gold never pays).
  Then choose: rematch now, or walk away. Each loss weakens that tier a little
  (up to 3 losses), so nobody is stuck forever.
- **Gold left on the map.** The HUD shows how much gold is still winnable (open
  bounties plus gold waiting to be won back) and warns when the ticket is out of reach by fighting
  alone.
- **Fair hits.** Enemies warn before attacking ("!", crouch, raised paw, glow).
  Touching never hurts; hits knock you back and give 1 second of safety.
- **Training (optional).** The Shooting Range sells training for gold and 2 hours.
  Hit 8 of 12 targets to gain a skill level (max 5): more crit chance (double
  damage), faster shots and faster reloads. Each level costs more and the drill
  gets faster.
- **Fights.** Top-down shooter: WASD move, mouse aim, click to shoot, Space to dash,
  R to reload, 1–3 to change weapon. Skill: aiming, dodging, using rocks.
  Luck: enemy mix, spawns, rocks, bullet spread, rewards.
- **Trade ability (required).** You start with 26 hours, which is not enough to win by
  fighting alone. Hold E to buy time with gold, hold Q to work for gold. Prices rise
  as the river freezes: time costs 2 gold an hour at the start and 5 at the end;
  work pays 1 gold an hour at the start and 2 at the end. Trading back always loses.
  The river freezes for good at hour 60, so bought time is limited too.
- **Towns.** Your Cabin (start), the Trading Post (shop), the Shooting Range and
  Dawson Dock (shop at 1.5x prices; buy the ticket here to win).

## Map codes

Every world comes from a map code, such as `wolf-4821`. Type a code on the title
screen, or open `index.html?code=wolf-4821`. The same code always gives the same world.

## Balance tools

- `node tools/fight-sim.js 200` — a human-like bot (slow reactions, shaky aim)
  fights every tier of every place 200 times. Shows win rate, fight length and bounty.
- `node tools/run-sim.js 150 '{}' 2 8 75` — a bot plays whole games. Arguments:
  config overrides (JSON), skill level it trains up to (0 = never), aim lag and aim
  shake (higher = weaker player), and `notrade` to forbid Q and E. Shows win rate,
  time left, hours traded and real minutes per run.

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
- `?play=1&demo=warn` shows the low-time warning.
- `?play=1&demo=drill` starts training. `?play=1&demo=range` opens a Shooting Range.

## Credits

See `CREDITS.md`.
