// Builds the map: one cabin, LAYERS rows of stops, one dock.
// Each stop decides which ways to travel it offers and their prices.
(function (g) {
  const FU = (g.FU = g.FU || {});

  function rollParams(type, rng) {
    switch (type) {
      case "mine": {
        const lo = rng.int(2, 4);
        return { hours: rng.pick([5, 6, 7]), min: lo, max: lo + rng.int(5, 8) };
      }
      case "camp":
        return { hours: 8, pay: rng.int(6, 8) };
      default:
        return {};
    }
  }

  // A fixed mix of stop types per map, so no map is flooded with one kind.
  function dealTypes(rng, rowSizes) {
    const C = FU.CONFIG;
    const total = rowSizes.reduce((a, b) => a + b, 0);
    const bag = {};
    let dealt = 0;
    for (const [type, share] of Object.entries(C.STOP_MIX)) {
      bag[type] = Math.floor(total * share);
      dealt += bag[type];
    }
    const fill = ["mine", "camp", "unknown"];
    for (let i = 0; dealt < total; i++, dealt++) bag[fill[i % fill.length]]++;

    const rows = [];
    rowSizes.forEach(function (size, r) {
      const layer = r + 1;
      const row = [];
      for (let i = 0; i < size; i++) {
        const allowed = {};
        for (const [type, left] of Object.entries(bag)) {
          if (left <= 0) continue;
          if (row.filter((x) => x === type).length >= Math.max(1, Math.floor(size / 2))) continue;
          if ((type === "bank" || type === "shark") && layer === 1) continue;
          if (type === "shark" && layer >= C.LAYERS - 1) continue; // no stops left to repay
          allowed[type] = left;
        }
        const type = Object.keys(allowed).length ? rng.weighted(allowed) : rng.pick(["mine", "camp"]);
        if (bag[type] > 0) bag[type]--;
        row.push(type);
      }
      rows.push(row);
    });
    return rows;
  }

  function rollTransports(node, rng) {
    const offers = {};
    for (const [id, t] of Object.entries(FU.TRANSPORT)) {
      if (t.river) {
        if (node.riverside) offers[id] = rng.int(t.price[0], t.price[1]);
      } else if (rng.chance(t.chance)) {
        offers[id] = rng.int(t.price[0], t.price[1]);
      }
    }
    return offers;
  }

  FU.generateMap = function (rng) {
    const C = FU.CONFIG;
    const layers = [];
    const nodes = [];
    const addNode = function (layer, type) {
      const node = { id: nodes.length, layer, type, params: rollParams(type, rng), x: 0, y: 0, out: [], used: false };
      nodes.push(node);
      return node;
    };

    layers.push([addNode(0, "start")]);
    const sizes = [];
    for (let l = 1; l <= C.LAYERS; l++) sizes.push(rng.int(C.MIN_NODES, C.MAX_NODES));
    dealTypes(rng, sizes).forEach(function (types, r) {
      layers.push(types.map((type) => addNode(r + 1, type)));
    });
    layers.push([addNode(C.LAYERS + 1, "dock")]);

    ensureType(layers, "store", 1, 3, rng);
    ensureType(layers, "mine", 1, 3, rng);
    ensureType(layers, "bank", 3, C.LAYERS - 1, rng);

    // Positions are 0..1. x by row, y spread with a little jitter.
    const lastIndex = layers.length - 1;
    layers.forEach(function (row, l) {
      row.forEach(function (node, i) {
        node.x = 0.06 + (0.82 * l) / lastIndex;
        const slot = (i + 1) / (row.length + 1);
        node.y = row.length === 1 ? 0.5 : slot + (rng.next() - 0.5) * (0.5 / (row.length + 1));
        node.riverside = node.y >= C.RIVER_Y;
      });
    });
    for (const n of nodes) n.transports = n.type === "dock" ? {} : rollTransports(n, rng);

    // Routes: link each stop to the closest stops in the next row, then
    // make sure every stop can be reached.
    for (let l = 0; l < lastIndex; l++) {
      const a = layers[l];
      const b = layers[l + 1];
      const hasIn = new Set();
      const link = function (from, to) {
        if (from.out.some((e) => e.to === to.id)) return;
        from.out.push({ to: to.id, miles: rng.int(C.ROUTE_MILES[0], C.ROUTE_MILES[1]), river: from.riverside && to.riverside });
        hasIn.add(to.id);
      };
      const rankOf = function (i) {
        return a.length === 1 ? (b.length - 1) / 2 : (i * (b.length - 1)) / (a.length - 1);
      };
      a.forEach(function (from, i) {
        const r = rankOf(i);
        link(from, b[Math.floor(r)]);
        link(from, b[Math.ceil(r)]);
        if (rng.chance(0.35)) {
          const extra = Math.min(b.length - 1, Math.max(0, Math.round(r) + rng.pick([-1, 1])));
          link(from, b[extra]);
        }
      });
      b.forEach(function (to, j) {
        if (hasIn.has(to.id)) return;
        let best = 0;
        let bestDist = Infinity;
        a.forEach(function (_, i) {
          const d = Math.abs(rankOf(i) - j);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        link(a[best], to);
      });
    }

    // Trees for decoration, kept away from stops.
    const trees = [];
    for (let i = 0; i < 70; i++) {
      const t = { x: 0.02 + rng.next() * 0.88, y: 0.03 + rng.next() * 0.94, s: 0.7 + rng.next() * 0.6 };
      if (t.y > C.RIVER_Y + 0.12) continue;
      if (nodes.every((n) => Math.hypot(n.x - t.x, (n.y - t.y) * 0.6) > 0.06)) trees.push(t);
    }

    return { nodes, layers, trees };
  };

  function ensureType(layers, type, fromLayer, toLayer, rng) {
    for (let l = fromLayer; l <= toLayer; l++) {
      if (layers[l].some((n) => n.type === type)) return;
    }
    const row = layers[rng.int(fromLayer, toLayer)];
    const keep = ["store", "mine", "bank"];
    const free = row.filter((n) => !keep.includes(n.type));
    const node = rng.pick(free.length ? free : row);
    node.type = type;
    node.params = rollParams(type, rng);
  }
})(typeof window !== "undefined" ? window : globalThis);
