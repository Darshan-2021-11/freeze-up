# Freeze-Up — Game Jam Report

Glitch MILAN Game Jam '26 · Theme: **Time is Money**

## 1. Concept, core loop and intended experience

### Concept
Gold rush, Canada, 1898. The last steamboat home leaves Dawson before the Yukon River
freezes, and a ticket costs 270 gold. You start at your cabin with 10 gold and 28 hours.
You explore an open world, fight wolves, bandits and bears for gold, and trade time for
gold, or gold for time, to make the boat before the river freezes for good.

### Core gameplay loop
1. **Explore.** Walk anywhere on a top-down map: five fight locations and four towns,
   split by a river you cross on bridges. Gold in your bag slows you down.
2. **Choose a fight.** Each location shows its exact enemies, its bounty and a tip.
3. **Fight.** A top-down shooter: WASD to move, mouse to aim, one shot per click, Space
   to dash. A bounty clock pays in full only if you win quickly.
4. **Collect or recover.** Winning pays the bounty and unlocks a harder, better-paid
   tier. Losing costs gold; half of it can be won back at that place later.
5. **Trade.** Hold E to buy time with gold, or Q to work for gold. Prices rise as the
   river freezes.
6. **Prepare.** Train at the Shooting Range for skill levels, buy gear at the Trading
   Post, or practice for free at the cabin.
7. **Board the boat** at Dawson Dock with 270 gold before time runs out.

### Intended player experience
Freeze-Up is designed to be **played in one go**: a single run lasts about 6–8 minutes
and nothing is saved between sessions. When the river freezes or you board the boat, the
run ends, and the end screen offers the same map again or a new one.

Constant, readable pressure. Every action visibly costs time or gold, the clock never
stops (except when paused), and the player must keep weighing "Is this fight worth the
hours?", "Should I buy time now while it's cheap?" and "Can I still make the dock?".
Fights should feel fair (every attack is telegraphed) but demanding. A run takes about
6–8 minutes, so failing and retrying on the same map is quick and encouraged.

## 2. How the game uses the theme

The theme is built into every system, not just the goal:

- **An explicit exchange between time and money.** The player's core ability converts
  hours into gold (Q, working) and gold into hours (E, buying time). The rates are
  asymmetric (trading back always loses) and change over time: time costs 2 gold an hour
  at the start and 5 near the end, while work pays 1 to 2 gold an hour.
- **Trading is required, not optional.** The starting 28 hours are not enough to earn the
  ticket by fighting alone, so every winning run has to buy time at some point. The river
  freezes for good at hour 60, so bought time is capped as well.
- **The bounty clock.** Inside fights, the reward drops once you pass a par time: a faster
  win literally pays more.
- **Everything takes time.** Walking, shopping, training and fighting all run the clock.
  Carrying gold makes you walk slower, so your wealth costs you time.
- **Losses cost both.** Losing a fight costs gold plus the time of a rematch.

**Why the tradeoff is the theme.** Time and gold act as two currencies that constantly
turn into each other. Fights, work and long walks turn hours into gold; buying time turns
gold back into hours. Because the exchange rate is always unfair and gets worse as the
river freezes, every choice becomes a question of whether an hour is worth more as gold
or gold is worth more as time. Winning means managing both currencies at once, which is
exactly what "time is money" means.

The historical hook is Benjamin Franklin's "Remember that time is money" (1748), set in
the Klondike Gold Rush, where the yearly river freeze-up really did strand prospectors
in Dawson for the winter.

## 3. Key design decisions

1. **Open world instead of a node map.** The first prototype was a one-way branching map
   (like Slay the Spire). Playtesting found it dull: travel was just picking a line, and
   you could never go back. A free-roam world lets players plan routes, return to places,
   and makes walking time a real cost.
2. **Five unique locations with three tiers each, instead of respawning copies.** An
   earlier version had repeated camps with respawn timers, which made the timers
   pointless (just fight a different bear). Now each place is unique, each tier is harder
   and better paid, and each location teaches its own skill: wolves (dodging lunges),
   bandits (cover and dodging bullets), bears (baiting charges into rocks, leaving slam
   zones), the Frozen Lake (sliding on ice, breaking ice with dynamite) and the fort (all
   of it, plus a boss).
3. **Fair, telegraphed attacks.** Early fights let enemies deal damage just by touching
   you, which felt buggy. Now every attack has a warning (a "!" above bandits, a wolf
   crouch, a red circle for the bear's slam, a red glow before a charge), hits knock you
   back and give a second of safety, and enemies can't overlap you.
4. **Enemies that punish autopilot.** Wolves lunge at where you're heading, bandits aim
   ahead of you, and bears rage at half health, with charges that track your direction.
   Simply circling while shooting is no longer a guaranteed win.
5. **Anti-spam shooting.** One shot per click, a spread that widens with fast clicking
   (the crosshair grows), and a small bounty cut for accuracy under 50%. We rejected
   "every bullet costs gold" as too punishing.
6. **Losing is recoverable, but not exploitable.** Losing drops half the tier's bounty.
   Half of that is gone for good; the other half stays at the location and comes back
   when you win there. A first version returned 100%, which players could exploit by
   losing on purpose to park gold and walk faster.
7. **No dead ends.** Conquered places offer endless low-pay patrols (5 gold), and each
   loss slightly weakens that tier's enemies. The HUD shows how much gold is still
   winnable on the map, and warns when the ticket can't be reached by fighting alone.
8. **One last-hour warning.** At 1 hour left, the clock stops and a popup offers to buy
   time. Earlier versions warned at 8 and 3 hours as well, but players then relied on
   the popups instead of watching the clock themselves.
9. **Optional training.** Forced training after every loss felt like a chore, so the
   Shooting Range is optional: pay gold and time, pass a target drill, and gain a skill
   level (critical hit chance, faster shots and reloads). It trades time and gold now
   for faster fights later.
10. **Map codes and difficulty.** Every world is built from a shareable code (for example
    `wolf-4821`), so friends can compare runs on the same map. Difficulty only changes
    enemies and time (Easy / Normal / Hard), never the layout.
11. **Balancing with simulations.** We wrote bots that play like humans (slow reactions,
    shaky aim, a limited click rate) to test every fight tier and whole runs. They
    confirmed that no map is unwinnable, that training helps, and that never trading
    rarely wins (about 16% on Normal, versus about 70% for a strong player who trades).

## 4. Cut, simplified or unfinished ideas

- **The branching node-map version.** It had transport choices (walk, horse, dog sled,
  canoe), a bank, a loan shark and a card game. We replaced it with the open world; it is
  kept in `archive/graph-version/`.
- **"Thinking costs time" hesitation clock** (from the node-map version): dropped
  because the open world already runs a real-time clock.
- **A stock-ticker exchange rate** that moved randomly: replaced by predictable rising
  prices, which are easier to plan around.
- **Rent-deadline framing** (an early concept): dropped after research showed several
  existing itch.io games with the same setup.
- **Mandatory training after a loss:** changed to optional training at the Shooting Range.
- **Gold per bullet:** rejected as too punishing.
- **Wolf pack tactics** (surrounding the player, lunging together) and a **tracking bear
  charge at all times:** simplified to wolves leading their lunges and bears aiming ahead
  only while enraged.
- **A dummy fight at the cabin:** simplified to a free practice fight against real
  enemies.
- **Hand-drawn art:** time did not allow it. We used credited icon sets instead. The
  river, snow, health bars and bullets are simple shapes drawn in code.
- **No music track;** sound effects only.

## 5. Team contributions

Solo entry: **Darshan** (the only team member): game designer, system designer,
playtester and producer.

**System architecture: how the game works as a whole**
Designed the structure of the game's systems and how they connect:
- **The core economy:** time and gold as two currencies that convert into each other,
  with asymmetric trade rates, and the rule that winning is impossible without
  converting one into the other.
- **The world structure:** an open 2D world instead of a one-way node map, with unique
  locations that each hold their own fights, and every action (walking, fighting,
  shopping, training) running on the same clock.
- **The fight loop and its consequences:** fights can't be skipped; losing costs gold,
  and half of it can be recovered at that place (designed specifically so it can't be
  exploited to park gold); tiers replace respawn timers; patrols make sure the map never
  runs dry.
- **The progression:** optional training that trades time and gold now for faster
  fights later, difficulty levels, and a minimum bounty so fights always pay something.
- **The pressure design:** a single last-hour warning that stops the clock, so players
  have to watch the timer themselves.
- **The combat feel:** telegraphed enemy attacks, one shot per click with spread that
  widens when spamming, and specific behaviors for each enemy (wolves leading their
  lunges, bears slamming the ground and raging).

**Playtesting and iteration**
- Played every build and found the issues that drove each revision: buggy contact
  damage, a broken "Walk away" button, unbalanced maps, a gold dead end, a
  gold-parking exploit, shot-spamming, enemies that weren't threatening, missing
  warnings, and a freeze when time ran out mid-fight.
- Decided how each one was fixed, and rejected options that didn't fit the vision,
  such as charging gold per bullet or keeping repeated buildings.

**Production**
- Implementation was done with an AI coding assistant (Claude Code; see section 6),
  following this design. Every change was specified, reviewed and playtested.
- Chose the final scope, prepared the itch.io page and this report, and submitted the
  game.

## 6. Resources and references

### Assets (all third-party, credited; details in `CREDITS.md`)
- **Icons:** game-icons.net (CC BY 3.0) by Lorc, Delapouite, Skoll and Cathelineau.
  https://game-icons.net, https://github.com/game-icons/icons
- **Sound effects:** Kenney "RPG Audio", "Impact Sounds" and "Interface Sounds" (CC0),
  https://kenney.nl; "Gunshots" by kurt on OpenGameArt (CC0),
  https://opengameart.org/content/gunshots
- **Font:** Rye by Sorkin Type Co (SIL Open Font License), Google Fonts.

No AI-generated graphics, music or sound effects were used.

### Tools and technology
- Plain HTML5 Canvas and JavaScript (no engine), so the game runs in any browser.
- Python (icon bundling script), Node.js (balance simulators in `tools/`), ffmpeg
  (sound conversion), git.
- Claude Code (AI coding assistant) was used for programming help, balance-simulation
  tools and drafting documentation. All game design decisions were directed and
  playtested by the team.

### References and research
- Benjamin Franklin, *Advice to a Young Tradesman* (1748), the source of "Remember that
  time is money".
- The Klondike Gold Rush (1896–1899) and the yearly freeze-up of the Yukon River at
  Dawson City.
- Josiah Warren's Cincinnati Time Store (1827–1830), an early time-based currency
  (background research).
- Mark Brown / Game Maker's Toolkit, "My Favourite Games From GMTK Game Jam 2026" and
  earlier jam round-ups, used to study how jam games interpret a theme.
- inkle's *80 Days* (2014), a reference for trading travel time against money.
- Existing itch.io "time is money" and rent-deadline games, reviewed so we would avoid
  common interpretations.
- Algorithms: the mulberry32 random number generator and FNV-1a hashing, used to turn
  map codes into worlds.
