// Balance check: plays many runs with simple bots and prints win rates.
// Usage: node tools/sim.js [runs] ['{"CONFIG_KEY": value}']
require("../src/config.js");
require("../src/rng.js");
require("../src/map.js");
require("../src/solver.js");
require("../src/game.js");
require("../src/combat.js");

const FU = globalThis.FU;
const C = FU.CONFIG;
const runs = Number(process.argv[2]) || 2000;
if (process.argv[2] !== "perseed") Object.assign(C, JSON.parse(process.argv[3] || "{}"));

// A player who clicks the closest enemy every `reaction` seconds.
function playFight(s, fight, reaction) {
  const c = FU.Combat.create(s, fight);
  const dt = 1 / 30;
  let wait = reaction;
  while (!c.done) {
    FU.Combat.update(c, s, dt);
    wait -= dt;
    if (wait <= 0 && c.enemies.length) {
      wait = reaction;
      const w = FU.WEAPONS[c.weapon];
      if (w.mag && c.mag[c.weapon] === 0) FU.Combat.reload(c, s);
      const target = c.enemies.reduce((a, b) => (b.x < a.x ? b : a));
      FU.Combat.click(c, s, target.x, target.y);
    }
    if (c.time > 120) break;
  }
  return c;
}

function hoursNeeded(s) {
  return (C.LAYERS + 1 - FU.node(s).layer) * 5 * (1 + s.gold / C.WEIGHT_K);
}

function pickTrip(s, toId, rng, careful) {
  const opts = FU.tripOptions(s, toId).filter((o) => o.ok);
  if (!careful) return rng.pick(opts);
  // Treat 1 gold as worth about 1.2 hours, and danger as a few hours.
  return opts.reduce((a, b) => (b.hours + b.price * 1.2 + b.danger * 4 < a.hours + a.price * 1.2 + a.danger * 4 ? b : a));
}

const bots = {
  random(s, rng) {
    const acts = FU.actions(s).filter((a) => a.enabled);
    if (acts.length && rng.chance(0.6)) FU.doAction(s, rng.pick(acts).id);
    if (s.status !== "playing") return;
    const to = rng.pick(FU.node(s).out).to;
    return { to, opt: pickTrip(s, to, rng, false), reaction: 0.5 };
  },

  greedy(s, rng) {
    const n = FU.node(s);
    const short = C.TARGET_GOLD - (s.gold + s.banked);
    const spare = s.hours - hoursNeeded(s);
    for (const a of FU.actions(s).filter((x) => x.enabled)) {
      if ((a.id === "dig" || a.id === "work") && short > 0 && spare > n.params.hours) FU.doAction(s, a.id);
      if (a.id === "deposit" && s.gold >= 12) FU.doAction(s, a.id);
      if (a.id === "buy:bullets" && s.ammo.bullets < 12 && s.gold > 6) FU.doAction(s, a.id);
    }
    if (s.status !== "playing") return;
    const value = { mine: 3, camp: 2, bank: s.gold > 12 ? 4 : 1, store: s.ammo.bullets < 8 ? 2 : 0, unknown: 1, cards: 0, shark: 0, dock: 9 };
    const visible = FU.visibleLayer(s);
    let best = null;
    let bestScore = -Infinity;
    for (const e of n.out) {
      const to = FU.node(s, e.to);
      const opt = pickTrip(s, e.to, rng, true);
      const v = (to.layer <= visible ? value[to.type] : 1) - opt.hours * 0.3 + rng.next() * 0.1;
      if (v > bestScore) {
        bestScore = v;
        best = { to: e.to, opt, reaction: 0.3 };
      }
    }
    return best;
  },
};

function playRun(code, bot, luck) {
  const s = FU.newGame(code);
  if (luck !== undefined) s.rng = FU.makeRng(luck); // same map, different dice
  const rng = FU.makeRng((luck || 0) + 99991);
  const stats = { fights: 0, fightHours: 0 };
  while (s.status === "playing") {
    const move = bot(s, rng);
    if (!move || s.status !== "playing") break;
    FU.tickHesitation(s, 4); // even a quick player loses a few seconds per stop
    if (s.status !== "playing") break;
    const trip = FU.beginTrip(s, move.to, move.opt.id) || FU.beginTrip(s, move.to, "walk");
    if (trip.fight) {
      stats.fights++;
      const c = playFight(s, trip.fight, move.reaction);
      stats.fightHours += c.lost.hours;
      if (s.status !== "playing") break;
    }
    FU.finishTrip(s, trip);
  }
  s.simStats = stats;
  return s;
}

// Per-map fairness: each map played many times with different luck.
// Usage: node tools/sim.js perseed [maps] [tries]
if (process.argv[2] === "perseed") {
  const maps = Number(process.argv[3]) || 200;
  const tries = Number(process.argv[4]) || 20;
  const buckets = { "0%": 0, "1-19%": 0, "20-49%": 0, "50-79%": 0, "80-100%": 0 };
  const mineCounts = [];
  for (let m = 0; m < maps; m++) {
    let won = 0;
    for (let k = 0; k < tries; k++) if (playRun("map-" + m, bots.greedy, k * 7 + 1).status === "won") won++;
    const r = won / tries;
    const key = r === 0 ? "0%" : r < 0.2 ? "1-19%" : r < 0.5 ? "20-49%" : r < 0.8 ? "50-79%" : "80-100%";
    buckets[key]++;
    mineCounts.push(FU.newGame("map-" + m).map.nodes.filter((n) => n.type === "mine").length);
  }
  console.log("greedy win rate per map (" + maps + " maps x " + tries + " tries):", JSON.stringify(buckets));
  console.log("gold mines per map: min " + Math.min(...mineCounts) + ", max " + Math.max(...mineCounts));
  process.exit(0);
}

for (const [name, bot] of Object.entries(bots)) {
  let won = 0;
  const reasons = {};
  const grades = {};
  let hoursLeft = 0;
  let goldEnd = 0;
  let fights = 0;
  let fightHours = 0;
  for (let i = 0; i < runs; i++) {
    const s = playRun(i + 1, bot);
    fights += s.simStats.fights;
    fightHours += s.simStats.fightHours;
    if (s.status === "won") {
      won++;
      grades[s.grade] = (grades[s.grade] || 0) + 1;
      hoursLeft += s.hours;
      goldEnd += s.gold + s.banked;
    } else {
      const key = s.endReason.replace(/\d+/g, "N");
      reasons[key] = (reasons[key] || 0) + 1;
    }
  }
  console.log("\n== " + name + " ==");
  console.log("win rate: " + ((100 * won) / runs).toFixed(1) + "%");
  if (won) console.log("avg on win: " + (hoursLeft / won).toFixed(1) + "h left, " + (goldEnd / won).toFixed(1) + " gold");
  console.log("fights per run: " + (fights / runs).toFixed(2) + ", avg hours lost per fight: " + (fightHours / Math.max(1, fights)).toFixed(2));
  console.log("grades:", JSON.stringify(grades));
  console.log("losses:", JSON.stringify(reasons, null, 1));
}
