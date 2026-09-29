// Checks that a map can be won. Plays every route with perfect knowledge,
// using typical results in place of luck (digs, fights).
// The map generator throws away maps whose best route has too little
// spare time, so every map code is winnable with good play.
(function (g) {
  const FU = (g.FU = g.FU || {});

  const GOLD_CAP = 80;

  // Luck is replaced by typical outcomes for a good player (see CONFIG.SOLVER).
  function digGold(p) {
    return p.min + Math.floor((p.max - p.min) * FU.CONFIG.SOLVER.digShare);
  }

  // Returns the most hours a perfect player can have left at the dock
  // with enough gold, or -1 if the map cannot be won.
  FU.solveMap = function (map) {
    const C = FU.CONFIG;
    const S = C.SOLVER;
    const best = map.nodes.map(() => new Map()); // "carried|banked" -> hours
    const put = function (id, carried, banked, hours) {
      if (hours <= 0) return;
      carried = Math.min(GOLD_CAP, Math.max(0, carried));
      banked = Math.min(GOLD_CAP, banked);
      const key = carried + "|" + banked;
      const old = best[id].get(key);
      if (old === undefined || hours > old) best[id].set(key, hours);
    };
    put(0, C.START_GOLD, 0, C.START_HOURS);

    let result = -1;
    for (const row of map.layers) {
      for (const n of row) {
        for (const [key, hours0] of best[n.id]) {
          const [c0, b0] = key.split("|").map(Number);
          if (n.type === "dock") {
            if (c0 + b0 >= C.TARGET_GOLD) result = Math.max(result, hours0);
            continue;
          }
          // What the player can do here (or skip).
          const after = [[c0, b0, hours0 - S.thinkHours]];
          const p = n.params;
          if (n.type === "mine") after.push([c0 + digGold(p), b0, hours0 - S.thinkHours - p.hours]);
          if (n.type === "camp") after.push([c0 + p.pay, b0, hours0 - S.thinkHours - p.hours]);
          if (n.type === "bank" && c0 > 0) {
            const fee = Math.ceil(c0 * C.BANK_FEE);
            after.push([0, b0 + c0 - fee, hours0 - S.thinkHours - C.BANK_HOURS]);
          }

          for (const [c, b, h] of after) {
            if (h <= 0) continue;
            const frozen = 1 - h / C.START_HOURS;
            for (const e of n.out) {
              for (const [tid, price] of Object.entries(n.transports)) {
                const t = FU.TRANSPORT[tid];
                if (price > c) continue;
                if (t.river && (!e.river || frozen >= t.closesAt)) continue;
                const left = c - price;
                const travel = (e.miles / t.speed) * (1 + (t.weight * left) / C.WEIGHT_K);
                const danger = Math.min(0.9, t.danger + Math.min(0.2, left / 150));
                const lost = Math.round(danger * S.fightGold);
                put(e.to, left - lost, b, h - travel - danger * S.fightHours);
              }
            }
          }
        }
      }
    }
    return result;
  };
})(typeof window !== "undefined" ? window : globalThis);
