// Tuning constants. Time is in game hours, money is in gold.
(function (g) {
  const FU = (g.FU = g.FU || {});

  FU.CONFIG = {
    START_HOURS: 50,
    START_GOLD: 10,
    TARGET_GOLD: 260,

    // The clock always runs: in the world, in shops, in fights and in training.
    CLOCK_RATE: 0.1, // game hours per real second (10 real seconds = 1 hour)

    WORLD_W: 3200,
    WORLD_H: 2000,
    WALK_SPEED: 230, // pixels per second with an empty bag
    WEIGHT_K: 200, // 200 gold in the bag halves your speed
    TREE_COUNT: 240,
    RIVER_HALF: 55,
    BRIDGE_HALF: 55,

    // Losing a fight.
    LOSE_SHARE: 0.25,
    LOSE_MIN: 3,
    MERCY: 0.1, // each loss at a place: enemies get 10% less health

    // Optional training at a Shooting Range. Pass the drill to gain a skill level.
    TRAINING: {
      gold: 5, // price of the first session
      goldStep: 4, // each level costs this much more
      hours: 2,
      maxLevel: 5,
      // Per skill level:
      crit: 0.06, // chance of a double-damage hit
      fireRate: 0.05, // shorter time between shots
      reload: 0.08, // shorter reloads
    },
    DRILL: { targets: 12, need: 8, life: 1.4, lifeStep: 0.12, gap: 0.6, radius: 34 },

    // The player's trade ability. Going back and forth always loses.
    WORK_RATE: 1, // Q: 1 hour of work -> 1 gold
    BUY_RATE: 4, // E: 4 gold -> 1 hour
    CONVERT_SPEED: 4, // hours converted per real second while the key is held

    START_HEARTS: 5,
    MAX_HEARTS: 9,
    INVULNERABLE: 1.0, // seconds after being hit
    DASH_TIME: 0.18,
    DASH_COOLDOWN: 1.1,
    DASH_SPEED: 3.2,
    ARENA_SPEED: 260,
  };

  // Five unique fight places. Each has three tiers: win one to unlock the next.
  // waves: exact enemies per wave. reward: full bounty. par: seconds before the
  // bounty starts to drop. speed: enemy speed boost for that tier.
  FU.PLACES = {
    den: {
      name: "Wolf Den",
      icon: "direwolf",
      stars: 1,
      tip: "Wolves crouch before they lunge. Dash sideways.",
      tiers: [
        { waves: [{ wolf: 3 }], reward: 12, par: 7 },
        { waves: [{ wolf: 6 }], reward: 18, par: 9 },
        { waves: [{ wolf: 5 }, { wolf: 6 }], reward: 26, par: 15, speed: 1.25 },
      ],
    },
    camp: {
      name: "Bandit Camp",
      icon: "tipi",
      stars: 2,
      tip: "Bandits shout \"!\" before they shoot. Hide behind rocks.",
      tiers: [
        { waves: [{ bandit: 2, wolf: 1 }], reward: 16, par: 10 },
        { waves: [{ bandit: 3, wolf: 2 }], reward: 24, par: 12 },
        { waves: [{ bandit: 3 }, { bandit: 2, wolf: 2 }], reward: 34, par: 20, speed: 1.1 },
      ],
    },
    cave: {
      name: "Bear Cave",
      icon: "mountain-cave",
      stars: 2,
      tip: "Bears glow red before they charge. Make them crash into a rock.",
      tiers: [
        { waves: [{ bear: 1 }], reward: 18, par: 10 },
        { waves: [{ bear: 1, wolf: 3 }], reward: 26, par: 13 },
        { waves: [{ bear: 2, wolf: 1 }], reward: 38, par: 16, speed: 1.15 },
      ],
    },
    lake: {
      name: "Frozen Lake",
      icon: "snowflake-2",
      stars: 2,
      ice: true,
      tip: "The ice is slippery: you keep sliding. Start moving early.",
      tiers: [
        { waves: [{ wolf: 4 }], reward: 16, par: 8 },
        { waves: [{ wolf: 4, bandit: 2 }], reward: 24, par: 12 },
        { waves: [{ wolf: 5 }, { wolf: 3, bandit: 3 }], reward: 34, par: 18, speed: 1.15 },
      ],
    },
    fort: {
      name: "Jumpers' Fort",
      icon: "military-fort",
      stars: 3,
      tip: "Everything at once. The boss fires three bullets at a time.",
      tiers: [
        { waves: [{ bandit: 2, wolf: 2 }, { bandit: 1, bear: 1 }], reward: 32, par: 22 },
        { waves: [{ bandit: 2, wolf: 2 }, { bandit: 2, bear: 1 }], reward: 44, par: 24 },
        { waves: [{ bandit: 2, wolf: 1 }, { boss: 1, bandit: 1 }], reward: 60, par: 26 },
      ],
    },
  };
  FU.PLACE_ORDER = ["den", "camp", "cave", "lake", "fort"];
  FU.TIER_NAMES = ["I", "II", "III"];

  // Bounty clock: full reward until par, then it drops to BOUNTY_FLOOR at 3x par.
  FU.BOUNTY_FLOOR = 0.5;

  FU.TOWNS = {
    cabin: { name: "Your Cabin", icon: "wood-cabin" },
    post: { name: "Trading Post", icon: "shop" },
    range: { name: "Shooting Range", icon: "bullseye" },
    dock: { name: "Dawson Dock", icon: "paddle-steamer", priceMult: 1.5 },
  };

  FU.WEAPONS = {
    revolver: { name: "Revolver", icon: "revolver", dmg: 1, cooldown: 0.26, mag: 6, reload: 1.1, spread: 0.05, pellets: 1, speed: 900, range: 900 },
    shotgun: { name: "Shotgun", icon: "sawed-off-shotgun", dmg: 1, cooldown: 0.7, mag: 2, reload: 1.5, spread: 0.22, pellets: 6, speed: 800, range: 380, ammo: "shells" },
    dynamite: { name: "Dynamite", icon: "dynamite", dmg: 5, cooldown: 0.9, fuse: 0.9, radius: 115, ammo: "dynamite" },
  };

  FU.STORE_ITEMS = [
    { id: "shells", label: "4 shotgun shells", price: 3, give: { shells: 4 } },
    { id: "dynamite", label: "1 dynamite", price: 3, give: { dynamite: 1 } },
    { id: "shotgun", label: "Shotgun", price: 15, weapon: "shotgun" },
    { id: "heart", label: "+1 heart (for good)", price: 12, heart: true },
  ];

  FU.ENEMIES = {
    wolf: {
      name: "Wolf",
      plural: "Wolves",
      icon: "direwolf",
      color: "#4b4f57",
      hp: 2,
      speed: 185,
      radius: 22,
      touch: 1,
      // Bite: crouch (warning), lunge, back off.
      reach: 55,
      windup: 0.35,
      lungeSpeed: 520,
      lungeTime: 0.22,
      recover: 0.45,
      attackEvery: 1.2,
    },
    bandit: {
      name: "Bandit",
      plural: "Bandits",
      icon: "bandit",
      color: "#6b2020",
      hp: 4,
      speed: 110,
      radius: 22,
      touch: 1,
      shootEvery: [1.0, 1.8],
      windup: 0.3,
      bulletSpeed: 430,
      lead: 0.7, // how well they aim ahead of a moving player
      keep: [230, 340],
    },
    boss: {
      name: "Claim Jumper Boss",
      plural: "Bosses",
      icon: "bandit",
      color: "#2b1010",
      hp: 18,
      speed: 95,
      radius: 32,
      touch: 1,
      shootEvery: [1.2, 1.8],
      windup: 0.45,
      bulletSpeed: 400,
      lead: 0.5,
      keep: [220, 320],
      shots: 3, // bullets per volley, fanned out
    },
    bear: {
      name: "Bear",
      plural: "Bears",
      icon: "polar-bear",
      color: "#5a3b22",
      hp: 16,
      speed: 85,
      radius: 40,
      touch: 2,
      chargeEvery: [3, 4.5],
      windup: 0.6,
      chargeSpeed: 430,
      chargeTime: 0.7,
      // Swipe when close: raise a paw (warning), then hit.
      reach: 30,
      swipeWindup: 0.5,
      attackEvery: 1.6,
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
