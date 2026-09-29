// Wires input, screens and the frame loop together.
(function () {
  const FU = window.FU;
  FU.Assets.load();

  const canvas = document.getElementById("map");
  const stage = document.getElementById("stage");
  const renderer = new FU.Renderer(canvas);

  const params = new URLSearchParams(location.search);
  let code = params.get("code") || params.get("seed") || FU.randomCode();
  let s = FU.newGame(code);

  // title | tutorial | map | choose | travel | encounter | fight | paused | ended
  let mode = "title";
  let resumeMode = "map";
  let chooseTo = null;
  let chooseOpts = [];
  let travel = null; // { trip, t, dur, met }
  let fight = null;
  let helpLeft = 0;
  let hoverId = null;
  let mouse = null;
  let thinking = false;
  let stepTimer = 0;
  let last = performance.now();

  const play = (name, vol) => FU.Assets.play(name, vol);

  function storage(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
  }

  function reachable() {
    if ((mode !== "map" && mode !== "choose") || s.status !== "playing") return [];
    return FU.node(s)
      .out.map((e) => e.to)
      .sort((a, b) => FU.node(s, a).y - FU.node(s, b).y);
  }

  function changed() {
    FU.UI.refresh(s, mode === "fight" ? "fight" : mode === "map" ? "map" : "busy");
    if (s.status !== "playing" && mode !== "ended") {
      mode = "ended";
      fight = null;
      travel = null;
      FU.UI.hidePopup();
      FU.UI.refresh(s, "busy");
      play(s.status === "won" ? "bell" : "error", 0.7);
      setTimeout(() => FU.UI.showEnd(s), 800);
    }
  }

  function startGame(newCode) {
    code = String(newCode || "").trim() || FU.randomCode();
    s = FU.newGame(code);
    chooseTo = null;
    travel = null;
    fight = null;
    FU.UI.logCount = -1;
    FU.UI.hideOverlays();
    FU.UI.hidePopup();
    try {
      history.replaceState(null, "", "?code=" + encodeURIComponent(s.code));
    } catch (e) {
      // file:// pages may refuse; the code still shows on screen.
    }
    renderer.resize();
    changed();
    if (!storage("freezeup-tutorial")) {
      storage("freezeup-tutorial", "1");
      mode = "tutorial";
      FU.UI.openTutorial(() => setMode("map"));
    } else {
      setMode("map");
    }
  }

  function setMode(m) {
    mode = m;
    last = performance.now();
    s.idleSec = 0;
    changed();
  }

  // ---- Map and travel ----
  function selectStop(id) {
    if ((mode !== "map" && mode !== "choose") || !FU.canTravel(s, id)) return;
    play("click", 0.4);
    chooseTo = id;
    chooseOpts = FU.UI.showTravel(s, id);
    FU.UI.showTip(s, null);
    mode = "choose";
    changed();
  }

  function cancelTravel() {
    if (mode !== "choose") return;
    chooseTo = null;
    FU.UI.hidePopup();
    mode = "map";
    changed();
  }

  function chooseTransport(id) {
    if (mode !== "choose") return;
    const trip = FU.beginTrip(s, chooseTo, id);
    if (!trip) return play("error", 0.5);
    if (FU.TRANSPORT[id].price) play("coins", 0.5);
    FU.UI.hidePopup();
    travel = { trip, t: 0, dur: Math.max(0.9, Math.min(2.2, 0.5 + trip.hours * 0.12)), met: false };
    chooseTo = null;
    mode = "travel";
    changed();
  }

  function updateTravel(dt) {
    travel.t += dt / travel.dur;
    stepTimer -= dt;
    if (stepTimer <= 0 && (travel.trip.transport === "walk" || travel.trip.transport === "horse")) {
      play("step", 0.35);
      stepTimer = travel.trip.transport === "walk" ? 0.4 : 0.25;
    }
    if (travel.trip.fight && !travel.met && travel.t >= 0.5) {
      travel.met = true;
      mode = "encounter";
      play("hurt", 0.6);
      FU.UI.showEncounter(s, travel.trip.fight);
      changed();
      return;
    }
    if (travel.t >= 1) {
      const trip = travel.trip;
      travel = null;
      FU.finishTrip(s, trip);
      mode = "map";
      if (FU.node(s).type === "unknown") play("good", 0.5);
      changed();
    }
  }

  function encounter(choice) {
    if (mode !== "encounter") return;
    const f = travel.trip.fight;
    const opt = FU.fightChoices(s, f).find((c) => c.id === choice);
    if (!opt || !opt.ok) return play("error", 0.5);
    FU.UI.hidePopup();
    if (choice === "fight") {
      s.fights += 1;
      fight = FU.Combat.create(s, f);
      helpLeft = storage("freezeup-fought") ? 3 : 8;
      storage("freezeup-fought", "1");
      FU.UI.resetFightPanel();
      mode = "fight";
    } else {
      FU.avoidFight(s, f, choice);
      play(choice === "pay" ? "coins" : "step", 0.6);
      mode = "travel";
    }
    changed();
  }

  // ---- Fights ----
  function updateFight(dt) {
    FU.Combat.update(fight, s, dt);
    helpLeft = Math.max(0, helpLeft - dt);
    for (const e of fight.events) play(e, e === "hit" ? 0.5 : 0.7);
    fight.events = [];
    FU.UI.refreshFight(s, fight);
    if (fight.done) {
      fight = null;
      FU.UI.resetFightPanel();
      mode = "travel";
      changed();
    }
  }

  function weaponIndex(n) {
    const id = Object.keys(FU.WEAPONS)[n - 1];
    if (id && fight) FU.Combat.switchWeapon(fight, s, id);
  }

  // ---- Pause and help ----
  function pause() {
    if (["map", "choose", "travel", "encounter", "fight"].indexOf(mode) < 0) return;
    resumeMode = mode;
    mode = "paused";
    FU.UI.setPaused(true);
  }

  function resume() {
    if (mode !== "paused") return;
    FU.UI.setPaused(false);
    mode = resumeMode;
    last = performance.now();
  }

  function help() {
    if (["map", "choose", "travel", "encounter", "fight"].indexOf(mode) < 0) return;
    resumeMode = mode;
    mode = "tutorial";
    FU.UI.openTutorial(() => {
      mode = resumeMode;
      last = performance.now();
    });
  }

  FU.UI.init({
    start: startGame,
    resume,
    retry: () => startGame(s.code),
    newMap: () => startGame(FU.randomCode()),
    buyMap: () => {
      if (mode !== "map") return;
      FU.buyMap(s);
      play("coins", 0.5);
      changed();
    },
    drop: () => {
      if (mode !== "map") return;
      FU.drop(s);
      play("coins", 0.4);
      changed();
    },
    help,
    pause,
    sound: () => {
      FU.Assets.muted = !FU.Assets.muted;
      FU.UI.setSound(!FU.Assets.muted);
    },
    action: (id) => {
      if (mode !== "map") return;
      const sound = FU.doAction(s, id);
      if (sound) play(sound, 0.6);
      changed();
    },
    chooseTransport,
    cancelTravel,
    encounter,
    weapon: (id) => fight && FU.Combat.switchWeapon(fight, s, id),
    runFight: () => {
      if (!fight) return;
      FU.Combat.run(fight, s);
    },
  });

  // ---- Input ----
  function localPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener("pointermove", (e) => {
    mouse = localPoint(e);
    if (mode === "fight") {
      canvas.style.cursor = "none";
      return;
    }
    hoverId = mode === "map" ? renderer.hit(s, mouse.x, mouse.y) : null;
    canvas.style.cursor = hoverId !== null && FU.canTravel(s, hoverId) ? "pointer" : "default";
    FU.UI.showTip(s, hoverId, mouse.x, mouse.y, stage);
  });
  canvas.addEventListener("pointerleave", () => {
    hoverId = null;
    mouse = null;
    FU.UI.showTip(s, null);
  });
  canvas.addEventListener("pointerdown", (e) => {
    const p = localPoint(e);
    mouse = p;
    if (mode === "fight") {
      const f = renderer.toField(p.x, p.y);
      FU.Combat.click(fight, s, f.x, f.y);
      return;
    }
    if (mode === "map" || mode === "choose") {
      const id = renderer.hit(s, p.x, p.y);
      if (id !== null && FU.canTravel(s, id)) selectStop(id);
      else if (mode === "choose") cancelTravel();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT") return;
    const k = e.key;
    if (k === "m" || k === "M") {
      FU.Assets.muted = !FU.Assets.muted;
      FU.UI.setSound(!FU.Assets.muted);
      return;
    }
    if (mode === "tutorial") {
      if (k === "ArrowRight" || k === "Enter" || k === " ") FU.UI.tutStep(1);
      if (k === "ArrowLeft") FU.UI.tutStep(-1);
      if (k === "Escape") FU.UI.closeTutorial();
      return;
    }
    if (k === "Escape" && mode === "choose") return cancelTravel();
    if (k === "p" || k === "P" || k === "Escape") {
      if (mode === "paused") resume();
      else pause();
      return;
    }
    const n = Number(k);
    if (mode === "map") {
      const list = reachable();
      if (n >= 1 && n <= list.length) selectStop(list[n - 1]);
      if (k === " " || k === "Enter") {
        e.preventDefault();
        const a = FU.actions(s).find((x) => x.enabled);
        if (a) {
          const sound = FU.doAction(s, a.id);
          if (sound) play(sound, 0.6);
          changed();
        }
      }
    } else if (mode === "choose") {
      if (n >= 1 && n <= chooseOpts.length) chooseTransport(chooseOpts[n - 1].id);
    } else if (mode === "encounter") {
      const list = FU.fightChoices(s, travel.trip.fight);
      if (n >= 1 && n <= list.length) encounter(list[n - 1].id);
    } else if (mode === "fight") {
      if (n >= 1 && n <= 4) weaponIndex(n);
      if (k === "r" || k === "R") FU.Combat.reload(fight, s);
    }
  });

  // Leaving the tab pauses the game instead of burning hours.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });

  window.addEventListener("resize", () => renderer.resize());
  renderer.resize();

  // ---- Frame loop ----
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    thinking = false;

    if (mode === "map" || mode === "choose" || mode === "encounter") {
      thinking = FU.tickHesitation(s, dt);
      if (s.status !== "playing") changed();
    } else if (mode === "travel") {
      updateTravel(dt);
    } else if (mode === "fight") {
      updateFight(dt);
    }

    FU.UI.updateHud(s, thinking);
    if (mode === "fight" && fight) {
      renderer.drawFight(s, fight, mouse, helpLeft > 0);
    } else if (mode !== "paused" && mode !== "title" && mode !== "tutorial") {
      renderer.drawMap(s, { hoverId, selectedId: chooseTo, reachable: reachable(), travel, dt });
    }
    requestAnimationFrame(frame);
  }

  FU.UI.refresh(s, "busy");
  if (params.has("play")) {
    // Dev shortcut: skip the title and tutorial.
    storage("freezeup-tutorial", "1");
    startGame(code);
    const demo = params.get("demo");
    if (demo === "choose") selectStop(reachable()[0]);
    if (demo === "fight") {
      travel = { trip: { from: 0, to: FU.node(s).out[0].to, transport: "walk", hours: 5, fight: { kind: params.get("foe") || "wolf", count: 3 } }, t: 0.5, dur: 1, met: true };
      mode = "encounter";
      encounter("fight");
      for (let i = 0; i < Number(params.get("warp") || 0) * 30; i++) FU.Combat.update(fight, s, 1 / 30);
    }
  } else {
    FU.UI.showTitle(code);
  }
  requestAnimationFrame(frame);
})();
