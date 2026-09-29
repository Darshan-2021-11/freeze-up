// Tuning constants. Time is in game hours, money is in gold.
(function (g) {
  const FU = (g.FU = g.FU || {});

  FU.CONFIG = {
    START_HOURS: 100,
    START_GOLD: 8,
    TARGET_GOLD: 30,

    LAYERS: 8, // stops between the cabin and the dock
    MIN_NODES: 2,
    MAX_NODES: 4,
    VISIBLE_AHEAD: 2, // rows you can see past your own
    MAP_COST: 3,
    MAP_REVEAL: 2,

    ROUTE_MILES: [9, 21],
    RIVER_Y: 0.7, // stops below this line sit by the river
    WEIGHT_K: 60, // 60 gold in the bag doubles walking time
    DROP_AMOUNT: 5,

    // Standing still to think burns time.
    HESITATION_GRACE_SEC: 3,
    HESITATION_HOURS_PER_SEC: 1 / 12, // 5 game minutes per real second
    FIGHT_HOURS_PER_SEC: 1 / 12,

    BANK_HOURS: 1,
    BANK_FEE: 0.1,
    LOAN_AMOUNT: 12,
    LOAN_REPAY: 18,
    LOAN_STOPS: 3,
    BET_AMOUNT: 5,
    BET_WIN_CHANCE: 0.4,
    BET_PAYOUT: 13,
    BET_HOURS: 1,

    RUN_HOURS: 3, // running from a fight
    PAY_SHARE: 0.4, // bandits take this share of bag gold if you pay them

    // Share of each stop type on every map (the rest become mines, camps, unknowns).
    STOP_MIX: { mine: 0.24, camp: 0.14, bank: 0.12, store: 0.1, shark: 0.08, cards: 0.08, unknown: 0.18 },

    // Map check: the best route must leave this much spare time (see solver.js).
    // Maps outside the range are thrown away and rebuilt from the same code.
    MIN_SPARE_HOURS: 8,
    MAX_SPARE_HOURS: 18,
    MAX_MAP_TRIES: 60,
    SOLVER: {
      thinkHours: 0.25, // time lost deciding at each stop
      fightHours: 0.9, // average time one attack costs
      fightGold: 1, // average gold lost to one attack
      digShare: 0.5, // dig result: this far from min to max
    },
  };

  // speed in miles per hour; weight: how much bag gold slows it (1 = fully).
  FU.TRANSPORT = {
    walk: { name: "Walk", icon: "walking-boot", speed: 3, weight: 1, danger: 0.45, price: [0, 0], chance: 1 },
    horse: { name: "Horse", icon: "horse-head", speed: 6, weight: 0.5, danger: 0.3, price: [2, 4], chance: 0.55 },
    sled: { name: "Dog sled", icon: "sitting-dog", speed: 9, weight: 0, danger: 0.2, price: [5, 8], chance: 0.4 },
    canoe: { name: "Canoe", icon: "canoe", speed: 10, weight: 0, danger: 0.15, price: [3, 5], chance: 1, river: true, closesAt: 0.65 },
  };

  FU.STOPS = {
    start: { name: "Your Cabin", icon: "wood-cabin", color: "#6b4f2a" },
    dock: { name: "Dawson Dock", icon: "paddle-steamer", color: "#1f4e79" },
    mine: { name: "Gold Mine", icon: "gold-mine", color: "#b8860b" },
    camp: { name: "Work Camp", icon: "axe-in-log", color: "#7a5230" },
    bank: { name: "Bank", icon: "bank", color: "#4a4a7a" },
    shark: { name: "Loan Shark", icon: "shark-jaws", color: "#8b2e2e" },
    cards: { name: "Card Game", icon: "poker-hand", color: "#6a2f5f" },
    store: { name: "General Store", icon: "shop", color: "#3d6b5a" },
    unknown: { name: "Unknown", icon: "campfire", color: "#555555" },
  };

  // Guns and what they fire. mag = shots before a reload.
  FU.WEAPONS = {
    knife: { name: "Knife", icon: "bowie-knife", dmg: 1, cooldown: 0.35, reach: 190, sound: "knife" },
    revolver: { name: "Revolver", icon: "revolver", dmg: 2, cooldown: 0.3, mag: 6, reload: 1.4, ammo: "bullets", sound: "revolver" },
    shotgun: { name: "Shotgun", icon: "sawed-off-shotgun", dmg: 3, cooldown: 0.55, mag: 2, reload: 1.8, ammo: "shells", radius: 75, sound: "shotgun" },
    dynamite: { name: "Dynamite", icon: "dynamite", dmg: 6, cooldown: 0.8, ammo: "dynamite", radius: 115, fuse: 0.6, sound: "dynamite" },
  };

  FU.STORE_ITEMS = [
    { id: "bullets", label: "6 bullets", price: 1, give: { bullets: 6 } },
    { id: "shells", label: "4 shells", price: 2, give: { shells: 4 } },
    { id: "dynamite", label: "1 dynamite", price: 2, give: { dynamite: 1 } },
    { id: "shotgun", label: "Shotgun", price: 10, weapon: "shotgun" },
  ];

  // effect: what one hit on you costs. loot: gold dropped when beaten.
  FU.ENEMIES = {
    wolf: { name: "Wolf", plural: "Wolves", icon: "direwolf", hp: 2, speed: 170, hitEvery: 0.9, hurtHours: 0.75, size: 70, group: [2, 4] },
    bandit: { name: "Bandit", plural: "Bandits", icon: "bandit", hp: 3, speed: 95, hitEvery: 1.3, stealGold: 3, loot: [2, 4], size: 76, group: [1, 3] },
    bear: { name: "Bear", plural: "Bears", icon: "polar-bear", hp: 9, speed: 55, hitEvery: 1.8, hurtHours: 3, size: 120, group: [1, 1] },
  };
})(typeof window !== "undefined" ? window : globalThis);
