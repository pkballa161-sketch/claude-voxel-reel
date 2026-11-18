// 07 — change a number, the whole video recomputes.
import { P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import {
  at,
  clamp,
  easeInOutCubic,
  easeOutCubic,
  easeOutExpo,
  lerp,
} from "../engine/anim.ts";
import { bloom, chip, panel, rule } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { arrow, codeLine, we, wt } from "./_lib.ts";

function speedAt(f: Parameters<Plate["draw"]>[1], tt: number): number {
  const up = at(tt, wt(f, "change") + 0.15, wt(f, "change") + 1.0, easeInOutCubic);
  const down = at(tt, wt(f, "slower") + 0.2, wt(f, "slower") + 1.15, easeInOutCubic);
  return lerp(lerp(1, 1.6, up), 0.62, down);
}

const plate: Plate = {
  id: "procedural",
  label: "one number",
  draw(ctx: Ctx, f) {
    const t = f.lt;
    const speed = speedAt(f, t);

    // integrate the (piecewise) speed so the ring angle stays a pure function of t
    let angle = 0;
    const dt = 1 / 120;
    for (let s = 0; s < t; s += dt) angle += speedAt(f, s) * dt;

    bloom(ctx, 1300, 500, 620, f.accent, 0.05 + f.level * 0.06);

    /* ---------------------------------------------------------- code panel */
    const px = 140;
    const py = 250;
    const pw = 640;
    const ph = 340;
    panel(ctx, px, py, pw, ph, { title: "timeline.ts" });
    const size = 25;
    codeLine(
      ctx,
      [
        { text: "const ", color: f.accent },
        { text: "SPEED", color: P.bone },
        { text: " = ", color: "#7d786f" },
        { text: speed.toFixed(2), color: f.accent },
      ],
      px + 34,
      py + 100,
      size,
    );
    const blue = t >= wt(f, "blue");
    codeLine(
      ctx,
      [
        { text: "const ", color: f.accent },
        { text: "HUE   ", color: P.bone },
        { text: " = ", color: "#7d786f" },
        { text: `"${blue ? "blue" : "orange"}"`, color: blue ? P.blue : P.accent },
      ],
      px + 34,
      py + 148,
      size,
    );
    codeLine(
      ctx,
      [
        { text: "const ", color: f.accent },
        { text: "FRAMES", color: P.bone },
        { text: " = ", color: "#7d786f" },
        { text: "5556", color: f.accent },
      ],
      px + 34,
      py + 196,
      size,
    );
    codeLine(
      ctx,
      [{ text: "// nothing else changes", color: "#5f5b54" }],
      px + 34,
      py + 252,
      20,
    );

    // recompute chain
    const chain = at(t, wt(f, "recomputes") - 0.2, wt(f, "recomputes") + 0.6, easeOutCubic);
    if (chain > 0) {
      ctx.save();
      ctx.globalAlpha = chain;
      const y = 660;
      let x = 170;
      for (const [i, labelText] of ["code", "frames", "video"].entries()) {
        const w = chip(ctx, labelText, x, y, {
          accent: f.accent,
          filled: i === 0,
          size: 14,
        });
        x += w + 10;
        if (i < 2) {
          arrow(ctx, x, y + 15, x + 40, y + 15, clamp((t - wt(f, "recomputes")) * 2 + i * 0.3), rgba(f.accent, 0.6), 1.5, 6);
          x += 52;
        }
      }
      ctx.restore();

      // pulse that runs the chain whenever a value changes
      const beat = Math.max(
        Math.exp(-Math.max(0, t - (wt(f, "change") + 0.9)) * 5),
        Math.exp(-Math.max(0, t - (wt(f, "blue") + 0.6)) * 5),
        Math.exp(-Math.max(0, t - (wt(f, "slower") + 0.9)) * 5),
      );
      bloom(ctx, 170 + 90 * clamp(t - wt(f, "recomputes")), 675, 160, f.accent, 0.2 * beat);
    }

    /* --------------------------------------------------------------- rings */
    const cx = 1300;
    const cy = 500;
    const ticks = 96;
    const radius = 246;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = rgba(P.bone, 0.14);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius - 46, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.rotate(angle * 0.32);
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      const long = i % 8 === 0;
      const r1 = radius - (long ? 20 : 10);
      const alpha = 0.18 + 0.55 * (i / ticks);
      ctx.strokeStyle = i % 2 === 0 ? rgba(f.accent, alpha) : rgba(P.bone, alpha * 0.5);
      ctx.lineWidth = long ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();
    }
    ctx.restore();

    // counter-rotating arcs
    ctx.save();
    ctx.rotate(-angle * 0.42);
    ctx.strokeStyle = rgba(f.accent, 0.75);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 72, -0.4, 1.6);
    ctx.stroke();
    ctx.strokeStyle = rgba(P.bone, 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, radius - 92, 2.2, 4.1);
    ctx.stroke();
    ctx.restore();

    // expanding wave whenever a value is edited
    for (const anchor of ["change", "slower"]) {
      const t0 = wt(f, anchor);
      const p = clamp((t - t0) / 0.9);
      if (t > t0 && p < 1) {
        ctx.strokeStyle = rgba(f.accent, 0.35 * (1 - p));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius + p * 180, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    /* ------------------------------------------------------------- readout */
    txt(ctx, speed.toFixed(2), cx, cy + 34, {
      size: 118,
      face: "Mono400",
      tracking: -4,
      color: P.bone,
      align: "center",
    });
    label(ctx, "speed", cx, cy + 78, {
      size: 15,
      tracking: 4,
      color: P.bone,
      alpha: 0.4,
      align: "center",
    });

    chip(ctx, blue ? "hue · blue" : "hue · orange", cx, cy + radius + 34, {
      accent: f.accent,
      size: 14,
      align: "center",
    });

    /* --------------------------------------------------------- one number */
    const stamp = at(t, we(f, "recomputes") - 0.2, we(f, "recomputes") + 0.7, easeOutExpo);
    if (stamp > 0) {
      ctx.save();
      ctx.globalAlpha = stamp;
      txt(ctx, "one number, whole video", 140, 800, {
        size: 30,
        face: "SerifI400",
        color: P.bone,
        alpha: 0.55,
      });
      ctx.restore();
    }
    void W;
  },
};

export default plate;
