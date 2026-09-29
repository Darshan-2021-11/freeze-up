// Full-run check: a bot walks to the nearest ready place, fights (with the
// same human-like fight bot), trains after losses, and heads to the dock
// once it has enough gold. Walking uses straight lines x1.3 for detours.
// Usage: node tools/run-sim.js [runs] ['{"CONFIG_KEY": value}'] [trainTo] [aimLag] [aimShake] [notrade]
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
const TRADE = process.argv[7] !== "notrade"; // "notrade": never uses Q or E

function hoursTo(a, b) {
  const from = a.player || a;
  const speed = a.player ? FU.walkSpeed(a) : FU.CONFIG.WALK_SPEED * 0.7;
  return ((Math.hypot(b.x - from.x, b.y - from.y) * 1.3) / speed) * C.CLOCK_RATE;
}
let tradedRuns = 0;
let boughtH = 0;
let workedH = 0;
let lostGold = 0;
let lostRuns = 0;

let won = 0;
let left = 0;
let clears = 0;
let losses = 0;
let realSecs = 0;
let deadEnds = 0; // everything conquered and out of time, still short of the ticket
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
    // Best place to fight next: reward per distance. Conquered places still offer patrols.
    const ready = s.world.places;
    const p = ready.reduce((m, x) => {
      const score = (x) => FU.nextTier(x).reward / (1 + Math.hypot(x.x - s.player.x, x.y - s.player.y) / 600);
      return score(x) > score(m) ? x : m;
    });
    // Hours to walk there, fight (about 2.5h) and still reach the dock.
    const need = hoursTo(s, p) + 2.5 + hoursTo(p, dock) + 1;
    if (TRADE && s.hours < need) {
      // Buy the missing hours if the fight is worth more than they cost.
      const hrs = need - s.hours + 0.5; // a little extra: purchases come in whole gold
      const tiersLeft = ready.some((x) => !FU.placeDone(x));
      if ((tiersLeft || hrs * FU.buyRate(s) < FU.nextTier(p).reward) && s.gold > hrs * FU.buyRate(s)) {
        FU.buyTime(s, hrs / C.CONVERT_SPEED);
      }
    }
    if (s.hours < need) {
      if (ready.every((x) => FU.placeDone(x))) deadEnds++;
      // Out of options: work the spare time (if trading), then go to the dock.
      if (TRADE) FU.work(s, Math.max(0, s.hours - toDock - 1) / C.CONVERT_SPEED);
      if (walk(s, dock.x, dock.y)) FU.board(s);
      if (s.status === "playing") s.status = "lost";
      break;
    }
    if (!walk(s, p.x, p.y)) break;
    const before = s.stats.losses;
    fight(s, p);
    losses += s.stats.losses - before;
  }
  clears += s.stats.wins;
  if (s.status === "won" && (s.stats.worked > 0 || s.stats.bought > 0)) tradedRuns++;
  boughtH += s.stats.bought;
  workedH += s.stats.worked;
  if (s.status !== "won") {
    lostRuns++;
    lostGold += s.gold;
  }
  realSecs += s.clock / C.CLOCK_RATE;
  if (s.status === "won") {
    won++;
    left += s.hours;
  }
}
console.log("win rate " + ((100 * won) / runs).toFixed(0) + "%, hours left on win " + (won ? (left / won).toFixed(1) : "-"));
console.log("runs that conquered everything and still lost: " + deadEnds + "; wins that used Q/E: " + tradedRuns);
console.log("avg hours bought " + (boughtH / runs).toFixed(1) + ", worked " + (workedH / runs).toFixed(1) + "; avg gold on a loss " + (lostRuns ? (lostGold / lostRuns).toFixed(0) : "-"));
console.log("per run: " + (clears / runs).toFixed(1) + " places cleared, " + (losses / runs).toFixed(1) + " fights lost, ~" + (realSecs / runs / 60).toFixed(1) + " real minutes");
