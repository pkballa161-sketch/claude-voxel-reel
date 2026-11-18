// 03 — the example prompt, marked up like a manuscript. Light plate.
import { P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import { at, clamp, easeOutCubic, easeOutExpo, lerp, seg } from "../engine/anim.ts";
import { chip, paper, rule } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { we, wt } from "./_lib.ts";

const INK = "#14161a";

interface Tok {
  w: string;
  kw?: boolean;
  ann?: string;
  value?: string;
}

const PROMPT: Tok[] = [
  { w: "Create", },
  { w: "a" },
  { w: "15-second", kw: true, ann: "duration", value: "15.0 s" },
  { w: "cinematic", kw: true, ann: "grade", value: "warm ink" },
  { w: "sequence", },
  { w: "with", },
  { w: "kinetic", kw: true },
  { w: "typography,", kw: true, ann: "type", value: "word level" },
  { w: "smooth", },
  { w: "shape", },
  { w: "transitions,", ann: "shapes", value: "morph" },
  { w: "and", },
  { w: "seamless", },
  { w: "camera", ann: "camera", value: "seamless push" },
  { w: "movement.", },
];

const SYL = (s: string): number => {
  const w = s.toLowerCase().replace(/[^a-z]/g, "");
  const m = w.match(/[aeiouy]+/g);
  return Math.max(1, m ? m.length : 1);
};

const plate: Plate = {
  id: "crazy",
  label: "the prompt",
  light: true,
  draw(ctx: Ctx, f) {
    const t = f.lt;
    paper(ctx, { light: true, alpha: 0.075, zoom: 1 });

    // manuscript furniture
    label(ctx, "prompt / 01", 140, 190, { size: 17, tracking: 4, color: INK, alpha: 0.5 });
    label(ctx, "the request", 1780, 190, {
      size: 17,
      tracking: 3.4,
      color: INK,
      alpha: 0.38,
      align: "right",
    });
    rule(ctx, 140, 210, 1640, at(t, 0, 0.8, easeOutExpo), rgba(INK, 0.28), 1);

    // left margin ticks
    for (let i = 0; i < 12; i++) {
      const a = at(t, 0.1 + i * 0.03, 0.4 + i * 0.03);
      ctx.fillStyle = rgba(INK, 0.18 * a);
      ctx.fillRect(96, 300 + i * 44, i % 4 === 0 ? 26 : 14, 1);
    }

    /* --------------------------------------------------------------- layout */
    const size = 62;
    const leading = 94;
    const maxWidth = 1180;
    const space = measure(ctx, " ", size, "Serif600", -1.5) + 8;
    let x = 200;
    let y = 350;
    const placed: Array<{ tok: Tok; x: number; y: number; w: number }> = [];
    for (const tok of PROMPT) {
      const face = tok.kw ? "SerifI600" : "Serif600";
      const w = measure(ctx, tok.w, size, face, -1.5);
      if (x + w > 200 + maxWidth) {
        x = 200;
        y += leading;
      }
      placed.push({ tok, x, y, w });
      x += w + space;
    }

    /* --------------------------------------------------------------- timing */
    const start = wt(f, "create") - 0.15;
    const end = we(f, "movement");
    const weights = PROMPT.map((tok) => SYL(tok.w) + (/[,.]$/.test(tok.w) ? 0.6 : 0));
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = 0;
    const times = weights.map((w) => {
      const t0 = start + (cursor / total) * (end - start);
      cursor += w;
      return t0;
    });

    /* ---------------------------------------------------------------- draw */
    const cam = lerp(1.015, 1.0, easeOutCubic(seg(t, 0, 10)));
    ctx.save();
    ctx.translate(W / 2, 470);
    ctx.scale(cam, cam);
    ctx.translate(-W / 2, -470);

    // opening quotation mark
    txt(ctx, "“", 140, 470, {
      size: 240,
      face: "Serif400",
      color: INK,
      alpha: 0.12 * at(t, 0.2, 1.0),
    });

    placed.forEach((p, i) => {
      const p0 = at(t, times[i] - 0.12, times[i] + 0.5, easeOutExpo);
      if (p0 <= 0.001) return;
      const face = p.tok.kw ? "SerifI600" : "Serif600";
      ctx.save();
      ctx.globalAlpha = p0;
      ctx.translate(0, (1 - p0) * 18);
      txt(ctx, p.tok.w, p.x, p.y, {
        size,
        face,
        tracking: -1.5,
        color: p.tok.kw ? P.accent : INK,
      });
      ctx.restore();

      // hand underline beneath keyword runs
      if (p.tok.kw) {
        const u = at(t, times[i] + 0.22, times[i] + 0.6, easeOutCubic);
        const strokeW = 3;
        if (u > 0) {
          ctx.save();
          ctx.strokeStyle = rgba(P.accent, 0.5);
          ctx.lineWidth = strokeW;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + 14);
          const steps = 8;
          for (let s = 1; s <= steps * clamp(u); s++) {
            const k = s / steps;
            ctx.lineTo(p.x + p.w * k, p.y + 14 + Math.sin(k * 6) * 1.4);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    });

    // margin notes, stacked so they never collide
    const notes = placed
      .map((p, i) => ({ p, i }))
      .filter((entry) => entry.p.tok.ann);
    if (notes.length) {
      const colX = 1478;
      const topY = 288;
      const step = 64;
      ctx.save();
      ctx.strokeStyle = rgba(INK, 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colX, topY - 12);
      ctx.lineTo(colX, topY + (notes.length - 1) * step + 40);
      ctx.stroke();
      ctx.restore();

      notes.forEach((entry, row) => {
        const a = at(t, times[entry.i] + 0.45, times[entry.i] + 0.95, easeOutCubic);
        if (a <= 0.01) return;
        const ay = topY + row * step;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = rgba(INK, 0.24);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX, ay + 15);
        ctx.lineTo(colX + 22, ay + 15);
        ctx.stroke();
        ctx.fillStyle = P.accent;
        ctx.beginPath();
        ctx.arc(colX, ay + 15, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const cw = chip(ctx, entry.p.tok.ann, colX + 26, ay, {
          accent: P.accent,
          light: true,
          alpha: a,
          size: 14,
        });
        if (entry.p.tok.value) {
          label(ctx, entry.p.tok.value, colX + 34 + cw, ay + 22, {
            size: 13,
            tracking: 2,
            color: INK,
            alpha: 0.42 * a,
          });
        }
      });
    }

    // the prompt resolving into a nine-plate timeline
    const stripP = at(t, end - 1.1, end - 0.2, easeOutCubic);
    if (stripP > 0) {
      const names = [
        "hook",
        "model",
        "prompt",
        "source",
        "render",
        "cuts",
        "number",
        "verdict",
        "workflow",
      ];
      const gap = 8;
      const segW = (1640 - gap * (names.length - 1)) / names.length;
      ctx.save();
      ctx.globalAlpha = stripP;
      names.forEach((name, i) => {
        const x = 140 + i * (segW + gap);
        const h = 30 * clamp((stripP * 1.4 - i * 0.06));
        ctx.fillStyle = i === 2 ? rgba(P.accent, 0.85) : rgba(INK, 0.12);
        ctx.fillRect(x, 706 + (30 - h), segW, Math.max(0, h));
        label(ctx, name, x, 694, {
          size: 13,
          tracking: 2.4,
          color: i === 2 ? P.accent : INK,
          alpha: i === 2 ? 1 : 0.45,
        });
      });
      label(ctx, "nine plates · 80.0s", 1780, 694, {
        size: 13,
        tracking: 2.4,
        color: INK,
        alpha: 0.4,
        align: "right",
      });
      ctx.restore();
    }

    ctx.restore();

    /* ------------------------------------------------------------- footer */
    const foot = at(t, end - 0.5, end + 0.6, easeOutCubic);
    if (foot > 0) {
      ctx.save();
      ctx.globalAlpha = foot;
      rule(ctx, 140, 820, 1640, 1, rgba(INK, 0.18), 1);
      label(ctx, "→ nine plates · one file each · zero keyframes", 140, 862, {
        size: 16,
        tracking: 3,
        color: INK,
        alpha: 0.55,
      });
      label(ctx, "1920 × 1080", 1780, 862, {
        size: 16,
        tracking: 3,
        color: INK,
        alpha: 0.4,
        align: "right",
      });
      ctx.restore();
    }
  },
};

export default plate;
