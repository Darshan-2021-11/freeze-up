// The open world: a river with bridges, towns, fight places and trees.
// Built from the map code, so the same code gives the same world.
(function (g) {
  const FU = (g.FU = g.FU || {});

  FU.generateWorld = function (rng) {
    const C = FU.CONFIG;
    const W = C.WORLD_W;
    const H = C.WORLD_H;

    const river = { cx: W * 0.5 + rng.int(-150, 150), phase: rng.next() * 6.28, amp: rng.int(60, 110) };
    const riverX = (y) => river.cx + Math.sin(y / 230 + river.phase) * river.amp;

    // Three bridges, one in each third of the river.
    const bridges = [0, 1, 2].map((i) => ({ y: Math.round(H * (0.12 + 0.3 * i) + rng.int(0, Math.round(H * 0.16))) }));
    bridges.forEach((b) => (b.x = riverX(b.y)));

    const towns = [
      { kind: "cabin", x: 170, y: rng.int(500, H - 500) },
      { kind: "post", x: Math.round(riverX(bridges[1].y) - 330), y: bridges[1].y + rng.pick([-160, 160]) },
      { kind: "dock", x: W - 170, y: rng.int(500, H - 500) },
    ];
    // One shooting range, west of the river.
    for (let tries = 0; tries < 300; tries++) {
      const x = rng.int(420, Math.round(W * 0.38));
      const y = rng.int(200, H - 200);
      if (Math.abs(x - riverX(y)) < C.RIVER_HALF + 200) continue;
      if (towns.some((t) => Math.hypot(t.x - x, t.y - y) < 380)) continue;
      towns.push({ kind: "range", x, y });
      break;
    }

    const blocked = (x, y, gap) => Math.abs(x - riverX(y)) < C.RIVER_HALF + gap;
    const far = (list, x, y, d) => list.every((p) => Math.hypot(p.x - x, p.y - y) >= d);

    // Five unique places, spread out, away from the river and towns.
    const spots = [];
    for (let tries = 0; spots.length < FU.PLACE_ORDER.length && tries < 4000; tries++) {
      const x = rng.int(260, W - 260);
      const y = rng.int(160, H - 160);
      if (blocked(x, y, 150)) continue;
      if (!far(towns, x, y, 330) || !far(spots, x, y, 480)) continue;
      spots.push({ x, y });
    }
    // Easier places nearer the cabin, with a little shuffle.
    spots.forEach((p) => (p.key = p.x + rng.int(-300, 300)));
    spots.sort((a, b) => a.key - b.key);
    const places = spots.map((p, i) => ({
      id: i,
      kind: FU.PLACE_ORDER[i],
      x: p.x,
      y: p.y,
      tier: 0, // next tier to fight; 3 means conquered
      losses: 0, // losses at the current tier
      stash: 0, // gold you dropped here; won back with the next win
    }));

    const trees = [];
    for (let tries = 0; trees.length < C.TREE_COUNT && tries < 6000; tries++) {
      const x = rng.int(20, W - 20);
      const y = rng.int(20, H - 20);
      if (blocked(x, y, 30)) continue;
      if (!far(towns, x, y, 150) || !far(places, x, y, 130) || !far(trees, x, y, 46)) continue;
      if (bridges.some((b) => Math.abs(y - b.y) < 120 && Math.abs(x - b.x) < 260)) continue;
      trees.push({ x, y, s: 0.8 + rng.next() * 0.5 });
    }

    return { W, H, river, bridges, towns, places, trees, riverX };
  };

  // The exact enemies of one tier, as a list of kinds per wave.
  FU.tierWaves = function (kind, tier) {
    return FU.PLACES[kind].tiers[tier].waves.map(function (w) {
      const list = [];
      for (const [k, n] of Object.entries(w)) for (let i = 0; i < n; i++) list.push(k);
      return list;
    });
  };

  FU.onBridge = function (world, y) {
    return world.bridges.some((b) => Math.abs(y - b.y) < FU.CONFIG.BRIDGE_HALF - 12);
  };

  function free(world, x, y, r) {
    const C = FU.CONFIG;
    if (x < r || y < r || x > world.W - r || y > world.H - r) return false;
    if (Math.abs(x - world.riverX(y)) < C.RIVER_HALF + r && !FU.onBridge(world, y)) return false;
    for (const t of world.trees) {
      if (Math.abs(t.x - x) < 40 && Math.abs(t.y - y) < 40 && Math.hypot(t.x - x, t.y - y) < 14 * t.s + r) return false;
    }
    return true;
  }

  // Moves the player, sliding along whatever blocks the way.
  FU.moveInWorld = function (world, p, dx, dy) {
    const r = 14;
    if (free(world, p.x + dx, p.y, r)) p.x += dx;
    if (free(world, p.x, p.y + dy, r)) p.y += dy;
  };

  // The place or town the player stands next to, if any.
  FU.nearby = function (world, p) {
    for (const t of world.towns) if (Math.hypot(t.x - p.x, t.y - p.y) < 80) return { type: "town", item: t };
    for (const pl of world.places) if (Math.hypot(pl.x - p.x, pl.y - p.y) < 80) return { type: "place", item: pl };
    return null;
  };
})(typeof window !== "undefined" ? window : globalThis);
