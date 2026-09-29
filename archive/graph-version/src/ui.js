// DOM parts: HUD, bottom panel, popups, tutorial and screens.
(function (g) {
  const FU = (g.FU = g.FU || {});
  const $ = (id) => document.getElementById(id);
  const ico = (name, cls) => FU.Assets.html(name, cls);

  const TUTORIAL = [
    {
      icons: ["paddle-steamer", "snowflake-2"],
      title: "The goal",
      text: "Reach Dawson Dock before the river freezes. You need 30 gold for the boat ticket. The clock at the top shows how much time is left.",
    },
    {
      icons: ["stopwatch", "gold-nuggets"],
      title: "Time is money",
      text: "Every choice trades time for gold, or gold for time. Dig at a Gold Mine or work at a Work Camp to turn time into gold. Pay for a horse or dog sled to turn gold into time.",
    },
    {
      icons: ["walking-boot", "horse-head", "sitting-dog", "canoe"],
      title: "Getting around",
      text: "Click a lit stop next to you, then pick how to go. Walking is free but slow. A horse or dog sled costs gold but is faster. A canoe is fastest, but only works on the river, and only until it freezes.",
    },
    {
      icons: ["swap-bag", "bank"],
      title: "Gold is heavy",
      text: "Gold in your bag slows you down when you walk or ride. Put it in a Bank: bank gold weighs nothing and bandits can't steal it. The bank keeps a small fee.",
    },
    {
      icons: ["direwolf", "bandit", "polar-bear"],
      title: "Danger on the trail",
      text: "Wolves, bandits and bears can attack while you travel. Wolves and bears cost you time. Bandits steal gold from your bag. You can fight, run away, or pay the bandits.",
    },
    {
      icons: ["bowie-knife", "revolver", "sawed-off-shotgun", "dynamite"],
      title: "Fighting",
      text: "Click an enemy to attack. Press R to reload. The knife never runs out, but only hits enemies close to you. Buy bullets, a shotgun and dynamite at the General Store.",
    },
    {
      icons: ["shark-jaws", "poker-hand", "treasure-map"],
      title: "Other stops",
      text: "Loan Shark: get gold now, pay back more later. Card Game: bet gold for a chance to win more. Map button: see further down the trail.",
    },
    {
      icons: ["stopwatch"],
      title: "Don't stand still",
      text: "After 3 seconds of thinking, the clock starts running. Decide fast! Press P to pause. The map hides while paused.",
    },
  ];

  function stopText(s, n) {
    const C = FU.CONFIG;
    const p = n.params;
    switch (n.type) {
      case "start":
        return "Your old cabin. The gold ran out here. Dawson is to the east.";
      case "dock":
        return "The last boat home. The ticket costs " + C.TARGET_GOLD + " gold (bag + bank).";
      case "mine":
        return "Dig for " + p.hours + " hours to find " + p.min + " to " + p.max + " gold. It's luck.";
      case "camp":
        return "Work for " + p.hours + " hours to earn " + p.pay + " gold. Always the same.";
      case "bank":
        return "Put your gold here. It weighs nothing and nobody can steal it. Fee: " + Math.round(C.BANK_FEE * 100) + "%. Takes " + C.BANK_HOURS + "h.";
      case "shark":
        return "Borrow " + C.LOAN_AMOUNT + " gold now. He takes " + C.LOAN_REPAY + " gold after " + C.LOAN_STOPS + " more stops. If you can't pay, you lose.";
      case "cards":
        return "Bet " + C.BET_AMOUNT + " gold. " + Math.round(C.BET_WIN_CHANCE * 100) + "% chance to win " + C.BET_PAYOUT + " gold.";
      case "store":
        return "Buy ammo and weapons for the trail.";
      case "unknown":
        return "Nobody knows what is here until you arrive.";
    }
    return "";
  }

  function transportList(n) {
    const names = Object.keys(n.transports).map((id) => FU.TRANSPORT[id].name + (n.transports[id] ? " (" + n.transports[id] + " gold)" : " (free)"));
    return names.length ? "Travel from here: " + names.join(", ") + "." : "";
  }

  FU.UI = {
    init(h) {
      this.h = h;
      $("btn-start").onclick = () => h.start($("code-input").value);
      $("btn-random").onclick = () => ($("code-input").value = FU.randomCode());
      $("btn-howto").onclick = () => this.openTutorial(() => this.showTitle());
      $("btn-resume").onclick = h.resume;
      $("btn-retry").onclick = h.retry;
      $("btn-new").onclick = h.newMap;
      $("btn-map").onclick = h.buyMap;
      $("btn-drop").onclick = h.drop;
      $("btn-help").onclick = h.help;
      $("btn-pause").onclick = h.pause;
      $("btn-sound").onclick = h.sound;
      $("tut-back").onclick = () => this.tutStep(-1);
      $("tut-next").onclick = () => this.tutStep(1);
      $("tut-skip").onclick = () => this.closeTutorial();
      $("code-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") h.start($("code-input").value);
      });
      this.logCount = -1;
      this.panelKey = "";
    },

    showTitle(code) {
      if (code !== undefined) $("code-input").value = code;
      $("title-target").textContent = FU.CONFIG.TARGET_GOLD;
      $("tutorial").hidden = true;
      $("title-screen").hidden = false;
    },

    hideOverlays() {
      for (const id of ["title-screen", "tutorial", "pause-screen", "end-screen"]) $(id).hidden = true;
    },

    setPaused(on) {
      $("pause-screen").hidden = !on;
    },

    setSound(on) {
      $("btn-sound").textContent = on ? "Sound" : "Muted";
    },

    // ---- Tutorial ----
    openTutorial(onDone) {
      this.tutIndex = 0;
      this.tutDone = onDone;
      $("title-screen").hidden = true;
      $("tutorial").hidden = false;
      this.tutStep(0);
    },

    tutStep(delta) {
      this.tutIndex += delta;
      if (this.tutIndex >= TUTORIAL.length) return this.closeTutorial();
      this.tutIndex = Math.max(0, this.tutIndex);
      const t = TUTORIAL[this.tutIndex];
      $("tut-icons").innerHTML = t.icons.map((n) => ico(n)).join("");
      $("tut-title").textContent = t.title;
      $("tut-text").textContent = t.text;
      $("tut-dots").innerHTML = TUTORIAL.map((_, i) => "<span class='" + (i === this.tutIndex ? "on" : "") + "'></span>").join("");
      $("tut-back").disabled = this.tutIndex === 0;
      $("tut-next").textContent = this.tutIndex === TUTORIAL.length - 1 ? "Let's go" : "Next";
    },

    closeTutorial() {
      $("tutorial").hidden = true;
      const done = this.tutDone;
      this.tutDone = null;
      if (done) done();
    },

    tutorialOpen() {
      return !$("tutorial").hidden;
    },

    // ---- HUD ----
    updateHud(s, thinking) {
      const frac = Math.max(0, s.hours) / FU.CONFIG.START_HOURS;
      $("hud-hours").textContent = FU.fmtHours(s.hours);
      const bar = $("hud-hours-bar");
      bar.style.width = frac * 100 + "%";
      bar.style.background = frac < 0.2 ? "#e0685a" : frac < 0.45 ? "#e0b45a" : "#f1e6cc";
      $("hud-thinking").classList.toggle("on", thinking);
      $("hud-gold").textContent = s.gold;
      $("hud-banked").textContent = s.banked;
      $("hud-ammo").innerHTML =
        ico("bullets") + " " + s.ammo.bullets + " " + ico("shotgun-rounds") + " " + s.ammo.shells + " " + ico("dynamite") + " " + s.ammo.dynamite;
    },

    refresh(s, mode) {
      const C = FU.CONFIG;
      const slow = 1 + s.gold / C.WEIGHT_K;
      $("hud-weight").textContent = s.gold ? "walking " + Math.round((slow - 1) * 100) + "% slower" : "light as a feather";
      $("hud-goal").textContent = s.gold + s.banked + " / " + C.TARGET_GOLD;
      $("hud-debts").textContent = s.debts.length ? "owe " + s.debts.map((d) => d.amount + " in " + d.stops + " stops").join(", ") : "no debt";
      $("hud-debts").style.color = s.debts.length ? "#ffb4a8" : "";
      $("btn-map").textContent = "Map (" + C.MAP_COST + " gold)";
      $("btn-map").disabled = mode !== "map" || !FU.canBuyMap(s);
      $("btn-drop").textContent = "Drop " + C.DROP_AMOUNT + " gold";
      $("btn-drop").disabled = mode !== "map" || s.gold <= 0;
      $("code-tag").textContent = "Map code: " + s.code;

      if (mode === "fight") return;
      const n = FU.node(s);
      const info = FU.STOPS[n.type];
      $("here-name").innerHTML = ico(info.icon) + " " + info.name;
      const done = n.used && n.type !== "store" && n.type !== "unknown";
      $("here-desc").textContent = (done ? "You already did this here. " : stopText(s, n) + " ") + (n.type === "dock" ? "" : transportList(n));
      const box = $("here-actions");
      box.innerHTML = "";
      for (const a of FU.actions(s)) {
        const b = document.createElement("button");
        b.textContent = a.label;
        b.disabled = !a.enabled || mode !== "map";
        b.onclick = () => this.h.action(a.id);
        box.appendChild(b);
      }
      $("here-hint").textContent =
        mode === "map" ? "Click a lit stop on the map to travel (or press 1–4). Space = do the first action here. P = pause." : "";

      if (this.logCount !== s.log.length) {
        const list = $("log");
        list.innerHTML = "";
        for (let i = s.log.length - 1; i >= 0; i--) {
          const li = document.createElement("li");
          li.textContent = s.log[i].text;
          li.className = s.log[i].kind;
          list.appendChild(li);
        }
        this.logCount = s.log.length;
      }
    },

    // Weapon bar in the bottom panel during a fight. Rebuilt only on change.
    refreshFight(s, c) {
      const ids = Object.keys(FU.WEAPONS);
      const key = c.weapon + "|" + ids.map((id) => FU.Combat.ammoText(c, s, id) + FU.Combat.canUse(c, s, id)).join(",");
      if (key === this.panelKey) return;
      this.panelKey = key;
      $("here-name").innerHTML = ico("revolver") + " Fight!";
      $("here-desc").textContent = "Pick a weapon, then click enemies on the field.";
      const box = $("here-actions");
      box.innerHTML = "";
      ids.forEach((id, i) => {
        const w = FU.WEAPONS[id];
        if (!s.weapons[id]) return;
        const b = document.createElement("button");
        b.className = "weapon" + (c.weapon === id ? " on" : "");
        b.innerHTML = "<b>" + (i + 1) + "</b> " + ico(w.icon) + " " + w.name + " <small>" + FU.Combat.ammoText(c, s, id) + "</small>";
        b.disabled = !FU.Combat.canUse(c, s, id);
        b.onclick = () => this.h.weapon(id);
        box.appendChild(b);
      });
      const run = document.createElement("button");
      run.textContent = "Run away (" + FU.CONFIG.RUN_HOURS + "h)";
      run.onclick = () => this.h.runFight();
      box.appendChild(run);
      $("here-hint").textContent = "R = reload. Dynamite blows up after a short fuse. Don't throw it too close to yourself!";
    },

    resetFightPanel() {
      this.panelKey = "";
    },

    // ---- Popups on the map ----
    showTravel(s, toId) {
      const n = FU.node(s, toId);
      const edge = FU.edgeTo(s, toId);
      const known = n.layer <= FU.visibleLayer(s) || n.type === "dock";
      const opts = FU.tripOptions(s, toId);
      let html = "<h3>Travel to " + (known ? FU.STOPS[n.type].name : "an unknown stop") + "</h3>";
      html += "<p>" + edge.miles + " miles" + (edge.river ? " along the river" : "") + ". How do you want to go?</p><div class='options'>";
      opts.forEach((o, i) => {
        const detail = [];
        detail.push(o.price ? o.price + " gold" : "free");
        if (FU.TRANSPORT[o.id].weight > 0 && s.gold > 0) detail.push("slowed by your gold");
        if (FU.TRANSPORT[o.id].weight === 0) detail.push("weight doesn't matter");
        const d = FU.dangerLabel(o.danger);
        detail.push("<span class='danger-" + d + "'>danger: " + d + "</span>");
        if (!o.ok) detail.push("<b>" + o.why + "</b>");
        html +=
          "<button class='option' data-id='" + o.id + "'" + (o.ok ? "" : " disabled") + ">" +
          "<span class='key'>" + (i + 1) + "</span>" + ico(o.icon) +
          "<span><span class='name'>" + o.name + "</span><br><span class='detail'>" + detail.join(" · ") + "</span></span>" +
          "<span class='time'>" + FU.fmtHours(o.hours) + "</span></button>";
      });
      html += "</div><button id='travel-cancel'>Cancel (Esc)</button>";
      const box = $("popup");
      box.innerHTML = html;
      box.hidden = false;
      box.querySelectorAll(".option").forEach((b) => (b.onclick = () => this.h.chooseTransport(b.dataset.id)));
      $("travel-cancel").onclick = () => this.h.cancelTravel();
      return opts;
    },

    showEncounter(s, fight) {
      const e = FU.ENEMIES[fight.kind];
      const many = fight.count > 1;
      const what = e.stealGold ? "Each hit steals " + e.stealGold + " gold from your bag." : "Each hit costs you " + FU.fmtHours(e.hurtHours) + ".";
      let html = "<div class='foe'>" + ico(e.icon) + "<div><h3>" + (many ? fight.count + " " + e.plural.toLowerCase() : "A " + e.name.toLowerCase()) + " on the trail!</h3>";
      html += "<p>" + what + (e.loot ? " Bandits drop gold when beaten." : "") + "</p></div></div><div class='options'>";
      FU.fightChoices(s, fight).forEach((c, i) => {
        html += "<button class='option' data-id='" + c.id + "'" + (c.ok ? "" : " disabled") + "><span class='key'>" + (i + 1) + "</span><span></span><span class='name'>" + c.label + "</span><span></span></button>";
      });
      html += "</div>";
      const box = $("popup");
      box.innerHTML = html;
      box.hidden = false;
      box.querySelectorAll(".option").forEach((b) => (b.onclick = () => this.h.encounter(b.dataset.id)));
    },

    hidePopup() {
      $("popup").hidden = true;
    },

    showTip(s, nodeId, x, y, stage) {
      const tip = $("tip");
      if (nodeId === null) {
        tip.hidden = true;
        return;
      }
      const n = FU.node(s, nodeId);
      const lines = [];
      if (n.layer > FU.visibleLayer(s) && n.type !== "dock") {
        lines.push("<b>Unknown stop</b>", "Too far to see. Buy a map to see more.");
      } else {
        lines.push("<b>" + FU.STOPS[n.type].name + "</b>", stopText(s, n));
      }
      if (FU.canTravel(s, nodeId)) {
        const opts = FU.tripOptions(s, nodeId).filter((o) => o.ok);
        if (opts.length) {
          const fastest = opts.reduce((a, b) => (b.hours < a.hours ? b : a));
          lines.push("Click to travel. Fastest: " + fastest.name + ", " + FU.fmtHours(fastest.hours) + ".");
        }
      }
      tip.innerHTML = lines.join("<br>");
      tip.hidden = false;
      const maxX = stage.clientWidth - tip.offsetWidth - 8;
      tip.style.left = Math.max(8, Math.min(x + 16, maxX)) + "px";
      tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + "px";
    },

    showEnd(s) {
      const C = FU.CONFIG;
      const won = s.status === "won";
      $("end-kicker").textContent = won ? "Grade " + s.grade : "Stuck for the winter";
      $("end-title").textContent = won ? "You made the boat!" : "The river froze you in";
      $("end-reason").textContent = s.endReason;
      const stats = [
        ["Gold at the end", s.gold + s.banked + " (needed " + C.TARGET_GOLD + ")"],
        ["Time left", FU.fmtHours(s.hours)],
        ["Time lost thinking", FU.fmtHours(s.thinkingHours)],
        ["Time spent fighting", FU.fmtHours(s.fightHours)],
        ["Fights", String(s.fights)],
        ["Stops visited", String(s.path.length - 1)],
      ];
      if (s.spare >= 0) stats.push(["Best route (average luck)", FU.fmtHours(s.spare) + " to spare"]);
      if (won) stats.push(["Score", String(s.score)]);
      stats.push(["Map code", s.code]);
      $("end-stats").innerHTML = stats.map(([k, v]) => "<dt>" + k + "</dt><dd>" + v + "</dd>").join("");
      $("end-screen").hidden = false;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
