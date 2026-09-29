// Game rules. No DOM here.
(function (g) {
  const FU = (g.FU = g.FU || {});

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
    const rng = FU.makeRng(FU.seedFromCode(code));
    const world = FU.generateWorld(rng);
    const cabin = world.towns[0];
    const s = {
      code: String(code).trim().toLowerCase(),
      rng,
      world,
      player: { x: cabin.x + 60, y: cabin.y, facing: 1 },
      hours: C.START_HOURS,
      clock: 0, // game hours passed (for places filling up again)
      gold: C.START_GOLD,
      maxHearts: C.START_HEARTS,
      skill: 0,
      weapons: { revolver: true, shotgun: false, dynamite: true },
      ammo: { shells: 0, dynamite: 2 },
      workAcc: 0,
      buyAcc: 0,
      stats: { fights: 0, wins: 0, losses: 0, tiers: 0, trainings: 0, worked: 0, bought: 0 },
      status: "playing", // playing | won | lost
      endReason: "",
      score: 0,
      grade: "",
      log: [],
    };
    log(s, "Reach Dawson Dock with " + C.TARGET_GOLD + " gold before the river freezes.");
    return s;
  };

  FU.frozen = function (s) {
    return Math.min(1, s.clock / FU.CONFIG.FREEZE_HOUR);
  };

  // Rough hours to walk from the player to a point (straight line plus detours).
  FU.hoursToWalk = function (s, x, y) {
    return ((Math.hypot(x - s.player.x, y - s.player.y) * 1.3) / FU.walkSpeed(s)) * FU.CONFIG.CLOCK_RATE;
  };

  // Hours that can still be bought before the final freeze.
  FU.buyableHours = function (s) {
    return Math.max(0, FU.CONFIG.FREEZE_HOUR - s.clock - s.hours);
  };

  // Time passing. Returns false once time has run out.
  FU.spend = function (s, hours) {
    s.hours -= hours;
    s.clock += hours;
    if (s.hours > 0) return true;
    s.hours = 0;
    if (s.status === "playing") lose(s, "The river froze. The last boat left without you.");
    return false;
  };

  FU.walkSpeed = function (s) {
    const C = FU.CONFIG;
    return C.WALK_SPEED / (1 + s.gold / C.WEIGHT_K);
  };

  // ---- The trade ability ----

  // Today's rates. Both rise as the freeze gets closer; buying always costs more.
  FU.workRate = function (s) {
    const r = FU.CONFIG.WORK_RATE;
    return r[0] + (r[1] - r[0]) * FU.frozen(s);
  };
  FU.buyRate = function (s) {
    const r = FU.CONFIG.BUY_RATE;
    return r[0] + (r[1] - r[0]) * FU.frozen(s);
  };

  // Q held: turn time into gold. Stops before the last hour.
  FU.work = function (s, dt) {
    const C = FU.CONFIG;
    const step = Math.min(C.CONVERT_SPEED * dt, s.hours - 1);
    if (step <= 0) return false;
    FU.spend(s, step);
    s.stats.worked += step;
    s.workAcc += step * FU.workRate(s);
    let got = false;
    while (s.workAcc >= 1) {
      s.workAcc -= 1;
      s.gold += 1;
      got = true;
    }
    return got;
  };

  // E held: turn gold into time.
  FU.buyTime = function (s, dt) {
    const C = FU.CONFIG;
    if (s.gold <= 0) return false;
    const rate = FU.buyRate(s);
    s.buyAcc += C.CONVERT_SPEED * rate * dt;
    let spent = false;
    while (s.buyAcc >= 1 && s.gold > 0 && FU.buyableHours(s) >= 1 / rate) {
      s.buyAcc -= 1;
      s.gold -= 1;
      s.hours += 1 / rate;
      s.stats.bought += 1 / rate;
      spent = true;
    }
    return spent;
  };

  // ---- Places ----

  FU.bountyFloor = function (reward) {
    return Math.max(Math.round(reward * FU.BOUNTY_FLOOR), Math.min(reward, FU.BOUNTY_MIN));
  };

  FU.placeDone = function (place) {
    return place.tier >= FU.PLACES[place.kind].tiers.length;
  };

  // The fight the player would take next: the next tier, or a patrol once conquered.
  FU.nextTier = function (place) {
    const tiers = FU.PLACES[place.kind].tiers;
    if (!FU.placeDone(place)) return tiers[place.tier];
    return { waves: tiers[0].waves, reward: FU.PATROL_REWARD, par: tiers[0].par, patrol: true };
  };

  FU.tierLabel = function (place) {
    return FU.placeDone(place) ? "patrol" : "tier " + FU.TIER_NAMES[place.tier];
  };

  // bounty: what the bounty clock showed when the fight ended. A small random bonus on top.
  // Returns { reward, stash }: the bounty won and the dropped gold recovered.
  FU.winFight = function (s, place, bounty) {
    const reward = bounty + s.rng.int(0, 2);
    const stash = place.stash;
    const label = FU.tierLabel(place);
    s.gold += reward + stash;
    place.stash = 0;
    place.losses = 0;
    s.stats.wins += 1;
    if (!FU.placeDone(place)) {
      place.tier += 1;
      s.stats.tiers += 1;
    }
    log(s, "You beat " + FU.PLACES[place.kind].name + " " + label + " and took " + reward + " gold" + (stash ? ", plus " + stash + " you dropped here" : "") + ".", "good");
    return { reward, stash };
  };

  FU.loseFight = function (s, place) {
    const C = FU.CONFIG;
    const tier = FU.nextTier(place);
    const lost = Math.min(s.gold, Math.ceil(tier.reward * C.LOSE_BOUNTY_SHARE));
    const kept = Math.floor(lost * C.STASH_SHARE);
    s.gold -= lost;
    place.stash += kept;
    place.losses = Math.min(3, place.losses + 1);
    s.stats.losses += 1;
    log(s, "You lost " + lost + " gold at " + FU.PLACES[place.kind].name + ". " + kept + " of it can be won back there.", "bad");
    return { lost, kept };
  };

  // Most gold still to be won on the map: full bounties of every open tier plus stashes.
  FU.goldOnMap = function (s) {
    let total = 0;
    for (const p of s.world.places) {
      total += p.stash;
      const tiers = FU.PLACES[p.kind].tiers;
      for (let i = p.tier; i < tiers.length; i++) total += tiers[i].reward;
    }
    return total;
  };

  // ---- Training (optional, at a Shooting Range) ----

  FU.trainingCost = function (s) {
    const T = FU.CONFIG.TRAINING;
    return { gold: T.gold + T.goldStep * s.skill, hours: T.hours };
  };

  // Why the player can't train right now, or "" if they can.
  FU.cantTrain = function (s) {
    if (s.skill >= FU.CONFIG.TRAINING.maxLevel) return "You are fully trained";
    if (s.gold < FU.trainingCost(s).gold) return "Not enough gold";
    return "";
  };

  FU.startTraining = function (s) {
    if (FU.cantTrain(s)) return false;
    const cost = FU.trainingCost(s);
    s.gold -= cost.gold;
    s.stats.trainings += 1;
    log(s, "You paid " + cost.gold + " gold to train.");
    return FU.spend(s, cost.hours);
  };

  FU.finishTraining = function (s, passed) {
    if (!passed) {
      log(s, "Training failed. No new skill this time.", "bad");
      return;
    }
    s.skill += 1;
    log(s, "Training passed! Skill level " + s.skill + ".", "good");
  };

  // ---- Towns ----

  // Prices depend on the town: Dawson charges more.
  FU.storeItems = function (s, town) {
    const C = FU.CONFIG;
    const mult = (town && FU.TOWNS[town.kind].priceMult) || 1;
    return FU.STORE_ITEMS.map((base) => {
      const it = Object.assign({}, base, { price: Math.ceil(base.price * mult) });
      let ok = s.gold >= it.price;
      let why = ok ? "" : "Not enough gold";
      if (it.weapon && s.weapons[it.weapon]) {
        ok = false;
        why = "You have it";
      }
      if (it.heart && s.maxHearts >= C.MAX_HEARTS) {
        ok = false;
        why = "Max hearts";
      }
      return Object.assign({}, it, { ok, why });
    });
  };

  FU.buy = function (s, id, town) {
    const it = FU.storeItems(s, town).find((x) => x.id === id);
    if (!it || !it.ok || s.status !== "playing") return false;
    s.gold -= it.price;
    if (it.weapon) s.weapons[it.weapon] = true;
    if (it.heart) s.maxHearts += 1;
    for (const [k, v] of Object.entries(it.give || {})) s.ammo[k] += v;
    log(s, "You bought " + it.label + " for " + it.price + " gold.");
    return true;
  };

  // At the dock: board the boat if you can pay.
  FU.board = function (s) {
    const C = FU.CONFIG;
    if (s.status !== "playing") return false;
    if (s.gold < C.TARGET_GOLD) {
      log(s, "The ticket costs " + C.TARGET_GOLD + " gold. You have " + s.gold + ".", "bad");
      return false;
    }
    s.status = "won";
    s.endReason = "You caught the last boat home with " + s.gold + " gold and " + FU.fmtHours(s.hours) + " to spare.";
    s.score = Math.round((s.gold - C.TARGET_GOLD) * 5 + s.hours * 10 + s.stats.tiers * 15);
    s.grade = s.score >= 300 ? "S" : s.score >= 180 ? "A" : s.score >= 80 ? "B" : "C";
    log(s, s.endReason, "good");
    return true;
  };

  function lose(s, reason) {
    s.status = "lost";
    s.endReason = reason;
    log(s, reason, "bad");
  }

  FU.fmtHours = function (h) {
    const total = Math.max(0, Math.round(h * 60));
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    if (hh === 0) return mm + "m";
    return hh + "h" + (mm ? " " + String(mm).padStart(2, "0") + "m" : "");
  };
})(typeof window !== "undefined" ? window : globalThis);
