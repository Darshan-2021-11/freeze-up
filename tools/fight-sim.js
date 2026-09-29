// Fight check: a simple bot fights each place many times.
// It keeps its distance, dashes when close and shoots the nearest enemy.
// Usage: node tools/fight-sim.js [runs]
["config", "rng", "world", "arena", "game"].forEach((f) => require("../src/" + f + ".js"));
const FU = globalThis.FU;
const runs = Number(process.argv[2]) || 200;
const LAG = Number(process.argv[3]) || 6; // frames of reaction delay (30 per second)
const SHAKE = Number(process.argv[4]) || 60; // aim wobble in pixels
const DODGE = process.argv[5] !== "nododge";
let lag = [];

function bot(a) {
  const p = a.player;
  if (!a.enemies.length) return { dx: 0, dy: 0, aimX: p.x + 1, aimY: p.y, fire: false };
  const e = a.enemies.reduce((m, x) => (Math.hypot(x.x - p.x, x.y - p.y) < Math.hypot(m.x - p.x, m.y - p.y) ? x : m));
  const d = Math.hypot(e.x - p.x, e.y - p.y);
  let dx = 0;
  let dy = 0;
  if (d < 220) {
    dx = p.x - e.x;
    dy = p.y - e.y;
  } else {
    dy = Math.sin(a.time * 1.3); // drift to dodge shots
  }
  // Aim at where the enemy was a moment ago, with some shake, like a human.
  const key = a.enemies.indexOf(e);
  lag[key] = lag[key] || [];
  lag[key].push({ x: e.x, y: e.y });
  if (lag[key].length > LAG) lag[key].shift();
  const old = lag[key][0];
  const err = () => (Math.random() - 0.5) * SHAKE;
  return { dx, dy, aimX: old.x + err(), aimY: old.y + err(), fire: true, dash: DODGE && d < 90, reload: false };
}

// [place, losses there, skill level]
const cases = [];
for (const kind of Object.keys(FU.PLACES)) cases.push([kind, 0, 0]);
cases.push(["fort", 1, 0], ["fort", 2, 0]); // rematches after losses are easier
cases.push(["den", 0, 2], ["fort", 0, 1], ["fort", 0, 3], ["fort", 0, 5]); // trained players
for (const [kind, losses, skill] of cases) {
  let won = 0;
  let secs = 0;
  for (let i = 0; i < runs; i++) {
    const s = FU.newGame("sim-" + i);
    s.ammo.dynamite = 0;
    s.skill = skill;
    const place = { kind, losses, clears: 0 };
    const a = FU.Arena.create(s, place);
    lag = [];
    while (!a.done && a.time < 180) FU.Arena.update(a, s, 1 / 30, bot(a));
    if (a.won) won++;
    secs += a.time;
  }
  const name = kind + (losses ? " after " + losses + " loss" + (losses > 1 ? "es" : "") : "") + (skill ? " at skill " + skill : "");
  console.log(name.padEnd(22), "bot win rate " + ((100 * won) / runs).toFixed(0) + "%, avg fight " + (secs / runs).toFixed(1) + "s");
}
