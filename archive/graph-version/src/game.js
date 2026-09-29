// Game rules. No DOM here, so tools/sim.js can run it under Node.
(function (g) {
  const FU = (g.FU = g.FU || {});

  const EVENTS = [
    { weight: 3, kind: "bad", apply: (s) => ((s.hours -= 3), "The river flooded. You waited 3 hours.") },
    { weight: 2, kind: "bad", apply: (s) => ((s.hours -= 5), "A snowstorm hit. You lost 5 hours.") },
    {
      weight: 2,
      kind: "bad",
      apply(s) {
        const lost = Math.floor(s.gold * 0.2);
        s.gold -= lost;
        return lost ? "A pickpocket took " + lost + " gold from your bag." : "A pickpocket found your bag empty.";
      },
    },
    {
      weight: 3,
      kind: "good",
      apply(s, rng) {
        const n = rng.int(4, 8);
        s.gold += n;
        return "You found a gold nugget! +" + n + " gold.";
      },
    },
    { weight: 2, kind: "good", apply: (s) => ((s.gold += 3), "An old camp had 3 gold left behind.") },
    { weight: 2, kind: "good", apply: (s) => ((s.tripMult *= 0.6), "A trapper shows you a shortcut. Your next trip is 40% faster.") },
    { weight: 2, kind: "bad", apply: (s) => ((s.tripMult *= 1.3), "Your boot broke. Your next trip is 30% slower.") },
    { weight: 2, kind: "good", apply: (s) => ((s.ammo.bullets += 6), "A hunter gives you 6 bullets.") },
  ];

  function log(s, text, kind) {
    s.log.push({ text, kind: kind || "info" });
    if (s.log.length > 40) s.log.shift();
  }
  FU.log = log;

  // Any text works as a map code. Numbers are used as they are.
  FU.seedFromCode = function (code) {
    const text = String(code).trim().toLowerCase();
    if (/^\d+$/.test(text)) return Number(text) % 4294967296;
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  };

  FU.newGame = function (code) {
    const C = FU.CONFIG;
    const seed = FU.seedFromCode(code);
    const rng = FU.makeRng(seed);
    // Rebuild until the map is fair: winnable with good play, but not trivial.
    // Same code always gives the same tries, so the same map.
    let map = null;
    let spare = -1;
    for (let i = 0; i < C.MAX_MAP_TRIES; i++) {
      const m = FU.generateMap(rng);
      const sp = FU.solveMap(m);
      if (sp > spare) {
        map = m;
        spare = sp;
      }
      if (sp >= C.MIN_SPARE_HOURS && sp <= C.MAX_SPARE_HOURS) {
        map = m;
        spare = sp;
        break;
      }
    }
    const s = {
      code: String(code).trim().toLowerCase(),
      rng,
      map,
      spare, // best-route spare hours, from the solver
      current: 0,
      path: [0],
      hours: C.START_HOURS,
      gold: C.START_GOLD,
      banked: 0,
      debts: [], // { amount, stops }
      tripMult: 1,
      revealed: C.VISIBLE_AHEAD,
      weapons: { knife: true, revolver: true, shotgun: false, dynamite: true },
      ammo: { bullets: 12, shells: 0, dynamite: 0 },
      idleSec: 0,
      thinkingHours: 0,
      fightHours: 0,
      fights: 0,
      status: "playing", // playing | won | lost
      endReason: "",
      score: 0,
      grade: "",
      log: [],
    };
    log(s, "Get to Dawson Dock with " + C.TARGET_GOLD + " gold before the river freezes.");
    return s;
  };

  FU.node = function (s, id) {
    return s.map.nodes[id === undefined ? s.current : id];
  };

  FU.visibleLayer = function (s) {
    return Math.max(s.revealed, FU.node(s).layer + FU.CONFIG.VISIBLE_AHEAD);
  };

  FU.frozen = function (s) {
    return 1 - Math.max(0, s.hours) / FU.CONFIG.START_HOURS;
  };

  FU.edgeTo = function (s, toId) {
    return FU.node(s).out.find((e) => e.to === toId);
  };

  FU.canTravel = function (s, toId) {
    return s.status === "playing" && !!FU.edgeTo(s, toId);
  };

  // Every way to make this trip, with its time, price and whether it is allowed.
  FU.tripOptions = function (s, toId) {
    const edge = FU.edgeTo(s, toId);
    if (!edge) return [];
    const offers = FU.node(s).transports;
    const list = [];
    for (const [id, t] of Object.entries(FU.TRANSPORT)) {
      if (!(id in offers)) continue;
      if (t.river && !edge.river) continue;
      const price = offers[id];
      const slow = 1 + (t.weight * s.gold) / FU.CONFIG.WEIGHT_K;
      const hours = (edge.miles / t.speed) * slow * s.tripMult;
      let why = "";
      if (t.river && FU.frozen(s) >= t.closesAt) why = "River has too much ice";
      else if (price > s.gold) why = "Not enough gold";
      list.push({ id, name: t.name, icon: t.icon, price, hours, slow, danger: dangerOf(s, t), ok: !why, why });
    }
    return list;
  };

  function dangerOf(s, t) {
    return Math.min(0.9, t.danger + Math.min(0.2, s.gold / 150));
  }

  FU.dangerLabel = function (p) {
    return p < 0.25 ? "Low" : p < 0.45 ? "Medium" : "High";
  };

  // Pays for the trip and decides if something attacks on the way.
  FU.beginTrip = function (s, toId, transportId) {
    const opt = FU.tripOptions(s, toId).find((o) => o.id === transportId);
    if (!opt || !opt.ok || s.status !== "playing") return null;
    s.gold -= opt.price;
    s.idleSec = 0;
    const trip = { from: s.current, to: toId, transport: transportId, hours: opt.hours, fight: null };
    if (s.rng.chance(opt.danger)) trip.fight = rollEnemies(s, transportId);
    return trip;
  };

  function rollEnemies(s, transportId) {
    const weights = transportId === "canoe" ? { bandit: 1 } : { wolf: 4, bandit: 3 + s.gold / 10, bear: 1.5 };
    const kind = s.rng.weighted(weights);
    const e = FU.ENEMIES[kind];
    return { kind, count: s.rng.int(e.group[0], e.group[1]) };
  }

  FU.finishTrip = function (s, trip) {
    if (s.status !== "playing") return;
    const t = FU.TRANSPORT[trip.transport];
    s.hours -= trip.hours;
    s.tripMult = 1;
    s.idleSec = 0;
    s.current = trip.to;
    s.path.push(trip.to);
    log(s, t.name + " to " + FU.STOPS[FU.node(s).type].name + ": " + FU.fmtHours(trip.hours) + ".");
    if (!checkClock(s, "The river froze while you were travelling.")) return;
    arrive(s);
  };

  // Choices when attacked, before the fight starts.
  FU.fightChoices = function (s, fight) {
    const C = FU.CONFIG;
    const list = [{ id: "fight", label: "Fight", ok: true }];
    list.push({ id: "run", label: "Run away (" + C.RUN_HOURS + "h)", ok: true });
    if (fight.kind === "bandit") {
      const pay = Math.max(3, Math.ceil(s.gold * C.PAY_SHARE));
      list.push({ id: "pay", label: "Pay them (" + pay + " gold)", ok: s.gold >= pay, pay });
    }
    return list;
  };

  FU.avoidFight = function (s, fight, choice) {
    const C = FU.CONFIG;
    if (choice === "run") {
      s.hours -= C.RUN_HOURS;
      log(s, "You ran and lost " + C.RUN_HOURS + " hours.", "bad");
      checkClock(s, "The river froze while you ran.");
    } else if (choice === "pay") {
      const pay = FU.fightChoices(s, fight).find((c) => c.id === "pay").pay;
      s.gold -= pay;
      log(s, "You paid the bandits " + pay + " gold.", "bad");
    }
  };

  function arrive(s) {
    const n = FU.node(s);

    for (const d of s.debts) d.stops -= 1;
    const due = s.debts.filter((d) => d.stops <= 0);
    s.debts = s.debts.filter((d) => d.stops > 0);
    for (const d of due) {
      let owed = d.amount;
      const fromBag = Math.min(owed, s.gold);
      s.gold -= fromBag;
      owed -= fromBag;
      const fromBank = Math.min(owed, s.banked);
      s.banked -= fromBank;
      owed -= fromBank;
      if (owed > 0) {
        lose(s, "The loan shark found you " + owed + " gold short.");
        return;
      }
      log(s, "The loan shark took his " + d.amount + " gold.", "bad");
    }

    if (n.type === "unknown") {
      const weights = {};
      EVENTS.forEach((e, i) => (weights[i] = e.weight));
      const ev = EVENTS[Number(s.rng.weighted(weights))];
      log(s, ev.apply(s, s.rng), ev.kind);
      n.used = true;
      if (!checkClock(s, "The river froze while you were stuck.")) return;
    }

    if (n.type === "dock") finish(s);
  }

  FU.actions = function (s) {
    const C = FU.CONFIG;
    const n = FU.node(s);
    const p = n.params;
    if (n.type === "store") {
      return FU.STORE_ITEMS.map((it) => ({
        id: "buy:" + it.id,
        label: "Buy " + it.label + " (" + it.price + " gold)",
        enabled: s.gold >= it.price && !(it.weapon && s.weapons[it.weapon]),
      }));
    }
    if (n.used) return [];
    switch (n.type) {
      case "mine":
        return [{ id: "dig", label: "Dig (" + p.hours + "h)", enabled: s.hours > p.hours }];
      case "camp":
        return [{ id: "work", label: "Work (" + p.hours + "h)", enabled: s.hours > p.hours }];
      case "bank":
        return [{ id: "deposit", label: "Put all gold in the bank (" + C.BANK_HOURS + "h)", enabled: s.gold > 0 && s.hours > C.BANK_HOURS }];
      case "shark":
        return [{ id: "borrow", label: "Borrow " + C.LOAN_AMOUNT + " gold", enabled: true }];
      case "cards":
        return [{ id: "bet", label: "Bet " + C.BET_AMOUNT + " gold (" + C.BET_HOURS + "h)", enabled: s.gold >= C.BET_AMOUNT && s.hours > C.BET_HOURS }];
    }
    return [];
  };

  // Returns a sound name for the UI, or null.
  FU.doAction = function (s, id) {
    const C = FU.CONFIG;
    const n = FU.node(s);
    const p = n.params;
    const action = FU.actions(s).find((a) => a.id === id);
    if (!action || !action.enabled || s.status !== "playing") return null;
    s.idleSec = 0;
    let sound = "coins";

    if (id.startsWith("buy:")) {
      const it = FU.STORE_ITEMS.find((x) => "buy:" + x.id === id);
      s.gold -= it.price;
      if (it.weapon) s.weapons[it.weapon] = true;
      for (const [k, v] of Object.entries(it.give || {})) s.ammo[k] += v;
      log(s, "You bought " + it.label + ".");
      return sound;
    }

    n.used = true;
    switch (id) {
      case "dig": {
        s.hours -= p.hours;
        const found = s.rng.int(p.min, p.max);
        s.gold += found;
        log(s, "You dug for " + p.hours + " hours and found " + found + " gold.", found >= (p.min + p.max) / 2 ? "good" : "bad");
        sound = "dig";
        break;
      }
      case "work":
        s.hours -= p.hours;
        s.gold += p.pay;
        log(s, "You worked " + p.hours + " hours and earned " + p.pay + " gold.", "good");
        sound = "dig";
        break;
      case "deposit": {
        s.hours -= C.BANK_HOURS;
        const fee = Math.ceil(s.gold * C.BANK_FEE);
        s.banked += s.gold - fee;
        log(s, "You put " + (s.gold - fee) + " gold in the bank (fee " + fee + "). Your bag is light.", "good");
        s.gold = 0;
        break;
      }
      case "borrow":
        s.gold += C.LOAN_AMOUNT;
        s.debts.push({ amount: C.LOAN_REPAY, stops: C.LOAN_STOPS });
        log(s, "You borrowed " + C.LOAN_AMOUNT + " gold. Pay back " + C.LOAN_REPAY + " in " + C.LOAN_STOPS + " stops.");
        break;
      case "bet":
        s.hours -= C.BET_HOURS;
        s.gold -= C.BET_AMOUNT;
        if (s.rng.chance(C.BET_WIN_CHANCE)) {
          s.gold += C.BET_PAYOUT;
          log(s, "You won the hand! +" + C.BET_PAYOUT + " gold.", "good");
        } else {
          log(s, "You lost the hand and " + C.BET_AMOUNT + " gold.", "bad");
          sound = "error";
        }
        break;
    }
    checkClock(s, "The river froze while you worked.");
    return sound;
  };

  FU.drop = function (s) {
    if (s.status !== "playing" || s.gold <= 0) return;
    const amount = Math.min(FU.CONFIG.DROP_AMOUNT, s.gold);
    s.gold -= amount;
    s.idleSec = 0;
    log(s, "You dropped " + amount + " gold in the snow to move faster.", "bad");
  };

  FU.canBuyMap = function (s) {
    const C = FU.CONFIG;
    return s.status === "playing" && s.gold >= C.MAP_COST && FU.visibleLayer(s) < C.LAYERS + 1;
  };

  FU.buyMap = function (s) {
    const C = FU.CONFIG;
    if (!FU.canBuyMap(s)) return;
    s.gold -= C.MAP_COST;
    s.revealed = FU.visibleLayer(s) + C.MAP_REVEAL;
    s.idleSec = 0;
    log(s, "You bought a map for " + C.MAP_COST + " gold.");
  };

  // Runs every frame while the player is choosing. Returns true once the clock is burning.
  FU.tickHesitation = function (s, dtSec) {
    const C = FU.CONFIG;
    if (s.status !== "playing") return false;
    s.idleSec += dtSec;
    if (s.idleSec <= C.HESITATION_GRACE_SEC) return false;
    const burn = dtSec * C.HESITATION_HOURS_PER_SEC;
    s.hours -= burn;
    s.thinkingHours += burn;
    checkClock(s, "You stood thinking until the river froze.");
    return true;
  };

  function checkClock(s, reason) {
    if (s.hours > 0) return true;
    s.hours = 0;
    lose(s, reason);
    return false;
  }
  FU.checkClock = checkClock;

  function lose(s, reason) {
    s.status = "lost";
    s.endReason = reason;
    log(s, reason, "bad");
  }

  function finish(s) {
    const C = FU.CONFIG;
    const total = s.gold + s.banked;
    if (total < C.TARGET_GOLD) {
      lose(s, "You reached the dock with " + total + " gold. The ticket home costs " + C.TARGET_GOLD + ".");
      return;
    }
    s.status = "won";
    s.endReason = "You caught the last boat with " + total + " gold and " + FU.fmtHours(s.hours) + " to spare.";
    s.score = Math.round((total - C.TARGET_GOLD) * 10 + s.hours * 5);
    s.grade = s.score >= 300 ? "S" : s.score >= 200 ? "A" : s.score >= 120 ? "B" : "C";
    log(s, s.endReason, "good");
  }

  FU.fmtHours = function (h) {
    const total = Math.max(0, Math.round(h * 60));
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    if (hh === 0) return mm + "m";
    return hh + "h" + (mm ? " " + String(mm).padStart(2, "0") + "m" : "");
  };
})(typeof window !== "undefined" ? window : globalThis);
