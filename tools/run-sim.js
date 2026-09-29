// Full-run check: a bot walks to the nearest ready place, fights (with the
// same human-like fight bot), trains after losses, and heads to the dock
// once it has enough gold. Walking uses straight lines x1.3 for detours.
// Usage: node tools/run-sim.js [runs] ['{"CONFIG_KEY": value}']
["config", "rng", "world", "arena", "game"].forEach((f) => require("../src/" + f + ".js"));
const FU = globalThis.FU;
const C = FU.CONFIG;
const runs = Number(process.argv[2]) || 200;
Object.assign(C, JSON.parse(process.argv[3] || "{}"));
const AIM_LAG = Number(process.argv[5]) || 8; // frames of reaction delay: higher = weaker player
const AIM_SHAKE = Number(process.argv[6]) || 75; // aim wobble in pixels

let lag = [];
function fightBot(a) {
  const p = a.player;
  if (!a.enemies.length) return { dx: 0, dy: 0, aimX: p.x + 1, aimY: p.y, fire: false };
  const e = a.enemies.reduce((m, x) => (Math.hypot(x.x - p.x, x.y - p.y) < Math.hypot(m.x - p.x, m.y - p.y) ? x : m));
  const d = Math.hypot(e.x - p.x, e.y - p.y);
  const k = a.enemies.indexOf(e);
  lag[k] = lag[k] || [];
  lag[k].push({ x: e.x, y: e.y });
  if (lag[k].length > AIM_LAG) lag[k].shift();
  const o = lag[k][0];
  const err = () => (Math.random() - 0.5) * AIM_SHAKE;
  const away = d < 220;
  return { dx: away ? p.x - e.x : 0, dy: away ? p.y - e.y : Math.sin(a.time * 1.3), aimX: o.x + err(), aimY: o.y + err(), fire: true, dash: d < 90 };
}

function walk(s, x, y) {
  const d = Math.hypot(x - s.player.x, y - s.player.y) * 1.3;
  const secs = d / FU.walkSpeed(s);
  s.player.x = x;
  s.player.y = y;
  return FU.spend(s, secs * C.CLOCK_RATE);
}

function fight(s, place) {
  for (;;) {
    lag = [];
    const a = FU.Arena.create(s, place);
    while (!a.done && a.time < 180) {
      FU.Arena.update(a, s, 1 / 30, fightBot(a));
    }
    if (!FU.spend(s, a.time * C.CLOCK_RATE)) return;
    if (a.won) return FU.winFight(s, place, FU.Arena.bounty(a));
    FU.loseFight(s, place); // then rematch right away
  }
}

// Optional training: walk to the nearest range, pay, and pass 70% of the time.
function train(s) {
  const range = s.world.towns.filter((t) => t.kind === "range").reduce((m, t) => (Math.hypot(t.x - s.player.x, t.y - s.player.y) < Math.hypot(m.x - s.player.x, m.y - s.player.y) ? t : m));
  if (!walk(s, range.x, range.y)) return;
  if (!FU.startTraining(s) || !FU.spend(s, 10 * C.CLOCK_RATE)) return;
  FU.finishTraining(s, Math.random() < 0.7);
}
const TRAIN_TO = Number(process.argv[4]) || 0; // skill level the bot trains up to

let won = 0;
let left = 0;
let clears = 0;
let losses = 0;
let realSecs = 0;
let deadEnds = 0; // everything conquered but still short of the ticket
for (let i = 0; i < runs; i++) {
  const s = FU.newGame("run-" + i);
  const dock = s.world.towns[2];
  while (s.status === "playing") {
    const toDock = (Math.hypot(dock.x - s.player.x, dock.y - s.player.y) * 1.3) / FU.walkSpeed(s) * C.CLOCK_RATE;
    if (s.gold >= C.TARGET_GOLD) {
      if (walk(s, dock.x, dock.y)) FU.board(s);
      break;
    }
    if (s.skill < TRAIN_TO && s.gold >= FU.trainingCost(s).gold + 5 && s.stats.trainings < TRAIN_TO + 2) {
      train(s);
      continue;
    }
    // Nearest ready place, worth the trip.
    const ready = s.world.places.filter((p) => !FU.placeDone(p));
    if (!ready.length || s.hours < toDock + 4) {
      if (!ready.length) deadEnds++;
      // Out of options: work the spare time, then go to the dock.
      FU.work(s, Math.max(0, s.hours - toDock - 1) / C.CONVERT_SPEED);
      if (walk(s, dock.x, dock.y)) FU.board(s);
      if (s.status === "playing") s.status = "lost";
      break;
    }
    const p = ready.reduce((m, x) => {
      const score = (x) => FU.nextTier(x).reward / (1 + Math.hypot(x.x - s.player.x, x.y - s.player.y) / 600);
      return score(x) > score(m) ? x : m;
    });
    if (!walk(s, p.x, p.y)) break;
    const before = s.stats.losses;
    fight(s, p);
    losses += s.stats.losses - before;
  }
  clears += s.stats.wins;
  realSecs += s.clock / C.CLOCK_RATE;
  if (s.status === "won") {
    won++;
    left += s.hours;
  }
}
console.log("win rate " + ((100 * won) / runs).toFixed(0) + "%, hours left on win " + (won ? (left / won).toFixed(1) : "-"));
console.log("runs that conquered everything but lacked gold: " + deadEnds);
console.log("per run: " + (clears / runs).toFixed(1) + " places cleared, " + (losses / runs).toFixed(1) + " fights lost, ~" + (realSecs / runs / 60).toFixed(1) + " real minutes");
