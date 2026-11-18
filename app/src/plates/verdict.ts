// 08 — does it replace the old tool? No. It replaces the workflow.
import { H, P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import {
  at,
  clamp,
  decay,
  easeInOutCubic,
  easeOutCubic,
  easeOutExpo,
  lerp,
  noise1,
  seg,
} from "../engine/anim.ts";
import { bloom, bloom as glow, chip, rule } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { we, wt } from "./_lib.ts";

const plate: Plate = {
  id: "verdict",
  label: "the verdict",
  draw(ctx: Ctx, f) {
    const t = f.lt;
    const slam = (anchor: string, k = 9): number => decay(t, wt(f, anchor), k);
    const shake =
      (slam("really", 10) * 10 + slam("insane", 8) * 16) *
      Math.sin(t * 61) *
      0.6;

    ctx.save();
    ctx.translate(shake, Math.cos(t * 53) * shake * 0.5);

    const shrink = at(t, wt(f, "really") - 0.3, wt(f, "really") + 0.5, easeInOutCubic);
    const finalIn = at(t, wt(f, "pretty") - 0.15, wt(f, "pretty") + 0.6, easeOutCubic);

    /* ---------------------------------------------------------- the question */
    if (finalIn < 1) {
      const qy = lerp(340, 210, shrink);
      const qs = lerp(104, 30, shrink);
      const qAlpha = lerp(1, 0.32, shrink);
      ctx.save();
      ctx.globalAlpha = qAlpha;
      const lines = ["DOES THIS REPLACE", "AFTER EFFECTS?"];
      lines.forEach((line, i) => {
        const p = at(t, 0.15 + i * 0.16, 0.9 + i * 0.16, easeOutExpo);
        const size = i === 0 ? qs : qs;
        const face = i === 1 ? "SerifI600" : "Archivo900";
        const w = measure(ctx, line, size, face, i === 0 ? -3 : -1);
        ctx.save();
        ctx.beginPath();
        ctx.rect(W / 2 - 800, qy + i * (qs * 1.06) - qs, 1600, qs * 1.5);
        ctx.clip();
        ctx.globalAlpha = qAlpha * p;
        txt(ctx, line, W / 2, qy + i * (qs * 1.06), {
          size,
          face,
          tracking: i === 0 ? -3 : -1,
          color: i === 1 ? P.accent : P.bone,
          align: "center",
        });
        ctx.restore();
        void w;
      });
      ctx.restore();
    }

    /* ------------------------------------------------------------ not really */
    const nr = at(t, wt(f, "really") - 0.1, wt(f, "really") + 0.7, easeOutExpo);
    if (nr > 0 && finalIn < 0.6) {
      const scale = 1 + slam("really", 12) * 0.06;
      ctx.save();
      ctx.globalAlpha = nr * (1 - finalIn);
      ctx.translate(W / 2, 560);
      ctx.scale(scale, scale);
      txt(ctx, "NOT", 0, -30, {
        size: 150,
        face: "Archivo900",
        tracking: -6,
        color: P.bone,
        align: "center",
      });
      txt(ctx, "REALLY.", 0, 120, {
        size: 150,
        face: "Archivo900",
        tracking: -6,
        color: P.accent,
        align: "center",
      });
      ctx.restore();

      // honest little list
      const listP = at(t, we(f, "really") + 0.1, we(f, "really") + 0.9, easeOutCubic);
      if (listP > 0) {
        ctx.save();
        ctx.globalAlpha = listP * 0.9;
        const items = ["art direction", "kerning", "colour grade", "client notes"];
        let x = W / 2 - 330;
        for (const item of items) {
          const w = chip(ctx, item, x, 700, { accent: P.bone, size: 14, alpha: 0.55 });
          x += w + 10;
        }
        ctx.restore();
      }
    }

    /* -------------------------------------------------------- the concession */
    const but = at(t, wt(f, "but") - 0.15, wt(f, "but") + 0.6, easeOutCubic);
    if (but > 0 && finalIn < 0.85) {
      ctx.save();
      ctx.globalAlpha = but * (1 - finalIn);
      txt(ctx, "but for motion driven by a voiceover,", W / 2, 830, {
        size: 40,
        face: "Archivo400",
        color: P.bone,
        alpha: 0.75,
        align: "center",
      });
      const def = at(t, wt(f, "defined") - 0.1, wt(f, "defined") + 0.5, easeOutCubic);
      if (def > 0) {
        ctx.globalAlpha = def * (1 - finalIn);
        chip(ctx, "and defined mathematically", W / 2, 866, {
          accent: P.accent,
          size: 14,
          align: "center",
        });
      }
      ctx.restore();
    }

    /* ------------------------------------------------------------ the slam */
    if (finalIn > 0) {
      const words = [
        { text: "PRETTY", anchor: "pretty", y: 520, size: 200, color: P.bone },
        { text: "INSANE.", anchor: "insane", y: 730, size: 220, color: P.accent },
      ];
      const implode = at(t, we(f, "insane") + 0.35, we(f, "insane") + 1.5, easeInOutCubic);
      ctx.save();
      ctx.globalAlpha = 1 - implode;
      ctx.translate(W / 2, 620);
      const s = lerp(1, 0.55, implode);
      ctx.scale(s, s);
      ctx.translate(-W / 2, -620);

      words.forEach((w, i) => {
        const p = at(t, wt(f, w.anchor) - 0.12, wt(f, w.anchor) + 0.42, easeOutExpo);
        if (p <= 0) return;
        const sc = lerp(1.22, 1, p) * (1 + slam(w.anchor, 11) * 0.03);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, w.y - w.size, W, w.size * 1.35);
        ctx.clip();
        ctx.translate(W / 2, w.y);
        ctx.scale(sc, sc);
        txt(ctx, w.text, 0, 0, {
          size: w.size,
          face: i === 0 ? "Archivo900" : "SerifI600",
          tracking: i === 0 ? -8 : -6,
          color: w.color,
          align: "center",
        });
        ctx.restore();
      });
      ctx.restore();

      if (slam("insane", 6) > 0.2) {
        glow(ctx, W / 2, 700, 700, P.accent, 0.25 * slam("insane", 6));
      }
    }

    // closing hairlines that frame the last beat
    const frameP = at(t, we(f, "insane") + 0.6, we(f, "insane") + 1.4, easeOutCubic);
    if (frameP > 0) {
      const w = lerp(200, 620, frameP);
      rule(ctx, W / 2 - w / 2, 810, w, 1, rgba(P.bone, 0.35), 1);
    }
    void seg;
    void H;
    void label;
    void bloom;
    ctx.restore();
  },
};

export default plate;
