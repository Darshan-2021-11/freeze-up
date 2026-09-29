// Icons (game-icons.net, CC BY 3.0) and sounds (Kenney CC0, OpenGameArt CC0).
// See CREDITS.md.
(function (g) {
  const FU = (g.FU = g.FU || {});

  const SOUNDS = ["revolver", "shotgun", "dynamite", "knife", "reload", "hit", "hurt", "coins", "dig", "step", "click", "error", "good", "bell", "tick"];

  const images = {};
  const tinted = {};
  const sounds = {};

  FU.Assets = {
    muted: false,

    load() {
      for (const [name, svg] of Object.entries(FU.ICON_SVG)) {
        const img = new Image();
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        images[name] = img;
      }
      for (const name of SOUNDS) {
        const a = new Audio("assets/sounds/" + name + ".mp3");
        a.preload = "auto";
        sounds[name] = a;
      }
    },

    // A tinted copy of an icon, cached per color and size. Null until loaded.
    icon(name, color, size) {
      const img = images[name];
      if (!img || !img.complete || !img.naturalWidth) return null;
      const px = Math.max(8, Math.round(size));
      const key = name + "|" + color + "|" + px;
      if (tinted[key]) return tinted[key];
      const c = document.createElement("canvas");
      c.width = px;
      c.height = px;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, px, px);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, px, px);
      tinted[key] = c;
      return c;
    },

    draw(ctx, name, color, x, y, size, flip) {
      const dpr = window.devicePixelRatio || 1;
      const img = FU.Assets.icon(name, color, size * dpr);
      if (!img) return;
      if (flip) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      }
    },

    // Inline SVG markup for DOM use; takes the text color of its parent.
    html(name, cls) {
      const svg = FU.ICON_SVG[name] || "";
      return '<span class="ico ' + (cls || "") + '">' + svg + "</span>";
    },

    play(name, volume) {
      if (FU.Assets.muted || !sounds[name]) return;
      const a = sounds[name].cloneNode();
      a.volume = volume === undefined ? 0.6 : volume;
      a.play().catch(() => {});
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
