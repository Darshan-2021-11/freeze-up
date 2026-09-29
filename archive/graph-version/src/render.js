// Draws the map, travel and fights on the canvas.
(function (g) {
  const FU = (g.FU = g.FU || {});
  const A = () => FU.Assets;

  const COLORS = {
    paper: [239, 228, 200],
    snow: [233, 239, 244],
    ink: "#3b2f22",
    inkSoft: "rgba(59,47,34,0.3)",
    path: "#9b2c2c",
    fog: "#b9ad93",
    river: "#5b8fb9",
    ice: "#eef4f8",
    tree: "#35523f",
    gold: "#d4a017",
  };
  const RIVER_X = 0.93;
  const NODE_R = 22;

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

  FU.Renderer.prototype.pos = function (node) {
    const padY = 46;
    return { x: node.x * this.w, y: padY + node.y * (this.h - padY * 2) };
  };

  FU.Renderer.prototype.hit = function (s, x, y) {
    for (const n of s.map.nodes) {
      const p = this.pos(n);
      if (Math.hypot(p.x - x, p.y - y) <= NODE_R + 6) return n.id;
    }
    return null;
  };

  // view: { hoverId, selectedId, reachable, travel: { trip, t } | null, dt }
  FU.Renderer.prototype.drawMap = function (s, view) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const frozen = FU.frozen(s);
    const visible = FU.visibleLayer(s);
    const current = FU.node(s);

    ctx.fillStyle = mix(COLORS.paper, COLORS.snow, frozen);
    ctx.fillRect(0, 0, w, h);

    this.drawRivers(s, frozen);

    for (const t of s.map.trees) {
      A().draw(ctx, "pine-tree", COLORS.tree, t.x * w, 46 + t.y * (h - 92), 26 * t.s);
    }

    // Routes
    const onPath = new Set();
    for (let i = 1; i < s.path.length; i++) onPath.add(s.path[i - 1] + ">" + s.path[i]);
    for (const n of s.map.nodes) {
      for (const e of n.out) {
        const to = s.map.nodes[e.to];
        if (to.layer > visible + 1 && to.type !== "dock") continue;
        const a = this.pos(n);
        const b = this.pos(to);
        const traveled = onPath.has(n.id + ">" + to.id);
        const reach = n.id === current.id && s.status === "playing" && !view.travel;
        ctx.save();
        if (traveled) {
          ctx.strokeStyle = COLORS.path;
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
        } else if (reach) {
          ctx.strokeStyle = e.river ? "#2e6a99" : COLORS.ink;
          ctx.lineWidth = view.hoverId === to.id || view.selectedId === to.id ? 4.5 : 2.5;
          ctx.setLineDash([10, 5]);
        } else {
          ctx.strokeStyle = COLORS.inkSoft;
          ctx.lineWidth = 1.5;
          ctx.setLineDash(to.layer > visible ? [2, 6] : [6, 6]);
        }
        line(ctx, a.x, a.y, b.x, b.y);
        ctx.restore();
        if (reach) {
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          label(ctx, e.miles + " mi", mx, my - 9, 12, COLORS.ink);
          if (e.river && current.transports.canoe !== undefined) A().draw(ctx, "canoe", "#2e6a99", mx, my + 9, 18);
        }
      }
    }

    // Stops
    const keyOf = {};
    view.reachable.forEach((id, i) => (keyOf[id] = i + 1));
    for (const n of s.map.nodes) {
      const p = this.pos(n);
      const info = FU.STOPS[n.type];
      const hidden = n.layer > visible && n.type !== "dock";
      ctx.beginPath();
      ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2);
      if (hidden) {
        ctx.fillStyle = COLORS.fog;
        ctx.fill();
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = COLORS.inkSoft;
        ctx.stroke();
        ctx.restore();
        label(ctx, "?", p.x, p.y, 18, "#fff", true);
        continue;
      }
      const done = n.used && n.type !== "store";
      ctx.fillStyle = done ? shade(info.color) : info.color;
      ctx.fill();
      const lit = keyOf[n.id] !== undefined;
      ctx.lineWidth = lit ? 3.5 : 1.5;
      ctx.strokeStyle = lit && (view.hoverId === n.id || view.selectedId === n.id) ? COLORS.gold : COLORS.ink;
      ctx.stroke();
      A().draw(ctx, info.icon, "#fff", p.x, p.y, 28);
      label(ctx, info.name, p.x, p.y + NODE_R + 12, 12, COLORS.ink);
      if (lit) label(ctx, String(keyOf[n.id]), p.x + NODE_R + 8, p.y - NODE_R + 2, 13, COLORS.ink, true);
    }

    this.drawPlayer(s, view);
    this.drawSnow(frozen, view.dt || 0);
  };

  FU.Renderer.prototype.drawRivers = function (s, frozen) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const x0 = RIVER_X * w;

    // Creek along the bottom: canoe routes follow it.
    const y0 = 46 + (FU.CONFIG.RIVER_Y + 0.14) * (h - 92);
    ctx.save();
    ctx.strokeStyle = COLORS.river;
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = 0; x <= x0; x += 10) {
      const y = y0 + Math.sin(x / 90) * 10;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = Math.min(0.9, frozen * 1.2);
    ctx.strokeStyle = COLORS.ice;
    ctx.stroke();
    ctx.restore();

    // The Yukon on the right freezes from the top as time runs out.
    ctx.fillStyle = COLORS.river;
    ctx.fillRect(x0, 0, w - x0, h);
    ctx.fillStyle = COLORS.ice;
    ctx.fillRect(x0, 0, w - x0, h * frozen);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    line(ctx, x0, 0, x0, h);
    ctx.save();
    ctx.translate(x0 + (w - x0) / 2, h / 2);
    ctx.rotate(-Math.PI / 2);
    label(ctx, "YUKON RIVER", 0, 0, 13, COLORS.ink, true);
    ctx.restore();
  };

  FU.Renderer.prototype.drawPlayer = function (s, view) {
    const ctx = this.ctx;
    let p = this.pos(FU.node(s));
    let icon = "hiking";
    if (view.travel) {
      const a = this.pos(FU.node(s, view.travel.trip.from));
      const b = this.pos(FU.node(s, view.travel.trip.to));
      const t = easeInOut(Math.min(1, view.travel.t));
      p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      icon = view.travel.trip.transport === "walk" ? "hiking" : FU.TRANSPORT[view.travel.trip.transport].icon;
    }
    const x = view.travel ? p.x : p.x - NODE_R - 14;
    const y = view.travel ? p.y - 4 : p.y - 8;
    // The gold sack grows with the gold you carry.
    const sackR = 4 + Math.sqrt(Math.max(0, s.gold)) * 1.5;
    ctx.fillStyle = COLORS.gold;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x - 12, y + 12, sackR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(239,228,200,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fill();
    A().draw(ctx, icon, COLORS.ink, x, y, 30);
  };

  FU.Renderer.prototype.drawSnow = function (frozen, dt) {
    const ctx = this.ctx;
    const count = Math.floor(this.flakes.length * Math.max(0, frozen - 0.15));
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

  // ---- Fights ----

  FU.Renderer.prototype.fightView = function () {
    const W = FU.Combat.W;
    const H = FU.Combat.H;
    const k = Math.min(this.w / W, this.h / H);
    return { k, ox: (this.w - W * k) / 2, oy: (this.h - H * k) / 2 };
  };

  FU.Renderer.prototype.toField = function (x, y) {
    const v = this.fightView();
    return { x: (x - v.ox) / v.k, y: (y - v.oy) / v.k };
  };

  FU.Renderer.prototype.drawFight = function (s, c, mouse, showHelp) {
    const ctx = this.ctx;
    const W = FU.Combat.W;
    const H = FU.Combat.H;
    const P = FU.Combat.PLAYER;
    const v = this.fightView();
    const frozen = FU.frozen(s);

    ctx.fillStyle = "#1e1812";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.k, v.k);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    const sky = ctx.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, "#7d93a8");
    sky.addColorStop(1, mix([214, 205, 186], [226, 233, 240], frozen));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) A().draw(ctx, "pine-tree", "#3e5a4a", 30 + i * 70, 175, 70 + (i % 3) * 14);
    ctx.fillStyle = mix([224, 214, 190], [240, 244, 247], frozen);
    ctx.fillRect(0, 205, W, H - 205);

    // Player
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(P.x, P.y + 38, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    A().draw(ctx, "hiking", COLORS.ink, P.x, P.y, 84);
    A().draw(ctx, FU.WEAPONS[c.weapon].icon, "#222", P.x + 44, P.y - 4, 40);
    if (c.reloadLeft > 0) label(ctx, "Reloading...", P.x, P.y - 70, 16, COLORS.ink, false);

    // Enemies, farthest first
    const color = { wolf: "#4b4f57", bandit: "#6b2020", bear: "#5a3b22" };
    const list = c.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of list) {
      const def = FU.ENEMIES[e.kind];
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + def.size * 0.45, def.size * 0.4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      A().draw(ctx, def.icon, e.flash > 0 ? "#ffffff" : color[e.kind], e.x, e.y, def.size, e.kind === "wolf");
      const bw = def.size * 0.7;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(e.x - bw / 2, e.y - def.size / 2 - 12, bw, 6);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(e.x - bw / 2, e.y - def.size / 2 - 12, (bw * e.hp) / e.maxHp, 6);
    }

    for (const b of c.bombs) {
      A().draw(ctx, "dynamite", "#8b1e1e", b.x, b.y, 34);
      label(ctx, b.t.toFixed(1), b.x, b.y - 26, 13, COLORS.ink, true);
    }

    for (const f of c.fx) {
      if (f.type === "shot") {
        ctx.strokeStyle = "rgba(255,200,80," + f.t / 0.15 + ")";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 14 + (0.15 - f.t) * 80, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.type === "boom") {
        ctx.fillStyle = "rgba(255,150,40," + f.t + ")";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1.2 - f.t), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === "text") {
        label(ctx, f.text, f.x, f.y - (1 - f.t) * 30, 20, f.bad ? "#9b2c2c" : "#2f6b3a", true);
      }
    }

    const def = FU.ENEMIES[c.kind];
    const warn = def.stealGold ? "Each hit steals " + def.stealGold + " gold" : "Each hit costs you " + FU.fmtHours(def.hurtHours);
    label(ctx, (c.enemies.length > 1 ? def.plural + " attack! " : "A " + def.name.toLowerCase() + " attacks! ") + warn + ". Every second of fighting costs 5 min.", W / 2, 22, 16, COLORS.ink, false);
    if (showHelp) {
      label(ctx, "Click an enemy to attack. R = reload. 1–4 = change weapon. The knife only reaches close enemies.", W / 2, 48, 15, COLORS.ink, false);
    }

    // Crosshair
    if (mouse) {
      const m = this.toField(mouse.x, mouse.y);
      const w = FU.WEAPONS[c.weapon];
      ctx.strokeStyle = "#9b2c2c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, w.radius || 12, 0, Math.PI * 2);
      ctx.moveTo(m.x - 18, m.y);
      ctx.lineTo(m.x + 18, m.y);
      ctx.moveTo(m.x, m.y - 18);
      ctx.lineTo(m.x, m.y + 18);
      ctx.stroke();
    }
    ctx.restore();
  };

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

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const m = (c) => Math.round(c * 0.5 + 75);
    return "rgb(" + m(n >> 16) + "," + m((n >> 8) & 255) + "," + m(n & 255) + ")";
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
})(typeof window !== "undefined" ? window : globalThis);
