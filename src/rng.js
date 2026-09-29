// Seeded random numbers so a run can be replayed from its seed.
(function (g) {
  const FU = (g.FU = g.FU || {});

  FU.makeRng = function (seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int(min, max) {
        return min + Math.floor(next() * (max - min + 1));
      },
      chance(p) {
        return next() < p;
      },
      pick(list) {
        return list[Math.floor(next() * list.length)];
      },
      weighted(weights) {
        const keys = Object.keys(weights);
        let total = 0;
        for (const k of keys) total += weights[k];
        let r = next() * total;
        for (const k of keys) {
          r -= weights[k];
          if (r < 0) return k;
        }
        return keys[keys.length - 1];
      },
    };
  };

  const WORDS = ["gold", "wolf", "bear", "snow", "river", "moose", "pine", "nugget", "sled", "boat", "creek", "frost"];

  // Short, easy-to-share map code like "wolf-4821".
  FU.randomCode = function () {
    return WORDS[Math.floor(Math.random() * WORDS.length)] + "-" + (1000 + Math.floor(Math.random() * 9000));
  };
})(typeof window !== "undefined" ? window : globalThis);
