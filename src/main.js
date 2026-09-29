// Wires input, screens and the frame loop together.
(function () {
  const FU = window.FU;
  const C = FU.CONFIG;
  FU.Assets.load();

  const canvas = document.getElementById("map");
  const renderer = new FU.Renderer(canvas);

  const params = new URLSearchParams(location.search);
  let s = FU.newGame(params.get("code") || params.get("seed") || FU.randomCode());

  // title | tutorial | world | place | store | message | fight | drill | paused | ended
  let mode = "title";
  let resumeMode = "world";
  let arena = null;
  let drill = null;
  let place = null; // the place being fought
  let town = null; // the shop that is open
  let onMessage = null;
  let onSecond = null; // second button's action, if any
  let hasSecond = false;
  let helpLeft = 0;
  let mouse = null;
  let mouseDown = false;
  let clicked = false; // a click since the last frame: one shot per click
  let working = false;
  let buying = false;
  let coinTimer = 0;
  let stepTimer = 0;
  let last = performance.now();
  const keys = new Set();
  const pressed = new Set(); // keys pressed since the last frame

  const play = (name, vol) => FU.Assets.play(name, vol);
  const CLOCK_MODES = ["world", "place", "store", "range", "fight", "drill"];

  function storage(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
  }

  function startGame(code, difficulty) {
    s = FU.newGame(String(code || "").trim() || FU.randomCode(), difficulty || s.difficulty);
    arena = null;
    drill = null;
    FU.UI.logCount = -1;
    FU.UI.hideOverlays();
    FU.UI.hidePopup();
    try {
      history.replaceState(null, "", "?code=" + encodeURIComponent(s.code));
    } catch (e) {
      // file:// pages may refuse; the code still shows on screen.
    }
    renderer.resize();
    if (!storage("freezeup2-tutorial")) {
      storage("freezeup2-tutorial", "1");
      mode = "tutorial";
      FU.UI.openTutorial(() => setMode("world"));
    } else {
      setMode("world");
    }
  }

  function setMode(m) {
    mode = m;
    last = performance.now();
  }

  function checkEnd() {
    if (s.status === "playing" || mode === "ended") return;
    mode = "ended";
    FU.UI.hidePopup();
    FU.UI.setPrompt(null);
    play(s.status === "won" ? "bell" : "error", 0.7);
    setTimeout(() => FU.UI.showEnd(s), 700);
  }

  // A popup with one button, or two when `second` is { label, then }.
  function message(title, text, button, icon, then, second) {
    onMessage = then;
    onSecond = second ? second.then : null;
    hasSecond = !!second;
    mode = "message";
    FU.UI.showMessage(title, text, button, icon, second ? second.label : null);
  }

  function messageOk(useSecond) {
    if (mode !== "message") return;
    // A second button with no action just closes the popup.
    if (useSecond && !hasSecond) return;
    FU.UI.hidePopup();
    const then = useSecond ? onSecond : onMessage;
    onMessage = null;
    onSecond = null;
    hasSecond = false;
    setMode("world");
    if (then) then();
  }

  // ---- World ----
  function interact() {
    const near = FU.nearby(s.world, s.player);
    if (!near) return;
    play("click", 0.4);
    if (near.type === "place") {
      place = near.item;
      mode = "place";
      FU.UI.showPlace(s, place);
    } else if (near.item.kind === "cabin") {
      place = { kind: "practice", tier: 0, losses: 0 };
      mode = "place";
      FU.UI.showPractice(s);
    } else if (near.item.kind === "range") {
      mode = "range";
      FU.UI.showRange(s);
    } else {
      town = near.item;
      mode = "store";
      FU.UI.showStore(s, town);
    }
  }

  function closePopup() {
    if (mode !== "place" && mode !== "store" && mode !== "range") return;
    FU.UI.hidePopup();
    setMode("world");
  }

  // ---- Low-time warning: the clock stops while the player decides ----
  function checkLowTime() {
    s.warned = s.warned || {};
    for (const h of C.LOW_TIME_WARNINGS) {
      if (s.hours < h && !s.warned[h]) {
        s.warned[h] = true;
        keys.clear();
        mode = "warn";
        showWarning();
        return true;
      }
    }
    return false;
  }

  function showWarning() {
    const dock = s.world.towns.find((t) => t.kind === "dock");
    FU.UI.showTimeWarning(s, FU.hoursToWalk(s, dock.x, dock.y));
    play("tick", 0.6);
  }

  function warnBuy(hours) {
    if (mode !== "warn") return;
    const before = s.gold;
    FU.buyTime(s, hours / C.CONVERT_SPEED);
    play(s.gold < before ? "coins" : "error", 0.5);
    showWarning();
  }

  function warnClose() {
    if (mode !== "warn") return;
    FU.UI.hidePopup();
    setMode("world");
  }

  function updateWorld(dt) {
    if (checkLowTime()) return;
    let dx = 0;
    let dy = 0;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;
    if (keys.has("w") || keys.has("arrowup")) dy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dy += 1;

    working = keys.has("q");
    buying = keys.has("e") && !working;
    if (working) {
      if (FU.work(s, dt) && coinTimer <= 0) {
        play("coins", 0.3);
        coinTimer = 0.15;
      }
    } else if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const step = FU.walkSpeed(s) * dt;
      FU.moveInWorld(s.world, s.player, (dx / len) * step, (dy / len) * step);
      if (dx) s.player.facing = dx > 0 ? 1 : -1;
      stepTimer -= dt;
      if (stepTimer <= 0) {
        play("step", 0.25);
        stepTimer = 0.32;
      }
    }
    if (buying && FU.buyTime(s, dt) && coinTimer <= 0) {
      play("tick", 0.4);
      coinTimer = 0.15;
    }
    coinTimer -= dt;

    const near = FU.nearby(s.world, s.player);
    let prompt = null;
    if (near && near.type === "place") {
      const def = FU.PLACES[near.item.kind];
      const tier = FU.nextTier(near.item);
      prompt = "Space: " + def.name + " " + FU.tierLabel(near.item) + " (bounty " + tier.reward + " gold)";
    } else if (near) {
      const extra = { dock: " (shop and ticket " + C.TARGET_GOLD + " gold)", range: " (train your aim)", cabin: " (free practice)" }[near.item.kind] || " (shop)";
      prompt = "Space: enter " + FU.TOWNS[near.item.kind].name + extra;
    }
    FU.UI.setPrompt(prompt);
    if (pressed.has(" ") || pressed.has("enter")) interact();
  }

  // ---- Fights ----
  function startFight() {
    if (mode !== "place" && mode !== "message" && mode !== "world") return;
    FU.UI.hidePopup();
    FU.UI.setPrompt(null);
    arena = FU.Arena.create(s, place);
    if (place.kind !== "practice") s.stats.fights += 1;
    helpLeft = storage("freezeup2-fought") ? 4 : 12;
    storage("freezeup2-fought", "1");
    FU.UI.panelKey = "";
    setMode("fight");
  }

  function updateFight(dt) {
    let dx = 0;
    let dy = 0;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;
    if (keys.has("w") || keys.has("arrowup")) dy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dy += 1;
    const aim = mouse ? renderer.toField(mouse.x, mouse.y) : { x: arena.player.x + 100, y: arena.player.y };
    for (const [k, id] of [["1", "revolver"], ["2", "shotgun"], ["3", "dynamite"]]) if (pressed.has(k)) FU.Arena.switchWeapon(arena, s, id);
    FU.Arena.update(arena, s, dt, { dx, dy, aimX: aim.x, aimY: aim.y, fire: clicked, dash: pressed.has(" "), reload: pressed.has("r") });
    helpLeft = Math.max(0, helpLeft - dt);
    for (const e of arena.events) play(e, e === "hit" ? 0.45 : e === "step" ? 0.4 : 0.6);
    arena.events = [];
    FU.UI.refreshFight(s, arena);
    if (!arena.done) return;

    const a = arena;
    arena = null;
    FU.UI.panelKey = "";
    if (place.kind === "practice") {
      play(a.won ? "good" : "error", 0.6);
      message(a.won ? "Practice won" : "Practice lost", (a.won ? "Nice shooting." : "No harm done.") + " It took " + Math.round(a.time) + " seconds. No gold won or lost.", "Continue", "wood-cabin", null);
    } else if (a.won) {
      const got = FU.winFight(s, place, FU.Arena.bounty(a));
      play("coins", 0.7);
      const next = FU.nextTier(place);
      const after = a.tierDef.patrol
        ? "Patrols here stay open."
        : next.patrol
          ? a.def.name + " is conquered! Patrols here pay " + next.reward + " gold each."
          : "Tier " + FU.TIER_NAMES[place.tier] + " is now open here: bounty " + next.reward + " gold.";
      const back = got.stash ? ", plus the <b>" + got.stash + " gold</b> you left here" : "";
      const acc = "Accuracy " + Math.round(FU.Arena.accuracy(a) * 100) + "%" + (FU.Arena.accuracyFactor(a) < 1 ? " (wild shooting trimmed the bounty)" : "") + ". ";
      message("You won in " + Math.round(a.time) + "s!", "You took <b>" + got.reward + " gold</b>" + back + ". " + acc + after, "Continue", "gold-nuggets", null);
    } else {
      const drop = FU.loseFight(s, place);
      play("error", 0.6);
      message(
        "You lost",
        "You lost <b>" + drop.lost + " gold</b>. Half is gone; the other <b>" + drop.kept + " gold</b> waits here until you win at " + a.def.name + ". The enemies are a bit weaker now. Fight again right away, or walk away and come back stronger (the Shooting Range can train you).",
        "Rematch now",
        "crossed-pistols",
        startFight,
        { label: "Walk away", then: null }
      );
    }
  }

  // ---- Training (optional, at a Shooting Range) ----
  function startDrill() {
    if (mode !== "range" && mode !== "world") return;
    FU.UI.hidePopup();
    if (!FU.startTraining(s)) return checkEnd();
    drill = FU.Drill.create(s.skill);
    FU.UI.panelKey = "";
    setMode("drill");
  }

  function updateDrill(dt) {
    FU.Drill.update(drill, dt, s.rng);
    FU.UI.refreshPanel(s, "Training", "Click the targets before they vanish. Hit " + drill.need + " of " + drill.total + " to gain a skill level.");
    for (const e of drill.events) play(e, 0.4);
    drill.events = [];
    if (!drill.done) return;
    const d = drill;
    drill = null;
    FU.finishTraining(s, d.passed);
    if (d.passed) {
      play("good", 0.6);
      message("Skill level " + s.skill + "!", "You hit " + d.hits + " of " + d.total + ". " + FU.UI.skillText(s.skill) + ".", "Continue", "bullseye", null);
    } else {
      play("error", 0.6);
      message("Not good enough", "You hit " + d.hits + " of " + d.total + " (need " + d.need + "). The fee and the time are gone. Try again whenever you like.", "Continue", "bullseye", null);
    }
  }

  // ---- Pause and help ----
  function pause() {
    if (["world", "place", "store", "range", "fight", "drill", "message"].indexOf(mode) < 0) return;
    resumeMode = mode;
    mode = "paused";
    keys.clear();
    mouseDown = false;
    FU.UI.setPaused(true);
  }

  function resume() {
    if (mode !== "paused") return;
    FU.UI.setPaused(false);
    setMode(resumeMode);
  }

  function help() {
    if (["world", "place", "store", "range", "message", "warn"].indexOf(mode) < 0) return;
    resumeMode = mode;
    mode = "tutorial";
    FU.UI.openTutorial(() => setMode(resumeMode));
  }

  FU.UI.init({
    start: startGame,
    resume,
    retry: () => startGame(s.code),
    newMap: () => startGame(FU.randomCode()),
    help,
    pause,
    sound: () => {
      FU.Assets.muted = !FU.Assets.muted;
      FU.UI.setSound(!FU.Assets.muted);
    },
    hold: (key, on) => {
      if (on) keys.add(key);
      else keys.delete(key);
    },
    startFight,
    startDrill,
    warnBuy,
    warnClose,
    closePopup,
    messageOk,
    buy: (id) => {
      if (mode !== "store") return;
      if (FU.buy(s, id, town)) play("coins", 0.6);
      else play("error", 0.4);
      FU.UI.showStore(s, town);
    },
    board: () => {
      if (mode !== "store") return;
      FU.board(s);
      checkEnd();
    },
    weapon: (id) => arena && FU.Arena.switchWeapon(arena, s, id),
  });

  // ---- Input ----
  function localPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener("pointermove", (e) => {
    mouse = localPoint(e);
    canvas.style.cursor = mode === "fight" || mode === "drill" ? "none" : "default";
  });
  canvas.addEventListener("pointerleave", () => (mouse = null));
  canvas.addEventListener("pointerdown", (e) => {
    mouse = localPoint(e);
    mouseDown = true;
    clicked = true;
    if (mode === "drill" && drill) {
      const f = renderer.toField(mouse.x, mouse.y);
      FU.Drill.click(drill, f.x, f.y);
    }
  });
  window.addEventListener("pointerup", () => (mouseDown = false));

  window.addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT") return;
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    if (e.repeat) return;

    if (k === "m") {
      FU.Assets.muted = !FU.Assets.muted;
      FU.UI.setSound(!FU.Assets.muted);
      return;
    }
    if (mode === "tutorial") {
      if (k === "arrowright" || k === "enter" || k === " ") FU.UI.tutStep(1);
      if (k === "arrowleft") FU.UI.tutStep(-1);
      if (k === "escape") FU.UI.closeTutorial();
      return;
    }
    if (mode === "place") {
      if (k === " " || k === "enter") return startFight();
      if (k === "escape") return closePopup();
    }
    if (mode === "store") {
      if (k === "escape") return closePopup();
      const it = FU.STORE_ITEMS[Number(k) - 1];
      if (it) FU.UI.h.buy(it.id);
      return;
    }
    if (mode === "range") {
      if (k === " " || k === "enter") return startDrill();
      if (k === "escape") return closePopup();
      return;
    }
    if (mode === "warn") {
      if (k === "escape" || k === " " || k === "enter") warnClose();
      return;
    }
    if (mode === "message") {
      if (k === " " || k === "enter") messageOk(false);
      if (k === "escape") messageOk(true);
      return;
    }
    if (k === "p" || k === "escape") {
      if (mode === "paused") resume();
      else pause();
      return;
    }
    keys.add(k);
    pressed.add(k);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => {
    keys.clear();
    mouseDown = false;
  });

  // Leaving the tab pauses the game instead of burning hours.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });

  window.addEventListener("resize", () => renderer.resize());
  renderer.resize();

  // ---- Frame loop ----
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (CLOCK_MODES.includes(mode) && s.status === "playing") {
      FU.spend(s, dt * C.CLOCK_RATE);
      if (mode === "world") updateWorld(dt);
      else if (mode === "fight") updateFight(dt);
      else if (mode === "drill") updateDrill(dt);
      checkEnd();
    }
    if (mode !== "world") {
      working = false;
      buying = false;
    }
    pressed.clear();
    clicked = false;

    FU.UI.updateHud(s, working, buying);
    if (mode === "fight" && arena) {
      renderer.drawFight(s, arena, mouse, helpLeft > 0);
    } else if (mode === "drill" && drill) {
      renderer.drawDrill(s, drill, mouse);
    } else if (mode !== "paused" && mode !== "title" && mode !== "tutorial") {
      FU.UI.refreshPanel(s, "Freeze-Up", "WASD: walk · Space: enter a place or shop · Q: work (time → gold) · E: buy time (gold → time) · P: pause");
      renderer.drawWorld(s, { working, buying, dt });
    }
    requestAnimationFrame(frame);
  }

  FU.UI.showTitle(s.code);
  if (params.has("play")) {
    // Dev shortcuts: skip the title, or jump into a fight or training.
    storage("freezeup2-tutorial", "1");
    startGame(s.code);
    const demo = params.get("demo");
    if (demo === "fight" || demo === "drill") {
      place = s.world.places.find((p) => p.kind === (params.get("place") || "fort")) || s.world.places[0];
      if (demo === "fight") startFight();
      else {
        s.gold += 20;
        startDrill();
      }
      for (let i = 0; i < Number(params.get("warp") || 0) * 30; i++) {
        if (arena) FU.Arena.update(arena, s, 1 / 30, { dx: 0, dy: 0, aimX: 900, aimY: 300, fire: false });
        if (drill) FU.Drill.update(drill, 1 / 30, s.rng);
      }
    }
    if (demo === "place") {
      place = s.world.places[0];
      mode = "place";
      FU.UI.showPlace(s, place);
    }
    if (demo === "warn") {
      s.hours = 7.5;
      s.gold = 80;
    }
    if (demo === "range") {
      mode = "range";
      FU.UI.showRange(s);
    }
  }
  requestAnimationFrame(frame);
})();
