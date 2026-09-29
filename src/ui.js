// DOM parts: HUD, prompts, popups, tutorial and screens.
(function (g) {
  const FU = (g.FU = g.FU || {});
  const $ = (id) => document.getElementById(id);
  const ico = (name, cls) => FU.Assets.html(name, cls);

  const TUTORIAL = [
    {
      icons: ["paddle-steamer", "snowflake-2"],
      title: "The goal",
      text: "Reach Dawson Dock (far to the east) with enough gold for the ticket before the river freezes. The clock never stops: not in fights, not in shops.",
    },
    {
      icons: ["hiking"],
      title: "Go anywhere",
      text: "Walk with WASD or the arrow keys. Go anywhere and come back anytime. Cross the river on the bridges. The more gold you carry, the slower you walk.",
    },
    {
      icons: ["direwolf", "tipi", "mountain-cave", "military-fort"],
      title: "Fight for gold",
      text: "Five places, each with its own enemies and a trick to learn. Each has three tiers: beat one to unlock a harder, better-paid one. Win fast: the bounty drops after a few seconds. Time is money!",
    },
    {
      icons: ["crossed-pistols"],
      title: "No running away",
      text: "Once a fight starts, you can't leave until it ends. If you lose, you drop gold at that place (half its bounty). Win there later and you get it all back, so a loss mostly costs time. Each loss also makes that place a bit weaker.",
    },
    {
      icons: ["bullseye"],
      title: "Train to fight faster",
      text: "Shooting Ranges sell training for gold and time. Hit enough targets and your skill goes up: faster shots, faster reloads, and a chance of double-damage hits. Fights end sooner, which saves time.",
    },
    {
      icons: ["revolver", "sawed-off-shotgun", "dynamite", "sprint"],
      title: "How to fight",
      text: "WASD to move, mouse to aim, click or hold to shoot. Space to dash through danger. Bandits shout \"!\" before they shoot. Bears glow red before they charge: dodge, and let them crash into a rock.",
    },
    {
      icons: ["trade", "hourglass"],
      title: "Trade time and gold",
      text: "Hold Q to work: 1 hour becomes 1 gold. Hold E to buy time: 4 gold becomes 1 hour. Trading back always loses, so plan ahead.",
    },
    {
      icons: ["shop", "hearts"],
      title: "Towns",
      text: "Your Cabin has free practice fights. The Trading Post sells shells, dynamite, a shotgun and extra hearts. Dawson Dock sells the same for more, plus the ticket home. Walk up to a building and press Space.",
    },
  ];

  FU.UI = {
    init(h) {
      this.h = h;
      $("btn-start").onclick = () => h.start($("code-input").value);
      $("btn-random").onclick = () => ($("code-input").value = FU.randomCode());
      $("btn-howto").onclick = () => this.openTutorial(() => this.showTitle());
      $("btn-resume").onclick = h.resume;
      $("btn-retry").onclick = h.retry;
      $("btn-new").onclick = h.newMap;
      $("btn-help").onclick = h.help;
      $("btn-pause").onclick = h.pause;
      $("btn-sound").onclick = h.sound;
      $("tut-back").onclick = () => this.tutStep(-1);
      $("tut-next").onclick = () => this.tutStep(1);
      $("tut-skip").onclick = () => this.closeTutorial();
      $("code-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") h.start($("code-input").value);
      });
      // The trade buttons work while held, like the Q and E keys.
      for (const [id, key] of [["btn-work", "q"], ["btn-buy", "e"]]) {
        const b = $(id);
        b.addEventListener("pointerdown", () => h.hold(key, true));
        for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => h.hold(key, false));
      }
      $("work-rate").textContent = FU.CONFIG.WORK_RATE;
      $("buy-rate").textContent = FU.CONFIG.BUY_RATE;
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

    // ---- HUD, every frame ----
    updateHud(s, working, buying) {
      const C = FU.CONFIG;
      const frac = Math.max(0, Math.min(1, s.hours / C.START_HOURS));
      $("hud-hours").textContent = FU.fmtHours(s.hours);
      const bar = $("hud-hours-bar");
      bar.style.width = frac * 100 + "%";
      bar.style.background = frac < 0.2 ? "#e0685a" : frac < 0.45 ? "#e0b45a" : "#f1e6cc";
      $("hud-gold").textContent = s.gold;
      const slow = Math.round((1 - FU.walkSpeed(s) / C.WALK_SPEED) * 100);
      $("hud-weight").textContent = slow > 0 ? "walking " + slow + "% slower" : "light bag";
      $("hud-goal").textContent = C.TARGET_GOLD + " gold";
      // Warn early when the ticket is out of reach by fighting alone.
      const onMap = FU.goldOnMap(s);
      const short = s.gold + onMap < C.TARGET_GOLD;
      const mapEl = $("hud-map");
      mapEl.textContent = short ? "only " + onMap + " left to win: work (Q)!" : "up to " + onMap + " left on map";
      mapEl.style.color = short ? "#ffb4a8" : "";
      const gear =
        ico("hearts") + " " + s.maxHearts + " " + ico("bullseye") + " Lv " + s.skill + " " + ico("shotgun-rounds") + " " + s.ammo.shells + " " + ico("dynamite") + " " + s.ammo.dynamite;
      if (gear !== this.gearHtml) {
        $("hud-gear").innerHTML = gear;
        this.gearHtml = gear;
      }
      $("btn-work").classList.toggle("on", working);
      $("btn-buy").classList.toggle("on", buying);
      $("code-tag").textContent = "Map code: " + s.code;
    },

    setPrompt(text) {
      const el = $("prompt");
      if (!text) {
        el.hidden = true;
        return;
      }
      if (el.textContent !== text) el.textContent = text;
      el.hidden = false;
    },

    // ---- Bottom panel ----
    refreshPanel(s, title, desc) {
      const key = title + "|" + desc;
      if (key !== this.panelKey) {
        this.panelKey = key;
        $("here-name").innerHTML = title;
        $("here-desc").textContent = desc;
        $("here-actions").innerHTML = "";
        $("here-hint").textContent = "";
      }
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

    // Weapon bar during a fight. Rebuilt only on change.
    refreshFight(s, a) {
      const ids = Object.keys(FU.WEAPONS);
      const key = "fight|" + a.weapon + "|" + ids.map((id) => FU.Arena.ammoText(a, s, id) + FU.Arena.canUse(a, s, id)).join(",");
      if (key === this.panelKey) return;
      this.panelKey = key;
      $("here-name").innerHTML = ico(a.def.icon) + " " + a.def.name + ": fight!";
      $("here-desc").textContent = "No running away. The clock is running.";
      const box = $("here-actions");
      box.innerHTML = "";
      ids.forEach((id, i) => {
        const w = FU.WEAPONS[id];
        if (!s.weapons[id]) return;
        const b = document.createElement("button");
        b.className = "weapon" + (a.weapon === id ? " on" : "");
        b.innerHTML = "<b>" + (i + 1) + "</b> " + ico(w.icon) + " " + w.name + " <small>" + FU.Arena.ammoText(a, s, id) + "</small>";
        b.disabled = !FU.Arena.canUse(a, s, id);
        b.onclick = () => this.h.weapon(id);
        box.appendChild(b);
      });
      $("here-hint").textContent = "WASD move · mouse aim · click shoot · Space dash · R reload";
    },

    // ---- Popups ----
    popup(html) {
      const box = $("popup");
      box.innerHTML = html;
      box.hidden = false;
      return box;
    },

    hidePopup() {
      $("popup").hidden = true;
    },

    showPlace(s, place) {
      const def = FU.PLACES[place.kind];
      const tier = FU.nextTier(place);
      const waves = FU.tierWaves(place.kind, place.tier);
      // Exact enemies of this tier.
      const count = (list) => {
        const n = {};
        for (const k of list) n[k] = (n[k] || 0) + 1;
        return Object.entries(n)
          .map(([k, c]) => c + " " + (c > 1 ? FU.ENEMIES[k].plural : FU.ENEMIES[k].name).toLowerCase())
          .join(", ");
      };
      const foes = waves.map((w, i) => (waves.length > 1 ? "Wave " + (i + 1) + ": " : "") + count(w)).join(". ");
      const floor = Math.round(tier.reward * FU.BOUNTY_FLOOR);
      let html = "<div class='foe'>" + ico(def.icon) + "<div><h3>" + def.name + " · tier " + FU.TIER_NAMES[place.tier] + "</h3>";
      html += "<p>" + foes + ".</p>";
      html += "<p><b>Bounty: " + tier.reward + " gold</b> if you win within " + tier.par + " seconds. After that it drops, down to " + floor + ". Time is money!</p>";
      html += "<p>Tip: " + def.tip + "</p>";
      if (place.losses) html += "<p>You lost here " + place.losses + " time" + (place.losses > 1 ? "s" : "") + ". The enemies are weaker now.</p>";
      if (place.stash) html += "<p><b>" + place.stash + " gold</b> you dropped is still here. Win to get it back.</p>";
      html += "<p><b>Once you start, there's no running away. Lose, and you drop " + Math.ceil(tier.reward * FU.CONFIG.LOSE_BOUNTY_SHARE) + " gold here (win later to get it back).</b></p></div></div>";
      html += "<div class='row'><button class='primary' id='pl-go'>Fight (Space)</button><button id='pl-no'>Not now (Esc)</button></div>";
      this.popup(html);
      $("pl-go").onclick = () => this.h.startFight();
      $("pl-no").onclick = () => this.h.closePopup();
    },

    showPractice(s) {
      let html = "<div class='foe'>" + ico("wood-cabin") + "<div><h3>Your Cabin</h3>";
      html += "<p>Practice fight: 2 wolves, then a bandit. No gold to win or lose, but the clock keeps running.</p></div></div>";
      html += "<div class='row'><button class='primary' id='pl-go'>Practice (Space)</button><button id='pl-no'>Leave (Esc)</button></div>";
      this.popup(html);
      $("pl-go").onclick = () => this.h.startFight();
      $("pl-no").onclick = () => this.h.closePopup();
    },

    showStore(s, town) {
      const info = FU.TOWNS[town.kind];
      let html = "<div class='foe'>" + ico(info.icon) + "<div><h3>" + info.name + "</h3><p>You have " + s.gold + " gold. The clock keeps running while you shop.</p></div></div>";
      if (town.kind === "dock") {
        const ok = s.gold >= FU.CONFIG.TARGET_GOLD;
        html += "<p><button class='primary' id='st-board'" + (ok ? "" : " disabled") + ">Buy the ticket home (" + FU.CONFIG.TARGET_GOLD + " gold)</button>";
        if (!ok) html += " <small>You need " + (FU.CONFIG.TARGET_GOLD - s.gold) + " more gold.</small>";
        html += "</p>";
      }
      html += "<div class='options'>";
      FU.storeItems(s, town).forEach((it, i) => {
        html +=
          "<button class='option' data-id='" + it.id + "'" + (it.ok ? "" : " disabled") + "><span class='key'>" + (i + 1) + "</span><span></span>" +
          "<span><span class='name'>" + it.label + "</span>" + (it.why ? "<br><span class='detail'>" + it.why + "</span>" : "") + "</span>" +
          "<span class='time'>" + it.price + " gold</span></button>";
      });
      html += "</div><button id='st-close'>Leave (Esc)</button>";
      const box = this.popup(html);
      box.querySelectorAll(".option").forEach((b) => (b.onclick = () => this.h.buy(b.dataset.id)));
      $("st-close").onclick = () => this.h.closePopup();
      if ($("st-board")) $("st-board").onclick = () => this.h.board();
    },

    // A message with one button (Space), and an optional second one (Esc).
    showMessage(title, text, button, icon, second) {
      let html = "<div class='foe'>" + (icon ? ico(icon) : "") + "<div><h3>" + title + "</h3><p>" + text + "</p></div></div>";
      html += "<div class='row'><button class='primary' id='msg-ok'>" + button + " (Space)</button>";
      if (second) html += "<button id='msg-second'>" + second + " (Esc)</button>";
      html += "</div>";
      this.popup(html);
      $("msg-ok").onclick = () => this.h.messageOk(false);
      if (second) $("msg-second").onclick = () => this.h.messageOk(true);
    },

    // What one skill level gives, for popups.
    skillText(level) {
      const T = FU.CONFIG.TRAINING;
      const pct = (x) => Math.round(x * level * 100) + "%";
      return "Crit chance " + pct(T.crit) + " (double damage), shots " + pct(T.fireRate) + " faster, reloads " + pct(T.reload) + " faster";
    },

    showRange(s) {
      const T = FU.CONFIG.TRAINING;
      const cost = FU.trainingCost(s);
      const why = FU.cantTrain(s);
      let html = "<div class='foe'>" + ico("bullseye") + "<div><h3>Shooting Range</h3>";
      html += "<p>Your skill: <b>level " + s.skill + " of " + T.maxLevel + "</b>" + (s.skill ? " (" + this.skillText(s.skill) + ")" : "") + ".</p>";
      if (s.skill < T.maxLevel) {
        html += "<p>Train for <b>" + cost.gold + " gold and " + cost.hours + " hours</b>. Hit " + FU.CONFIG.DRILL.need + " of " + FU.CONFIG.DRILL.targets + " targets to reach level " + (s.skill + 1) + ": " + this.skillText(s.skill + 1) + ". Each level makes the drill a bit faster.</p>";
      }
      html += "</div></div><div class='row'><button class='primary' id='rg-go'" + (why ? " disabled" : "") + ">Train (Space)</button><button id='rg-no'>Leave (Esc)</button>";
      if (why) html += " <small>" + why + "</small>";
      html += "</div>";
      this.popup(html);
      $("rg-go").onclick = () => this.h.startDrill();
      $("rg-no").onclick = () => this.h.closePopup();
    },

    showEnd(s) {
      const C = FU.CONFIG;
      const won = s.status === "won";
      $("end-kicker").textContent = won ? "Grade " + s.grade : "Stuck for the winter";
      $("end-title").textContent = won ? "You made the boat!" : "The river froze";
      $("end-reason").textContent = s.endReason;
      const st = s.stats;
      const stats = [
        ["Gold", s.gold + " (ticket " + C.TARGET_GOLD + ")"],
        ["Time left", FU.fmtHours(s.hours)],
        ["Fights won / lost", st.wins + " / " + st.losses],
        ["Skill level", s.skill + " (" + st.trainings + " training sessions)"],
        ["Hours worked (Q)", FU.fmtHours(st.worked)],
        ["Hours bought (E)", FU.fmtHours(st.bought)],
      ];
      if (won) stats.push(["Score", String(s.score)]);
      stats.push(["Map code", s.code]);
      $("end-stats").innerHTML = stats.map(([k, v]) => "<dt>" + k + "</dt><dd>" + v + "</dd>").join("");
      $("end-screen").hidden = false;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
