// Trail fights. Enemies walk in from the right; the player clicks to attack.
// Every hit you take costs time (wolves, bears) or gold (bandits).
// Uses a fixed 960x420 field; the renderer scales it to the canvas.
(function (g) {
  const FU = (g.FU = g.FU || {});

  const W = 960;
  const H = 420;
  const PLAYER = { x: 110, y: 300 };

  function magSize(id) {
    return FU.WEAPONS[id].mag || 0;
  }

  FU.Combat = {
    W,
    H,
    PLAYER,

    create(s, fight) {
      const e = FU.ENEMIES[fight.kind];
      const gap = { wolf: 110, bandit: 150, bear: 0 }[fight.kind];
      const enemies = [];
      for (let i = 0; i < fight.count; i++) {
        enemies.push({
          kind: fight.kind,
          x: W + 60 + i * gap + s.rng.int(0, 40),
          y: s.rng.int(230, 360),
          hp: e.hp,
          maxHp: e.hp,
          cool: 0.3,
          flash: 0,
        });
      }
      const c = {
        kind: fight.kind,
        enemies,
        weapon: "revolver",
        mag: { revolver: Math.min(magSize("revolver"), s.ammo.bullets), shotgun: Math.min(magSize("shotgun"), s.ammo.shells) },
        cooldown: 0,
        reloadLeft: 0,
        bombs: [],
        fx: [],
        time: 0,
        done: false,
        won: false,
        events: [],
        lost: { hours: 0, gold: 0, loot: 0 },
      };
      if (!FU.Combat.canUse(c, s, "revolver")) c.weapon = "knife";
      return c;
    },

    canUse(c, s, id) {
      const w = FU.WEAPONS[id];
      if (!s.weapons[id]) return false;
      return !w.ammo || s.ammo[w.ammo] > 0;
    },

    ammoText(c, s, id) {
      const w = FU.WEAPONS[id];
      if (!w.ammo) return "∞";
      if (w.mag) return c.mag[id] + " / " + s.ammo[w.ammo];
      return String(s.ammo[w.ammo]);
    },

    switchWeapon(c, s, id) {
      if (c.done || c.weapon === id || !FU.Combat.canUse(c, s, id)) return;
      c.weapon = id;
      c.reloadLeft = 0;
      c.events.push("reload");
    },

    reload(c, s) {
      const id = c.weapon;
      const w = FU.WEAPONS[id];
      if (!w.mag || c.reloadLeft > 0) return;
      if (c.mag[id] >= w.mag || s.ammo[w.ammo] <= c.mag[id]) return;
      c.reloadLeft = w.reload;
      c.events.push("reload");
    },

    click(c, s, x, y) {
      if (c.done || c.cooldown > 0 || c.reloadLeft > 0) return;
      const id = c.weapon;
      const w = FU.WEAPONS[id];

      if (w.mag && c.mag[id] <= 0) {
        if (s.ammo[w.ammo] > 0) FU.Combat.reload(c, s);
        else FU.Combat.switchWeapon(c, s, "knife");
        return;
      }
      if (id === "dynamite") {
        if (s.ammo.dynamite <= 0) return FU.Combat.switchWeapon(c, s, "knife");
        s.ammo.dynamite -= 1;
        c.bombs.push({ x, y, t: w.fuse });
        c.cooldown = w.cooldown;
        c.events.push("reload");
        if (s.ammo.dynamite <= 0) c.weapon = FU.Combat.canUse(c, s, "revolver") ? "revolver" : "knife";
        return;
      }

      c.cooldown = w.cooldown;
      c.events.push(w.sound);
      if (w.mag) {
        c.mag[id] -= 1;
        s.ammo[w.ammo] -= 1;
      }
      c.fx.push({ type: "shot", x, y, t: 0.15 });

      if (w.radius) {
        for (const e of c.enemies) if (Math.hypot(e.x - x, e.y - y) <= w.radius + FU.ENEMIES[e.kind].size / 2) hurt(c, s, e, w.dmg);
        return;
      }
      const target = enemyAt(c, x, y);
      if (!target) return;
      if (w.reach && target.x - PLAYER.x > w.reach) {
        c.fx.push({ type: "text", x: target.x, y: target.y - 50, t: 0.8, text: "Too far!" });
        return;
      }
      hurt(c, s, target, w.dmg);

      // Out of shots with no spare ammo: fall back to the knife.
      if (w.mag && c.mag[id] <= 0 && s.ammo[w.ammo] <= 0) c.weapon = "knife";
    },

    run(c, s) {
      if (c.done) return;
      s.hours -= FU.CONFIG.RUN_HOURS;
      c.lost.hours += FU.CONFIG.RUN_HOURS;
      FU.log(s, "You ran from the fight and lost " + FU.CONFIG.RUN_HOURS + " hours.", "bad");
      c.done = true;
      FU.checkClock(s, "The river froze while you ran.");
    },

    update(c, s, dt) {
      if (c.done) return;
      const C = FU.CONFIG;
      c.time += dt;
      const burn = dt * C.FIGHT_HOURS_PER_SEC;
      s.hours -= burn;
      s.fightHours += burn;
      c.lost.hours += burn;
      c.cooldown = Math.max(0, c.cooldown - dt);

      if (c.reloadLeft > 0) {
        c.reloadLeft -= dt;
        if (c.reloadLeft <= 0) {
          const w = FU.WEAPONS[c.weapon];
          c.mag[c.weapon] = Math.min(w.mag, s.ammo[w.ammo]);
          c.reloadLeft = 0;
        }
      }

      for (const e of c.enemies) {
        const def = FU.ENEMIES[e.kind];
        e.flash = Math.max(0, e.flash - dt);
        const stopX = PLAYER.x + 60 + def.size * 0.35;
        if (e.x > stopX) {
          e.x = Math.max(stopX, e.x - def.speed * dt);
          continue;
        }
        e.cool -= dt;
        if (e.cool > 0) continue;
        e.cool = def.hitEvery;
        if (def.stealGold) {
          const took = Math.min(def.stealGold, s.gold);
          s.gold -= took;
          c.lost.gold += took;
          c.fx.push({ type: "text", x: PLAYER.x, y: PLAYER.y - 90, t: 1, text: took ? "-" + took + " gold" : "Bag empty!", bad: true });
        } else {
          s.hours -= def.hurtHours;
          c.lost.hours += def.hurtHours;
          c.fx.push({ type: "text", x: PLAYER.x, y: PLAYER.y - 90, t: 1, text: "-" + FU.fmtHours(def.hurtHours), bad: true });
        }
        c.events.push("hurt");
      }

      for (const b of c.bombs) {
        b.t -= dt;
        if (b.t > 0) continue;
        const w = FU.WEAPONS.dynamite;
        c.events.push("dynamite");
        c.fx.push({ type: "boom", x: b.x, y: b.y, t: 0.5, r: w.radius });
        for (const e of c.enemies) if (Math.hypot(e.x - b.x, e.y - b.y) <= w.radius + FU.ENEMIES[e.kind].size / 2) hurt(c, s, e, w.dmg);
        if (Math.hypot(PLAYER.x - b.x, PLAYER.y - b.y) <= w.radius) {
          s.hours -= 1;
          c.lost.hours += 1;
          c.fx.push({ type: "text", x: PLAYER.x, y: PLAYER.y - 90, t: 1, text: "Too close! -1h", bad: true });
        }
      }
      c.bombs = c.bombs.filter((b) => b.t > 0);

      for (const f of c.fx) f.t -= dt;
      c.fx = c.fx.filter((f) => f.t > 0);

      if (!FU.checkClock(s, "The river froze during the fight.")) {
        c.done = true;
        return;
      }
      if (c.enemies.length === 0 && c.bombs.length === 0) {
        c.done = true;
        c.won = true;
        const def = FU.ENEMIES[c.kind];
        const parts = ["You beat the " + (def.group[1] > 1 ? def.plural : def.name).toLowerCase() + " in " + FU.fmtHours(c.lost.hours) + " of game time"];
        if (c.lost.gold) parts.push("lost " + c.lost.gold + " gold");
        if (c.lost.loot) parts.push("took " + c.lost.loot + " gold from them");
        FU.log(s, parts.join(", ") + ".", c.lost.loot > c.lost.gold ? "good" : "bad");
      }
    },
  };

  function enemyAt(c, x, y) {
    let best = null;
    let bestD = Infinity;
    for (const e of c.enemies) {
      const r = FU.ENEMIES[e.kind].size / 2 + 8;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= r && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  function hurt(c, s, e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 0.15;
    c.events.push("hit");
    if (e.hp > 0) return;
    const def = FU.ENEMIES[e.kind];
    if (def.loot) {
      const n = s.rng.int(def.loot[0], def.loot[1]);
      s.gold += n;
      c.lost.loot += n;
      c.fx.push({ type: "text", x: e.x, y: e.y - 60, t: 1, text: "+" + n + " gold" });
    }
    c.enemies = c.enemies.filter((x) => x !== e);
  }
})(typeof window !== "undefined" ? window : globalThis);
