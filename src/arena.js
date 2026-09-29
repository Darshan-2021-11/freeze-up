// Fights and training. Top-down arena: move with WASD, aim with the mouse,
// click to fire, Space to dash. Uses a fixed 960x600 field.
(function (g) {
  const FU = (g.FU = g.FU || {});

  const W = 960;
  const H = 600;
  const START = { x: 120, y: 300 };

  function roll(rng, range) {
    return range[0] + rng.next() * (range[1] - range[0]);
  }

  function pushOut(obj, r, rocks) {
    for (const k of rocks) {
      const dx = obj.x - k.x;
      const dy = obj.y - k.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < k.r + r) {
        obj.x = k.x + (dx / d) * (k.r + r);
        obj.y = k.y + (dy / d) * (k.r + r);
        return true;
      }
    }
    return false;
  }

  function clampField(obj, r) {
    obj.x = Math.max(r, Math.min(W - r, obj.x));
    obj.y = Math.max(r, Math.min(H - r, obj.y));
  }

  function hitsRock(x, y, rocks) {
    return rocks.some((k) => Math.hypot(x - k.x, y - k.y) < k.r);
  }

  FU.Arena = {
    W,
    H,

    create(s, place) {
      const C = FU.CONFIG;
      const rng = s.rng;
      const def = FU.PLACES[place.kind];

      // Enemy groups, one per wave, fixed per place. Losses here weaken enemies;
      // from the second loss on, one fewer enemy too.
      let remove = Math.max(0, place.losses - 1);
      const tierDef = FU.nextTier(place);
      const waves = FU.tierWaves(place.kind, place.tier);
      for (let i = waves.length - 1; i >= 0 && remove > 0; i--) {
        while (waves[i].length > 1 && remove > 0) {
          waves[i].pop();
          remove--;
        }
      }

      const rocks = [];
      const rockCount = rng.int(3, 6);
      for (let tries = 0; rocks.length < rockCount && tries < 200; tries++) {
        const k = { x: rng.int(240, W - 170), y: rng.int(70, H - 70), r: rng.int(26, 48) };
        if (Math.hypot(k.x - START.x, k.y - START.y) < 180) continue;
        if (rocks.some((o) => Math.hypot(o.x - k.x, o.y - k.y) < o.r + k.r + 60)) continue;
        rocks.push(k);
      }

      const maxHp = s.maxHearts;
      const T = C.TRAINING;
      const skill = s.skill || 0;
      const a = {
        place,
        def,
        tierDef,
        speedMult: (tierDef.speed || 1) * FU.DIFFICULTIES[s.difficulty || "normal"].speed,
        shotGapMult: FU.DIFFICULTIES[s.difficulty || "normal"].fire, // bandit shot spacing
        bloom: 0,
        trigger: 0, // a click waits this long for the gun to be ready
        shotsFired: 0,
        shotsHit: 0,
        ice: !!def.ice,
        waves,
        wave: 0,
        hpMult: Math.max(0.5, 1 - C.MERCY * place.losses) * FU.DIFFICULTIES[s.difficulty || "normal"].hp,
        enemies: [],
        shots: [],
        foeShots: [],
        bombs: [],
        holes: [], // Frozen Lake: dynamite breaks the ice
        rocks,
        fx: [],
        events: [],
        player: { x: START.x, y: START.y, hp: maxHp, maxHp, inv: 0, dash: 0, dashCd: 0, aim: 0, mvx: 0, mvy: 0 },
        weapon: "revolver",
        mag: { revolver: FU.WEAPONS.revolver.mag, shotgun: Math.min(FU.WEAPONS.shotgun.mag, s.ammo.shells) },
        reloadLeft: 0,
        cooldown: 0,
        // Training makes you faster and gives a chance of double damage.
        crit: T.crit * skill,
        fireMult: 1 - T.fireRate * skill,
        reloadMult: 1 - T.reload * skill,
        waveDelay: 0.6,
        time: 0,
        done: false,
        won: false,
      };
      return a;
    },

    // Reward if the fight ended now: full until par, then down to the floor at 3x par.
    bounty(a) {
      const t = a.tierDef;
      const floor = FU.bountyFloor(t.reward);
      const k = Math.min(1, Math.max(0, a.time - t.par) / (2 * t.par));
      return Math.round((t.reward - (t.reward - floor) * k) * FU.Arena.accuracyFactor(a));
    },

    // Share of trigger pulls that hit something (dynamite not counted).
    accuracy(a) {
      return a.shotsFired ? a.shotsHit / a.shotsFired : 1;
    },

    // Small bounty cut for wild shooting: 1 = no cut.
    accuracyFactor(a) {
      const A = FU.CONFIG.ACCURACY;
      if (a.shotsFired < A.minShots) return 1;
      return 1 - A.maxCut * Math.max(0, A.target - FU.Arena.accuracy(a)) / A.target;
    },

    canUse(a, s, id) {
      if (!s.weapons[id]) return false;
      const w = FU.WEAPONS[id];
      return !w.ammo || s.ammo[w.ammo] > 0;
    },

    ammoText(a, s, id) {
      const w = FU.WEAPONS[id];
      if (id === "revolver") return a.mag.revolver + " / ∞";
      if (w.mag) return a.mag[id] + " / " + s.ammo[w.ammo];
      return String(s.ammo[w.ammo]);
    },

    switchWeapon(a, s, id) {
      if (a.done || a.weapon === id || !FU.Arena.canUse(a, s, id)) return;
      a.weapon = id;
      a.reloadLeft = 0;
      a.events.push("reload");
    },

    reload(a, s) {
      const id = a.weapon;
      const w = FU.WEAPONS[id];
      if (!w.mag || a.reloadLeft > 0 || a.mag[id] >= w.mag) return;
      if (w.ammo && s.ammo[w.ammo] <= a.mag[id]) return;
      a.reloadLeft = w.reload * a.reloadMult;
      a.events.push("reload");
    },

    // input: { dx, dy, aimX, aimY, fire, dash, reload }
    update(a, s, dt, input) {
      if (a.done) return;
      const C = FU.CONFIG;
      const rng = s.rng;
      const p = a.player;
      a.time += dt;

      // Waves
      if (a.enemies.length === 0 && a.bombs.length === 0) {
        a.waveDelay -= dt;
        if (a.waveDelay <= 0) {
          if (a.wave >= a.waves.length) {
            a.done = true;
            a.won = true;
            return;
          }
          spawnWave(a, rng, a.waves[a.wave]);
          a.wave += 1;
          a.waveDelay = 1;
        }
      }

      // Player movement and dash
      p.inv = Math.max(0, p.inv - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.dash = Math.max(0, p.dash - dt);
      if (input.dash && p.dashCd <= 0 && (input.dx || input.dy)) {
        p.dash = C.DASH_TIME;
        p.dashCd = C.DASH_COOLDOWN;
        p.inv = Math.max(p.inv, C.DASH_TIME + 0.05);
        a.events.push("step");
      }
      const len = Math.hypot(input.dx, input.dy) || 1;
      const speed = C.ARENA_SPEED * (p.dash > 0 ? C.DASH_SPEED : 1);
      const ox = p.x;
      const oy = p.y;
      const wantX = (input.dx / len) * speed;
      const wantY = (input.dy / len) * speed;
      if (a.ice && p.dash <= 0) {
        // On ice you speed up and slow down slowly: you slide.
        const k = Math.min(1, 2.2 * dt);
        p.mvx += (wantX - p.mvx) * k;
        p.mvy += (wantY - p.mvy) * k;
      } else {
        p.mvx = wantX;
        p.mvy = wantY;
      }
      p.x += p.mvx * dt;
      p.y += p.mvy * dt;
      pushOut(p, 16, a.rocks);
      clampField(p, 16);
      p.vx = (p.x - ox) / dt;
      p.vy = (p.y - oy) / dt;
      p.aim = Math.atan2(input.aimY - p.y, input.aimX - p.x);

      // Weapons
      a.cooldown = Math.max(0, a.cooldown - dt);
      a.bloom = Math.max(0, a.bloom - C.BLOOM_DECAY * dt);
      if (a.reloadLeft > 0) {
        a.reloadLeft -= dt;
        if (a.reloadLeft <= 0) {
          const w = FU.WEAPONS[a.weapon];
          a.mag[a.weapon] = w.ammo ? Math.min(w.mag, s.ammo[w.ammo]) : w.mag;
          a.reloadLeft = 0;
        }
      }
      if (input.reload) FU.Arena.reload(a, s);
      // One shot per click. A click made just before the gun is ready still counts.
      if (input.fire) a.trigger = 0.15;
      a.trigger = Math.max(0, a.trigger - dt);
      if (a.trigger > 0 && fire(a, s, input)) a.trigger = 0;

      // Player shots
      for (const b of a.shots) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (hitsRock(b.x, b.y, a.rocks) || b.x < 0 || b.y < 0 || b.x > W || b.y > H) b.life = 0;
        if (b.life <= 0) continue;
        for (const e of a.enemies) {
          if (Math.hypot(e.x - b.x, e.y - b.y) < FU.ENEMIES[e.kind].radius + 4) {
            hurtEnemy(a, e, b.dmg, b.vx, b.vy);
            if (b.pull && !b.pull.hit) {
              b.pull.hit = true;
              a.shotsHit += 1;
            }
            if (b.crit) a.fx.push({ type: "text", x: e.x, y: e.y - 30, t: 0.6, text: "Crit!" });
            b.life = 0;
            break;
          }
        }
      }
      a.shots = a.shots.filter((b) => b.life > 0);

      // Enemies
      for (const e of a.enemies) updateEnemy(a, e, dt, rng);
      separate(a);
      a.enemies = a.enemies.filter((e) => e.hp > 0);

      // Enemy shots
      for (const b of a.foeShots) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (hitsRock(b.x, b.y, a.rocks) || b.x < 0 || b.y < 0 || b.x > W || b.y > H) b.dead = true;
        else if (Math.hypot(b.x - p.x, b.y - p.y) < 18 && p.inv <= 0) {
          hurtPlayer(a, 1, { x: b.x - b.vx, y: b.y - b.vy });
          b.dead = true;
        }
      }
      a.foeShots = a.foeShots.filter((b) => !b.dead);

      // Dynamite
      for (const b of a.bombs) {
        b.t -= dt;
        if (b.t > 0) continue;
        const w = FU.WEAPONS.dynamite;
        a.events.push("dynamite");
        a.fx.push({ type: "boom", x: b.x, y: b.y, t: 0.5, r: w.radius });
        for (const e of a.enemies) {
          if (Math.hypot(e.x - b.x, e.y - b.y) <= w.radius + FU.ENEMIES[e.kind].radius) hurtEnemy(a, e, w.dmg, e.x - b.x, e.y - b.y);
        }
        if (Math.hypot(p.x - b.x, p.y - b.y) <= w.radius && p.inv <= 0) hurtPlayer(a, 1, b);
        if (a.ice) a.holes.push({ x: b.x, y: b.y, r: 55 });
      }
      // Anything that walks onto open water falls in. Enemies drown; you get hurt and climb out.
      for (const h of a.holes) {
        for (const e of a.enemies) {
          if (e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) < h.r) {
            e.hp = 0;
            a.events.push("hit");
            a.fx.push({ type: "text", x: e.x, y: e.y - 40, t: 0.9, text: "Fell through!" });
          }
        }
        const d = Math.hypot(p.x - h.x, p.y - h.y);
        if (d < h.r - 6) {
          if (p.inv <= 0) hurtPlayer(a, 1, h);
          const k = d || 1;
          p.x = h.x + ((p.x - h.x) / k) * (h.r + 10);
          p.y = h.y + ((p.y - h.y) / k) * (h.r + 10);
          p.mvx = 0;
          p.mvy = 0;
          clampField(p, 16);
        }
      }
      a.bombs = a.bombs.filter((b) => b.t > 0);
      a.enemies = a.enemies.filter((e) => e.hp > 0);

      for (const f of a.fx) f.t -= dt;
      a.fx = a.fx.filter((f) => f.t > 0);

      if (p.hp <= 0) {
        a.done = true;
        a.won = false;
      }
    },
  };

  // A wave enters together from the right edge, spread evenly top to bottom.
  function spawnWave(a, rng, kinds) {
    kinds.forEach(function (kind, i) {
      const def = FU.ENEMIES[kind];
      const y = Math.round(((i + 1) / (kinds.length + 1)) * H + rng.int(-25, 25));
      const x = W - def.radius - 6 - (i % 2) * 40;
      const hp = Math.max(1, Math.round(def.hp * a.hpMult));
      a.enemies.push({
        kind,
        x,
        y,
        hp,
        maxHp: hp,
        phase: rng.next() * 6.28,
        shootT: def.shootEvery ? roll(rng, def.shootEvery) * a.shotGapMult : 0,
        chargeT: def.chargeEvery ? roll(rng, def.chargeEvery) : 0,
        state: "move",
        stateT: 0,
        strafe: rng.chance(0.5) ? 1 : -1,
        strafeT: roll(rng, [1, 2.5]),
        atkCd: 0.6,
        hit: false,
        flash: 0,
        cx: 0,
        cy: 0,
      });
    });
  }

  // Returns true if a shot or throw happened.
  function fire(a, s, input) {
    if (a.cooldown > 0 || a.reloadLeft > 0) return false;
    const id = a.weapon;
    const w = FU.WEAPONS[id];
    const p = a.player;
    const rng = s.rng;

    if (id === "dynamite") {
      if (s.ammo.dynamite <= 0) return FU.Arena.switchWeapon(a, s, "revolver");
      s.ammo.dynamite -= 1;
      const d = Math.min(420, Math.hypot(input.aimX - p.x, input.aimY - p.y));
      a.bombs.push({ x: p.x + Math.cos(p.aim) * d, y: p.y + Math.sin(p.aim) * d, t: w.fuse });
      a.cooldown = w.cooldown;
      a.events.push("reload");
      if (s.ammo.dynamite <= 0) a.weapon = "revolver";
      return true;
    }

    if (a.mag[id] <= 0) {
      if (w.ammo && s.ammo[w.ammo] <= 0) FU.Arena.switchWeapon(a, s, "revolver");
      else FU.Arena.reload(a, s);
      return false;
    }
    a.mag[id] -= 1;
    if (w.ammo) s.ammo[w.ammo] -= 1;
    a.cooldown = w.cooldown * a.fireMult;
    a.events.push(id);
    const pull = { hit: false };
    a.shotsFired += 1;
    for (let i = 0; i < w.pellets; i++) {
      const ang = p.aim + (rng.next() - 0.5) * 2 * (w.spread + a.bloom);
      const crit = rng.chance(a.crit);
      a.shots.push({ x: p.x + Math.cos(p.aim) * 24, y: p.y + Math.sin(p.aim) * 24, vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed, life: w.range / w.speed, dmg: w.dmg * (crit ? 2 : 1), crit, pull });
    }
    a.bloom = Math.min(FU.CONFIG.BLOOM_MAX, a.bloom + FU.CONFIG.BLOOM_STEP * (w.pellets > 1 ? 1.5 : 1));
    a.fx.push({ type: "flash", x: p.x + Math.cos(p.aim) * 30, y: p.y + Math.sin(p.aim) * 30, t: 0.08 });
    if (a.mag[id] <= 0 && (!w.ammo || s.ammo[w.ammo] > 0)) FU.Arena.reload(a, s);
    return true;
  }

  function updateEnemy(a, e, dt, rng) {
    const def = FU.ENEMIES[e.kind];
    const p = a.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    e.flash = Math.max(0, e.flash - dt);
    e.atkCd = Math.max(0, e.atkCd - dt);
    let vx = 0;
    let vy = 0;
    const near = dist < def.radius + 16 + (def.reach || 0);

    if (e.kind === "wolf") {
      // Wolves crouch (a warning), lunge, then back off before the next bite.
      if (e.state === "crouch") {
        e.stateT -= dt;
        if (e.stateT <= 0) {
          e.state = "lunge";
          e.stateT = def.lungeTime;
          e.hit = false;
        }
      } else if (e.state === "lunge") {
        vx = e.cx * def.lungeSpeed;
        vy = e.cy * def.lungeSpeed;
        e.stateT -= dt;
        if (e.stateT <= 0) {
          e.state = "recover";
          e.stateT = def.recover;
        }
      } else if (e.state === "recover") {
        vx = -ux * def.speed * 0.4;
        vy = -uy * def.speed * 0.4;
        e.stateT -= dt;
        if (e.stateT <= 0) e.state = "move";
      } else {
        const wob = Math.sin(a.time * 4 + e.phase) * 0.6;
        vx = (ux * Math.cos(wob) - uy * Math.sin(wob)) * def.speed;
        vy = (uy * Math.cos(wob) + ux * Math.sin(wob)) * def.speed;
        if (near && e.atkCd <= 0) {
          e.state = "crouch";
          e.stateT = def.windup;
          e.cx = ux;
          e.cy = uy;
          e.atkCd = def.attackEvery;
        }
      }
    } else if (e.kind === "bandit" || e.kind === "boss") {
      const toward = dist > def.keep[1] ? 1 : dist < def.keep[0] ? -1 : 0;
      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafe = -e.strafe;
        e.strafeT = roll(rng, [1, 2.5]);
      }
      vx = (ux * toward - uy * e.strafe * 0.7) * def.speed;
      vy = (uy * toward + ux * e.strafe * 0.7) * def.speed;
      if (e.state === "aim") {
        vx *= 0.2;
        vy *= 0.2;
        e.stateT -= dt;
        if (e.stateT <= 0) {
          // Bandits lead their shots a little: keep changing direction.
          const lead = (dist / def.bulletSpeed) * def.lead;
          const base = Math.atan2(dy + (p.vy || 0) * lead, dx + (p.vx || 0) * lead) + (rng.next() - 0.5) * 0.16;
          const n = def.shots || 1;
          for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * 0.28;
            a.foeShots.push({ x: e.x + Math.cos(ang) * 26, y: e.y + Math.sin(ang) * 26, vx: Math.cos(ang) * def.bulletSpeed, vy: Math.sin(ang) * def.bulletSpeed });
          }
          a.events.push("revolver");
          e.state = "move";
          e.shootT = (roll(rng, def.shootEvery) * a.shotGapMult) / a.speedMult;
        }
      } else {
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.state = "aim";
          e.stateT = def.windup;
        }
      }
    } else if (e.kind === "bear") {
      if (e.state === "move") {
        vx = ux * def.speed;
        vy = uy * def.speed;
        e.chargeT -= dt;
        if (near && e.atkCd <= 0) {
          // Close up, the bear raises a paw first: a swipe you can dodge.
          e.state = "swipe";
          e.stateT = def.swipeWindup;
        } else if (e.chargeT <= 0) {
          e.state = "windup";
          e.stateT = def.windup;
          e.cx = ux;
          e.cy = uy;
        }
      } else if (e.state === "swipe") {
        e.stateT -= dt;
        if (e.stateT <= 0) {
          if (dist < def.radius + 16 + def.reach + 15 && p.inv <= 0) hurtPlayer(a, def.touch, e);
          e.atkCd = def.attackEvery;
          e.state = "move";
        }
      } else if (e.state === "windup") {
        e.stateT -= dt;
        if (e.stateT <= 0) {
          e.state = "charge";
          e.stateT = def.chargeTime;
          e.hit = false;
        }
      } else if (e.state === "charge") {
        vx = e.cx * def.chargeSpeed;
        vy = e.cy * def.chargeSpeed;
        e.stateT -= dt;
        if (e.stateT <= 0) {
          e.state = "move";
          e.chargeT = roll(rng, def.chargeEvery);
        }
      } else if (e.state === "stun") {
        e.stateT -= dt;
        if (e.stateT <= 0) {
          e.state = "move";
          e.chargeT = roll(rng, def.chargeEvery);
        }
      }
    }

    e.x += vx * a.speedMult * dt;
    e.y += vy * a.speedMult * dt;
    // A charging bear that slams into a rock is stunned: a chance to hit back.
    if (pushOut(e, def.radius, a.rocks) && e.state === "charge") {
      e.state = "stun";
      e.stateT = 1.2;
      a.events.push("hit");
      a.fx.push({ type: "text", x: e.x, y: e.y - 50, t: 1, text: "Stunned!" });
    }
    clampField(e, def.radius);

    // Touching alone never hurts. Only a lunge or a charge that reaches you does, once.
    const touching = Math.hypot(p.x - e.x, p.y - e.y) < def.radius + 20;
    if (touching && (e.state === "lunge" || e.state === "charge") && !e.hit && p.inv <= 0) {
      hurtPlayer(a, def.touch, e);
      e.hit = true;
      if (e.state === "charge") {
        e.state = "move";
        e.chargeT = roll(rng, def.chargeEvery);
        e.atkCd = def.attackEvery;
      }
    }
  }

  // Enemies can't stand inside each other or inside the player.
  function separate(a) {
    const p = a.player;
    const list = a.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const r = FU.ENEMIES[e.kind].radius;
      for (let j = i + 1; j < list.length; j++) {
        const o = list[j];
        const ro = FU.ENEMIES[o.kind].radius;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < r + ro) {
          const push = (r + ro - d) / 2;
          e.x += (dx / d) * push;
          e.y += (dy / d) * push;
          o.x -= (dx / d) * push;
          o.y -= (dy / d) * push;
        }
      }
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < r + 18) {
        e.x = p.x + (dx / d) * (r + 18);
        e.y = p.y + (dy / d) * (r + 18);
      }
      clampField(e, r);
    }
  }

  function hurtEnemy(a, e, dmg, kx, ky) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 0.12;
    const k = Math.hypot(kx, ky) || 1;
    const push = e.kind === "bear" ? 4 : 12;
    e.x += (kx / k) * push;
    e.y += (ky / k) * push;
    a.events.push("hit");
    if (e.hp <= 0) a.fx.push({ type: "text", x: e.x, y: e.y - 40, t: 0.8, text: "Down!" });
  }

  // Hits knock the player back, then give a moment of safety.
  function hurtPlayer(a, n, src) {
    const p = a.player;
    p.hp -= n;
    p.inv = FU.CONFIG.INVULNERABLE;
    if (src) {
      const d = Math.hypot(p.x - src.x, p.y - src.y) || 1;
      p.x += ((p.x - src.x) / d) * 45;
      p.y += ((p.y - src.y) / d) * 45;
      pushOut(p, 16, a.rocks);
      clampField(p, 16);
    }
    a.events.push("hurt");
    a.fx.push({ type: "text", x: p.x, y: p.y - 44, t: 0.9, text: "-" + n + " heart" + (n > 1 ? "s" : ""), bad: true });
  }

  // ---- Training: hit enough pop-up targets to gain a skill level ----
  FU.Drill = {
    // Harder each skill level: targets vanish faster.
    create(level) {
      const D = FU.CONFIG.DRILL;
      const life = Math.max(0.6, D.life - D.lifeStep * (level || 0));
      return { targets: [], spawned: 0, hits: 0, next: 0.8, life, total: D.targets, need: D.need, done: false, passed: false, events: [], fx: [] };
    },

    update(d, dt, rng) {
      if (d.done) return;
      const D = FU.CONFIG.DRILL;
      d.next -= dt;
      if (d.next <= 0 && d.spawned < d.total) {
        d.targets.push({ x: rng.int(80, W - 80), y: rng.int(80, H - 80), t: d.life, life: d.life });
        d.spawned += 1;
        d.next = D.gap + rng.next() * 0.3;
      }
      for (const t of d.targets) t.t -= dt;
      for (const t of d.targets) if (t.t <= 0) d.fx.push({ type: "text", x: t.x, y: t.y, t: 0.6, text: "Miss", bad: true });
      d.targets = d.targets.filter((t) => t.t > 0);
      for (const f of d.fx) f.t -= dt;
      d.fx = d.fx.filter((f) => f.t > 0);
      if (d.spawned >= d.total && d.targets.length === 0) {
        d.done = true;
        d.passed = d.hits >= d.need;
      }
    },

    click(d, x, y) {
      if (d.done) return;
      const D = FU.CONFIG.DRILL;
      d.events.push("revolver");
      for (const t of d.targets) {
        // Targets shrink as they fade, so quick shots are easier.
        if (Math.hypot(t.x - x, t.y - y) <= D.radius * (0.4 + 0.6 * (t.t / t.life))) {
          t.t = 0;
          d.hits += 1;
          d.events.push("hit");
          d.fx.push({ type: "text", x: t.x, y: t.y, t: 0.6, text: "Hit!" });
          d.targets = d.targets.filter((o) => o !== t);
          return;
        }
      }
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
