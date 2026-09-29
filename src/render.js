// Canvas drawing: the open world, fights and training.
(function (g) {
  const FU = (g.FU = g.FU || {});
  const A = () => FU.Assets;

  const INK = "#3b2f22";
  const STAR_COLORS = { 1: "#3d6b5a", 2: "#b86b0b", 3: "#8b2e2e" };

  FU.Renderer = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.w = 0;
    this.h = 0;
    this.flakes = [];
    for (let i = 0; i < 160; i++) this.flakes.push({ x: Math.random(), y: Math.random(), v: 0.03 + Math.random() * 0.05, r: 1 + Math.random() * 2 });
  };

  FU.Renderer.prototype.resize = function () {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // ---- World ----

  FU.Renderer.prototype.camera = function (s) {
    const wd = s.world;
    const x = Math.max(0, Math.min(wd.W - this.w, s.player.x - this.w / 2));
    const y = Math.max(0, Math.min(wd.H - this.h, s.player.y - this.h / 2));
    return { x: wd.W < this.w ? (wd.W - this.w) / 2 : x, y: wd.H < this.h ? (wd.H - this.h) / 2 : y };
  };

  // view: { working, buying, near, dt }
  FU.Renderer.prototype.drawWorld = function (s, view) {
    const ctx = this.ctx;
    const wd = s.world;
    const cam = this.camera(s);
    const frozen = FU.frozen(s);
    const visible = (x, y, m) => x > cam.x - m && x < cam.x + this.w + m && y > cam.y - m && y < cam.y + this.h + m;

    ctx.fillStyle = "#1e1812";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.fillStyle = mix([226, 219, 196], [238, 242, 246], frozen);
    ctx.fillRect(0, 0, wd.W, wd.H);

    // River, freezing over as time passes.
    ctx.save();
    ctx.lineWidth = FU.CONFIG.RIVER_HALF * 2;
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (let y = -20; y <= wd.H + 20; y += 20) {
      if (y === -20) ctx.moveTo(wd.riverX(y), y);
      else ctx.lineTo(wd.riverX(y), y);
    }
    ctx.strokeStyle = "#5b8fb9";
    ctx.stroke();
    ctx.globalAlpha = Math.min(0.85, frozen);
    ctx.strokeStyle = "#eef4f8";
    ctx.stroke();
    ctx.restore();

    for (const b of wd.bridges) {
      const half = FU.CONFIG.RIVER_HALF + 40;
      ctx.fillStyle = "#8a6440";
      ctx.fillRect(b.x - half, b.y - FU.CONFIG.BRIDGE_HALF, half * 2, FU.CONFIG.BRIDGE_HALF * 2);
      ctx.strokeStyle = "#5e4128";
      ctx.lineWidth = 2;
      for (let x = b.x - half + 10; x < b.x + half; x += 16) line(ctx, x, b.y - FU.CONFIG.BRIDGE_HALF, x, b.y + FU.CONFIG.BRIDGE_HALF);
    }

    for (const t of wd.trees) {
      if (visible(t.x, t.y, 40)) A().draw(ctx, "pine-tree", "#35523f", t.x, t.y - 8, 44 * t.s);
    }

    for (const t of wd.towns) {
      if (!visible(t.x, t.y, 120)) continue;
      const info = FU.TOWNS[t.kind];
      disc(ctx, t.x, t.y, 34, "#6b4f2a", INK);
      A().draw(ctx, info.icon, "#fff", t.x, t.y, 44);
      label(ctx, info.name, t.x, t.y + 48, 14, INK);
      if (t.kind === "dock") label(ctx, "Ticket: " + FU.CONFIG.TARGET_GOLD + " gold", t.x, t.y + 68, 12, INK);
    }

    for (const p of wd.places) {
      if (!visible(p.x, p.y, 120)) continue;
      const def = FU.PLACES[p.kind];
      const tier = FU.nextTier(p);
      const done = FU.placeDone(p);
      disc(ctx, p.x, p.y, 34, done ? "#9a917e" : STAR_COLORS[def.stars], INK);
      A().draw(ctx, def.icon, "#fff", p.x, p.y, 44);
      label(ctx, def.name + " " + "★".repeat(def.stars), p.x, p.y + 48, 14, INK);
      const sub = done ? "Conquered · patrol " + tier.reward + " gold" : "Tier " + FU.TIER_NAMES[p.tier] + " · up to " + tier.reward + " gold";
      label(ctx, sub, p.x, p.y + 67, 12, done ? "#7a6f5c" : INK);
      if (p.stash) label(ctx, p.stash + " gold to win back here", p.x, p.y - 48, 12, "#9b2c2c");
      else if (p.losses) label(ctx, "Lost here " + p.losses + "x (weaker now)", p.x, p.y - 48, 11, "#9b2c2c");
    }

    this.drawWalker(s, view);
    ctx.restore();

    this.drawSnow(frozen, view.dt || 0);
    this.drawMinimap(s, cam);
  };

  FU.Renderer.prototype.drawWalker = function (s, view) {
    const ctx = this.ctx;
    const p = s.player;
    const sackR = 5 + Math.sqrt(Math.max(0, s.gold)) * 1.3;
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 22, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4a017";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x - p.facing * 16, p.y + 8, sackR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    A().draw(ctx, "hiking", INK, p.x, p.y, 44, p.facing < 0);
    if (view.working || view.buying) {
      A().draw(ctx, "hourglass", view.working ? "#2f6b3a" : "#1f4e79", p.x, p.y - 44, 26);
      label(ctx, view.working ? "Working: time → gold" : "Buying time: gold → time", p.x, p.y - 66, 13, INK);
    }
  };

  FU.Renderer.prototype.drawMinimap = function (s, cam) {
    const ctx = this.ctx;
    const wd = s.world;
    const mw = Math.min(220, this.w * 0.3);
    const k = mw / wd.W;
    const mh = wd.H * k;
    const x0 = this.w - mw - 10;
    const y0 = 10;
    ctx.fillStyle = "rgba(239,228,200,0.92)";
    ctx.fillRect(x0, y0, mw, mh);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, mw, mh);
    ctx.strokeStyle = "#5b8fb9";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y <= wd.H; y += 40) {
      const px = x0 + wd.riverX(y) * k;
      if (y === 0) ctx.moveTo(px, y0 + y * k);
      else ctx.lineTo(px, y0 + y * k);
    }
    ctx.stroke();
    ctx.fillStyle = "#8a6440";
    for (const b of wd.bridges) ctx.fillRect(x0 + b.x * k - 5, y0 + b.y * k - 2, 10, 4);
    for (const p of wd.places) {
      ctx.fillStyle = FU.placeDone(p) ? "#9a917e" : STAR_COLORS[FU.PLACES[p.kind].stars];
      ctx.beginPath();
      ctx.arc(x0 + p.x * k, y0 + p.y * k, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#6b4f2a";
    for (const t of wd.towns) ctx.fillRect(x0 + t.x * k - 4, y0 + t.y * k - 4, 8, 8);
    ctx.fillStyle = "#1f4e79";
    const dock = wd.towns[2];
    ctx.fillRect(x0 + dock.x * k - 4, y0 + dock.y * k - 4, 8, 8);
    ctx.strokeStyle = "rgba(59,47,34,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + cam.x * k, y0 + cam.y * k, this.w * k, this.h * k);
    ctx.fillStyle = "#e0685a";
    ctx.beginPath();
    ctx.arc(x0 + s.player.x * k, y0 + s.player.y * k, 4, 0, Math.PI * 2);
    ctx.fill();
  };

  FU.Renderer.prototype.drawSnow = function (frozen, dt) {
    const ctx = this.ctx;
    const count = Math.floor(this.flakes.length * Math.max(0, frozen - 0.1));
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < count; i++) {
      const f = this.flakes[i];
      f.y += f.v * dt;
      if (f.y > 1) f.y -= 1;
      ctx.beginPath();
      ctx.arc(f.x * this.w + Math.sin((f.y + i) * 6) * 6, f.y * this.h, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ---- Fields (fight and training) ----

  FU.Renderer.prototype.fieldView = function () {
    const W = FU.Arena.W;
    const H = FU.Arena.H;
    const k = Math.min(this.w / W, this.h / H);
    return { k, ox: (this.w - W * k) / 2, oy: (this.h - H * k) / 2 };
  };

  FU.Renderer.prototype.toField = function (x, y) {
    const v = this.fieldView();
    return { x: (x - v.ox) / v.k, y: (y - v.oy) / v.k };
  };

  FU.Renderer.prototype.beginField = function (s, ice) {
    const ctx = this.ctx;
    const v = this.fieldView();
    ctx.fillStyle = "#1e1812";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.k, v.k);
    ctx.beginPath();
    ctx.rect(0, 0, FU.Arena.W, FU.Arena.H);
    ctx.clip();
    ctx.fillStyle = ice ? "#d6e6f0" : mix([226, 219, 196], [238, 242, 246], FU.frozen(s));
    ctx.fillRect(0, 0, FU.Arena.W, FU.Arena.H);
    if (ice) {
      // Cracks in the lake ice.
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const x = (i * 211) % FU.Arena.W;
        const y = (i * 137) % FU.Arena.H;
        line(ctx, x, y, x + 90, y + 40);
        line(ctx, x + 90, y + 40, x + 130, y + 10);
      }
    }
    ctx.strokeStyle = "rgba(59,47,34,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < FU.Arena.W; x += 60) line(ctx, x, 0, x, FU.Arena.H);
    for (let y = 0; y < FU.Arena.H; y += 60) line(ctx, 0, y, FU.Arena.W, y);
  };

  FU.Renderer.prototype.drawCrosshair = function (mouse, radius) {
    if (!mouse) return;
    const ctx = this.ctx;
    const m = this.toField(mouse.x, mouse.y);
    ctx.strokeStyle = "#9b2c2c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, radius || 12, 0, Math.PI * 2);
    ctx.moveTo(m.x - 18, m.y);
    ctx.lineTo(m.x + 18, m.y);
    ctx.moveTo(m.x, m.y - 18);
    ctx.lineTo(m.x, m.y + 18);
    ctx.stroke();
  };

  FU.Renderer.prototype.drawFight = function (s, a, mouse, help) {
    const ctx = this.ctx;
    this.beginField(s, a.ice);
    const p = a.player;

    for (const h of a.holes) disc(ctx, h.x, h.y, h.r, "#1f4e79", "#eef4f8");

    for (const k of a.rocks) {
      disc(ctx, k.x, k.y, k.r, "#8d8578", "#5d574e");
      A().draw(ctx, "stone-pile", "#6c655b", k.x, k.y, k.r * 1.6);
    }

    for (const b of a.bombs) {
      A().draw(ctx, "dynamite", "#8b1e1e", b.x, b.y, 32);
      ctx.strokeStyle = "rgba(155,44,44,0.5)";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, FU.WEAPONS.dynamite.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Enemies
    for (const e of a.enemies.slice().sort((m, n) => m.y - n.y)) {
      const def = FU.ENEMIES[e.kind];
      const shake = ["windup", "crouch", "slam"].includes(e.state) ? Math.sin(a.time * 60) * 3 : 0;
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + def.radius * 0.8, def.radius, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      if (e.state === "slam") {
        // Red circle that fills in as the slam gets closer.
        const k = 1 - e.stateT / def.slamWindup;
        ctx.fillStyle = "rgba(155,44,44," + (0.1 + 0.25 * k) + ")";
        ctx.strokeStyle = "rgba(155,44,44,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, def.slamRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (e.state === "windup") {
        ctx.strokeStyle = "rgba(155,44,44,0.6)";
        ctx.lineWidth = def.radius * 1.6;
        ctx.globalAlpha = 0.25;
        line(ctx, e.x, e.y, e.x + e.cx * 330, e.y + e.cy * 330);
        ctx.globalAlpha = 1;
      }
      A().draw(ctx, def.icon, e.flash > 0 ? "#ffffff" : e.rage ? "#8b1e1e" : def.color, e.x + shake, e.y, def.radius * 2.4, p.x < e.x);
      const bw = def.radius * 1.8;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(e.x - bw / 2, e.y - def.radius - 16, bw, 5);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(e.x - bw / 2, e.y - def.radius - 16, (bw * Math.max(0, e.hp)) / e.maxHp, 5);
      if (["aim", "crouch", "slam"].includes(e.state)) label(ctx, "!", e.x, e.y - def.radius - 30, 22, "#9b2c2c", true);
      if (e.state === "stun") label(ctx, "Stunned", e.x, e.y - def.radius - 30, 14, INK, true);
    }

    // Player
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 20, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const blink = p.inv > 0 && p.dash <= 0 && Math.floor(a.time * 20) % 2 === 0;
    const facingLeft = Math.cos(p.aim) < 0;
    if (!blink) {
      if (p.dash > 0) {
        ctx.fillStyle = "rgba(59,47,34,0.2)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
        ctx.fill();
      }
      A().draw(ctx, "hiking", INK, p.x, p.y, 44, facingLeft);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.aim);
      if (facingLeft) ctx.scale(1, -1);
      A().draw(ctx, FU.WEAPONS[a.weapon].icon, "#222", 26, 0, 30);
      ctx.restore();
    }

    for (const b of a.shots) disc(ctx, b.x, b.y, 3, "#f5c542", null);
    for (const b of a.foeShots) {
      ctx.strokeStyle = "rgba(155,44,44,0.35)";
      ctx.lineWidth = 3;
      line(ctx, b.x, b.y, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
      disc(ctx, b.x, b.y, 5, "#9b2c2c", null);
    }
    for (const f of a.fx) {
      if (f.type === "flash") disc(ctx, f.x, f.y, 10, "rgba(255,200,80,0.8)", null);
      else if (f.type === "boom") disc(ctx, f.x, f.y, f.r * (1.2 - f.t), "rgba(255,150,40," + f.t + ")", null);
      else if (f.type === "text") label(ctx, f.text, f.x, f.y - (1 - f.t) * 30, 18, f.bad ? "#9b2c2c" : "#2f6b3a", true);
    }

    // Field HUD
    for (let i = 0; i < p.maxHp; i++) A().draw(ctx, "hearts", i < p.hp ? "#c0392b" : "rgba(59,47,34,0.25)", 24 + i * 30, 24, 26);
    label(ctx, a.def.name + " " + (a.tierDef.patrol ? "patrol" : FU.TIER_NAMES[a.place.tier]) + " · wave " + Math.min(a.wave, a.waves.length) + " of " + a.waves.length + " · " + a.enemies.length + " left", FU.Arena.W / 2, 22, 15, INK);
    const bounty = FU.Arena.bounty(a);
    const full = bounty >= a.tierDef.reward;
    if (a.tierDef.reward) label(ctx, "Bounty: " + bounty + " gold" + (full ? " (" + Math.max(0, Math.ceil(a.tierDef.par - a.time)) + "s at full)" : " and dropping"), FU.Arena.W / 2, 48, 15, full ? "#2f6b3a" : "#9b2c2c", true);
    const w = FU.WEAPONS[a.weapon];
    let ammo = FU.Arena.ammoText(a, s, a.weapon);
    if (a.reloadLeft > 0) ammo = "reloading...";
    label(ctx, w.name + ": " + ammo, FU.Arena.W - 110, 22, 15, INK);
    const dashReady = p.dashCd <= 0;
    label(ctx, dashReady ? "Dash ready (Space)" : "Dash " + p.dashCd.toFixed(1) + "s", FU.Arena.W - 110, 46, 13, dashReady ? "#2f6b3a" : "#7a6f5c");
    if (a.shotsFired) {
      const acc = Math.round(FU.Arena.accuracy(a) * 100);
      const cut = FU.Arena.accuracyFactor(a) < 1;
      label(ctx, "Accuracy " + acc + "%" + (cut ? " (bounty cut)" : ""), FU.Arena.W - 110, 68, 13, cut ? "#9b2c2c" : "#2f6b3a");
    }
    if (help) {
      label(ctx, "WASD move · Mouse aim · Click to shoot (quick clicks spread) · Space dash · R reload · 1–3 weapons", FU.Arena.W / 2, FU.Arena.H - 20, 14, INK);
      label(ctx, "No running away. " + a.def.tip + " Enemies show \"!\" before they attack.", FU.Arena.W / 2, FU.Arena.H - 44, 13, INK);
    }
    // The crosshair widens with bloom: quick clicking spreads your shots.
    this.drawCrosshair(mouse, a.weapon === "dynamite" ? 20 : 12 + a.bloom * 160);
    ctx.restore();
  };

  FU.Renderer.prototype.drawDrill = function (s, d, mouse) {
    const ctx = this.ctx;
    this.beginField(s);
    const D = FU.CONFIG.DRILL;
    for (const t of d.targets) {
      const r = D.radius * (0.4 + 0.6 * (t.t / t.life));
      disc(ctx, t.x, t.y, r, "#fff", "#9b2c2c");
      A().draw(ctx, "bullseye", "#9b2c2c", t.x, t.y, r * 2);
    }
    for (const f of d.fx) label(ctx, f.text, f.x, f.y - (0.6 - f.t) * 40, 18, f.bad ? "#9b2c2c" : "#2f6b3a", true);
    const missed = d.spawned - d.hits - d.targets.length;
    label(ctx, "TRAINING: hit " + d.need + " of " + d.total + " targets. Quick shots count: targets shrink.", FU.Arena.W / 2, 24, 16, INK);
    label(ctx, "Hits " + d.hits + " · Misses " + missed + " · Left " + (d.total - d.spawned + d.targets.length), FU.Arena.W / 2, 50, 15, INK);
    this.drawCrosshair(mouse, 10);
    ctx.restore();
  };

  // ---- Helpers ----

  function disc(ctx, x, y, r, fill, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function label(ctx, text, x, y, size, color, bold) {
    ctx.font = (bold ? "bold " : "") + size + "px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (!bold) {
      const w = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(239,228,200,0.85)";
      ctx.fillRect(x - w / 2 - 4, y - size / 2 - 3, w + 8, size + 6);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function mix(a, b, t) {
    const k = Math.max(0, Math.min(1, t));
    return "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",") + ")";
  }
})(typeof window !== "undefined" ? window : globalThis);
