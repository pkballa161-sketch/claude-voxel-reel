// 01 — the hook: what if you never opened the app.
import { H, P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import {
  at,
  clamp,
  easeInOutCubic,
  easeOutCubic,
  easeOutExpo,
  easeOutQuint,
  lerp,
  seg,
} from "../engine/anim.ts";
import { bloom, chip, dots, panel, rule, strike } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { revealMask, wt, we } from "./_lib.ts";

const plate: Plate = {
  id: "model",
  label: "the hook",
  draw(ctx: Ctx, f) {
    const t = f.lt;
    const zoom = lerp(1.05, 1.0, easeOutQuint(seg(t, 0, 10)));
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    // background field of dots, breathing with the voice
    dots(ctx, {
      cx: 620,
      cy: 520,
      radius: 760,
      alpha: 0.16 + f.level * 0.12,
      x: -((t * 9) % 48),
      y: -((t * 6) % 48),
    });
    bloom(ctx, 520, 480, 620, P.accent, 0.03 + f.level * 0.04);

    /* ---------------------------------------------------- cold open title */
    const titleOut = at(t, 2.45, 3.05, easeOutCubic);
    if (titleOut < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - titleOut;
      ctx.translate(0, -titleOut * 36);
      label(ctx, "fig. 00 — a workflow", 140, 300, {
        size: 17,
        tracking: 4,
        color: P.bone,
        alpha: 0.45 * at(t, 0.2, 1.0),
      });
      rule(ctx, 140, 322, 340, at(t, 0.35, 1.25, easeOutExpo), rgba(P.accent, 0.8), 2);

      revealMask(
        ctx,
        134,
        400,
        1200,
        165,
        at(t, 0.5, 1.45, easeOutExpo),
        () =>
          txt(ctx, "MOTION", 140, 540, {
            size: 165,
            face: "Archivo900",
            tracking: -6,
            color: P.bone,
          }),
      );
      revealMask(
        ctx,
        134,
        540,
        1200,
        165,
        at(t, 0.72, 1.7, easeOutExpo),
        () =>
          txt(ctx, "AS CODE", 140, 682, {
            size: 165,
            face: "Archivo900",
            tracking: -6,
            color: P.bone,
          }),
      );
      // accent bar that snaps in after the second line lands
      const bar = at(t, 1.5, 2.1, easeOutExpo);
      if (bar > 0) {
        ctx.save();
        ctx.fillStyle = P.accent;
        ctx.fillRect(140, 716, 268 * bar, 10);
        ctx.restore();
      }
      txt(ctx, "Motion graphics, written as code, driven by a voiceover.", 140, 782, {
        size: 27,
        face: "Mono400",
        color: P.bone,
        alpha: 0.42 * at(t, 1.35, 2.2),
      });
      ctx.restore();
    }

    /* --------------------------------------------------------- big words */
    const words: Array<{ text: string; anchor: string; y: number; size: number }> = [
      { text: "MAKE", anchor: "make", y: 610, size: 172 },
      { text: "MOTION", anchor: "motion", y: 610, size: 172 },
      { text: "GRAPHICS", anchor: "graphics", y: 772, size: 172 },
    ];
    const dim = at(t, wt(f, "without"), wt(f, "without") + 0.8, easeOutCubic);
    const baseAlpha = lerp(1, 0.22, dim);

    if (t > wt(f, "make") - 0.5) {
      let x = 140;
      for (let i = 0; i < 2; i++) {
        const w = words[i];
        const start = wt(f, w.anchor) - 0.16;
        const p = at(t, start, start + 1.0, easeOutExpo);
        const width = measure(ctx, w.text, w.size, "Archivo900", -6);
        ctx.save();
        ctx.globalAlpha = baseAlpha;
        revealMask(ctx, x - 10, w.y - 168, width + 30, 200, p, () =>
          txt(ctx, w.text, x, w.y, {
            size: w.size,
            face: "Archivo900",
            tracking: -6,
            color: P.bone,
          }),
        );
        ctx.restore();
        x += width + 40;
      }

      const g = words[2];
      const gp = at(t, wt(f, "graphics") - 0.16, wt(f, "graphics") + 1.0, easeOutExpo);
      ctx.save();
      ctx.globalAlpha = baseAlpha;
      revealMask(ctx, 126, g.y - 168, 1400, 200, gp, () =>
        txt(ctx, g.text, 140, g.y, {
          size: g.size,
          face: "Archivo900",
          tracking: -6,
          color: P.bone,
        }),
      );
      ctx.restore();

      // the full-stop keeps its colour even while the headline is dimmed
      if (gp > 0.15) {
        const gw = measure(ctx, g.text, g.size, "Archivo900", -6);
        ctx.save();
        ctx.globalAlpha = clamp((gp - 0.15) / 0.5) * lerp(1, 0.85, dim);
        ctx.fillStyle = P.accent;
        ctx.fillRect(140 + gw + 10, g.y - 26, 32, 32);
        ctx.restore();
      }

      // measured baseline under the block
      const under = at(t, wt(f, "graphics") + 0.4, wt(f, "graphics") + 1.1, easeOutExpo);
      rule(
        ctx,
        140,
        g.y + 44,
        1180,
        under,
        rgba(P.bone, 0.16 * baseAlpha),
        1,
      );
    }

    /* ------------------------------------------------- app window + strike */
    const winStart = wt(f, "without") - 0.35;
    const win = at(t, winStart, winStart + 0.85, easeOutExpo);
    if (win > 0) {
      const wx = 1120;
      const wy = lerp(210, 180, win);
      const ww = 660;
      const wh = 300;
      ctx.save();
      ctx.globalAlpha = win;
      ctx.translate(0, (1 - win) * 22);
      panel(ctx, wx, wy, ww, wh, { title: "after_effects", accent: P.accent, fill: P.panel });

      // fake layer stack
      const rows = ["comp 01", "type / kinetic", "shape / arcs", "camera / push"];
      rows.forEach((r, i) => {
        const y = wy + 72 + i * 34;
        const a = 0.35 - i * 0.05;
        ctx.fillStyle = rgba(P.bone, a * 0.5);
        ctx.fillRect(wx + 22, y, ww - 44, 22);
        txt(ctx, r, wx + 32, y + 16, {
          size: 15,
          face: "Mono400",
          color: P.bone,
          alpha: 0.5,
        });
      });
      // timeline strip
      const stripY = wy + wh - 54;
      ctx.fillStyle = rgba(P.bone, 0.07);
      ctx.fillRect(wx + 22, stripY, ww - 44, 30);
      for (let i = 0; i < 26; i++) {
        const sx = wx + 26 + i * ((ww - 52) / 26);
        const h = 8 + ((i * 37) % 11);
        ctx.fillStyle = rgba(P.accent, 0.28);
        ctx.fillRect(sx, stripY + 15 - h / 2, 3, h);
      }
      ctx.restore();

      // the strike: two strokes crossing the window
      const s1 = at(t, wt(f, "opening"), wt(f, "opening") + 0.34, easeOutCubic);
      const s2 = at(t, wt(f, "effects"), wt(f, "effects") + 0.3, easeOutCubic);
      strike(ctx, wx - 20, wy - 20, wx + ww + 20, wy + wh + 20, s1, P.accent, 7);
      strike(ctx, wx + ww + 20, wy - 20, wx - 20, wy + wh + 20, s2, P.accent, 7);

      if (s1 > 0.2) {
        chip(ctx, "app not opened", wx + ww - 214, wy + wh + 22, {
          accent: P.accent,
          alpha: 0.9,
          size: 15,
        });
      }
    }

    /* ------------------------------------------------------ metadata block */
    const meta = at(t, we(f, "effects") - 0.2, we(f, "effects") + 0.9);
    if (meta > 0) {
      const lines = [
        ["file", "app/src/plates/model.ts"],
        ["keyframes", "0"],
        ["render", "chrome --headless → ffmpeg"],
      ];
      lines.forEach(([k, v], i) => {
        const y = 790 + i * 30;
        const a = meta * (1 - i * 0.12);
        txt(ctx, k, 1120, y, {
          size: 15,
          face: "Mono500",
          tracking: 2.6,
          color: P.bone,
          alpha: 0.32 * a,
        });
        txt(ctx, v, 1235, y, {
          size: 15,
          face: "Mono400",
          color: P.bone,
          alpha: 0.6 * a,
        });
      });
    }

    ctx.restore();
  },
};

export default plate;
