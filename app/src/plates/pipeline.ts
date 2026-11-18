// 06 — the things this workflow does not have.
import { P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import { at, clamp, easeInOutCubic, easeOutCubic, easeOutExpo, lerp } from "../engine/anim.ts";
import { bloom, chip, panel, rule, strike } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { find, we, wt } from "./_lib.ts";

const CARDS = [
  { title: "TIMELINE", sub: "scrub, ripple, re-link", anchor: "timeline" },
  { title: "LAYER STACK", sub: "twenty comps deep", anchor: "layer" },
  { title: "1,284 KEYFRAMES", sub: "each one hand-nudged", anchor: "keyframes" },
];

const plate: Plate = {
  id: "pipeline",
  label: "subtractions",
  draw(ctx: Ctx, f) {
    const t = f.lt;
    bloom(ctx, 1400, 460, 640, P.accent, 0.03 + f.level * 0.04);

    label(ctx, "the old way", 140, 190, { size: 17, tracking: 4, color: P.bone, alpha: 0.45 });
    rule(ctx, 140, 210, 700, at(t, 0, 0.7, easeOutExpo), rgba(P.bone, 0.16), 1);

    let lastStrike = -1;
    CARDS.forEach((card, i) => {
      const y = 250 + i * 170;
      const inP = at(t, 0.15 + i * 0.12, 0.8 + i * 0.12, easeOutExpo);
      const hit = at(t, wt(f, card.anchor) - 0.05, wt(f, card.anchor) + 0.35, easeOutCubic);
      const fade = lerp(1, 0.22, at(t, wt(f, card.anchor) + 0.1, wt(f, card.anchor) + 0.7, easeOutCubic));
      if (hit > 0.5) lastStrike = i;

      ctx.save();
      ctx.globalAlpha = inP;
      ctx.translate(0, (1 - inP) * 30);

      panel(ctx, 140, y, 700, 128, { fill: "#0e1015" });
      txt(ctx, card.title, 172, y + 62, {
        size: 42,
        face: "Archivo700",
        tracking: -1,
        color: P.bone,
        alpha: 0.92 * fade,
      });
      txt(ctx, card.sub, 172, y + 96, {
        size: 17,
        face: "Mono400",
        color: P.bone,
        alpha: 0.38 * fade,
      });

      // mini motif on the right of each card
      ctx.save();
      ctx.globalAlpha *= fade;
      ctx.strokeStyle = rgba(P.bone, 0.2);
      ctx.lineWidth = 1;
      if (i === 0) {
        for (let k = 0; k < 3; k++) ctx.strokeRect(700 - k * 8 + 0, y + 30 + k * 22, 100 - k * 20, 14);
      } else if (i === 1) {
        for (let k = 0; k < 3; k++) ctx.strokeRect(700 + (k - 1) * 16, y + 34 + k * 20, 74, 16);
      } else {
        for (let k = 0; k < 7; k++) {
          ctx.beginPath();
          ctx.moveTo(660 + k * 11, y + 92 - (k % 3) * 16);
          ctx.lineTo(660 + k * 11, y + 40);
          ctx.stroke();
          ctx.fillStyle = rgba(P.bone, 0.5);
          ctx.beginPath();
          ctx.arc(660 + k * 11, y + 92 - (k % 3) * 16, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      if (hit > 0) {
        strike(ctx, 160, y + 60, 160 + 560 * clamp(hit + 0.1), y + 52, hit, P.accent, 6);
      }
      ctx.restore();
    });

    /* ----------------------------------------------------------- the big no */
    const firstStrike = wt(f, "timeline");
    const noIn = at(t, firstStrike - 0.05, firstStrike + 0.5, easeOutExpo);
    if (noIn > 0) {
      const slam = (idx: number): number => {
        const a = idx === 0 ? wt(f, "timeline") : idx === 1 ? wt(f, "layer") : wt(f, "keyframes");
        return t < a ? 0 : 1 + Math.exp(-(t - a) * 9) * 0.22;
      };
      const scale = noIn * slam(lastStrike >= 0 ? lastStrike : 0);
      ctx.save();
      ctx.globalAlpha = noIn * 0.95;
      ctx.translate(1430, 500);
      ctx.scale(scale, scale);
      txt(ctx, "NO.", 0, 0, {
        size: 300,
        face: "Archivo900",
        tracking: -12,
        color: P.accent,
        align: "center",
        baseline: "middle",
      });
      ctx.restore();
      bloom(ctx, 1430, 460, 520, P.accent, 0.06 * noIn);
    }

    /* --------------------------------------------------------------- punchline */
    const end = at(t, we(f, "nudge") - 0.5, we(f, "nudge") + 0.6, easeOutCubic);
    if (end > 0) {
      ctx.save();
      ctx.globalAlpha = end;
      const w = 780;
      panel(ctx, W / 2 - w / 2, 748, w, 92, { fill: "rgba(255,90,31,0.06)", stroke: rgba(P.accent, 0.35) });
      txt(ctx, "plate.ts", W / 2 - w / 2 + 28, 804, {
        size: 30,
        face: "Mono500",
        color: P.bone,
      });
      chip(ctx, "0 keyframes", W / 2 - w / 2 + 210, 772, { accent: P.accent, filled: true, size: 15 });
      txt(ctx, "9 files · one render command", W / 2 - w / 2 + 420, 802, {
        size: 18,
        face: "Mono400",
        color: P.bone,
        alpha: 0.45,
      });
      ctx.restore();
    }
  },
};

export default plate;
