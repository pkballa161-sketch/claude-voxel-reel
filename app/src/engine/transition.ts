// Transitions between plates. Each boundary gets its own move: whip pans,
// punch-ins, venetian band swaps, glitch slices, a zoom-through and one slow
// settle at the end. Every plate boundary overlaps by DUR seconds, and the mix
// already drops a whoosh exactly there.
import { H, W, type Ctx, type Layer } from "./canvas.ts";
import type { Canvas } from "@napi-rs/canvas";
import {
  clamp,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  easeOutExpo,
  lerp,
  rand,
} from "./anim.ts";
import { rgba } from "./color.ts";
import { drawStage, type Cam } from "./camera.ts";
import type { Timeline } from "../types.ts";

// The mix runs mostly before the cut, then rides a little past it so the
// incoming plate is already animating in when the cut lands.
export const PRE = 0.30;
export const POST = 0.12;
export const DUR = PRE + POST;

export type Kind =
  | "whip-h"
  | "slam"
  | "slice"
  | "glitch"
  | "whip-v"
  | "through"
  | "flash"
  | "settle";

export const KINDS: Kind[] = [
  "whip-h",
  "slam",
  "slice",
  "glitch",
  "whip-v",
  "through",
  "flash",
  "settle",
];

export interface TransitionAt {
  fromId: string;
  toId: string;
  toStart: number;
  p: number;
  kind: Kind;
}

/** The transition running at `t`, if any (it ends exactly on the cut). */
export function transitionAt(t: number, tl: Timeline): TransitionAt | null {
  for (let i = 1; i < tl.lines.length; i++) {
    const to = tl.lines[i];
    const start = to.plateStart - PRE;
    if (t >= start && t < to.plateStart + POST) {
      return {
        fromId: tl.lines[i - 1].id,
        toId: to.id,
        toStart: to.plateStart,
        p: (t - start) / DUR,
        kind: KINDS[(i - 1) % KINDS.length],
      };
    }
  }
  return null;
}

export interface Args {
  ctx: Ctx;
  smear: Layer;
  A: Canvas;
  B: Canvas;
  camA: Cam;
  camB: Cam;
  p: number;
  accent: string;
  light: boolean;
}

/** Accumulates a motion-blur smear into `smear`, then lays it down at full alpha. */
function accumulate(smear: Layer, draw: (c: Ctx) => void): void {
  const c = smear.ctx;
  smear.clear();
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = "lighter";
  draw(c);
  c.restore();
}

function lay(ctx: Ctx, smear: Layer): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(smear.canvas, 0, 0);
  ctx.restore();
}

function flashFill(ctx: Ctx, color: string, alpha: number): void {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function applyTransition(kind: Kind, a: Args): void {
  const { ctx, smear, A, B, camA, camB, p } = a;

  switch (kind) {
    /* ---------------------------------------------------- horizontal whip */
    case "whip-h":
    case "whip-v": {
      const vertical = kind === "whip-v";
      const dir = vertical ? H : W;
      const e = easeInOutCubic(clamp(p));
      const v = Math.pow(Math.sin(Math.PI * clamp(p)), 1.3);
      const blur = (vertical ? 90 : 190) * v;
      const taps = 5;
      accumulate(smear, (c) => {
        for (let i = 0; i < taps; i++) {
          const o = (i / (taps - 1) - 0.5) * blur;
          const out = -dir * 1.1 * e + o;
          const inn = dir * 1.1 * (1 - e) + o;
          drawStage(c, A, camA, {
            dx: vertical ? 0 : out,
            dy: vertical ? out : 0,
            alpha: 1 / taps,
            zoomMul: 1 + 0.035 * v,
          });
          drawStage(c, B, camB, {
            dx: vertical ? 0 : inn,
            dy: vertical ? inn : 0,
            alpha: 1 / taps,
            zoomMul: 1 + 0.035 * v,
          });
        }
      });
      lay(ctx, smear);
      break;
    }

    /* ------------------------------------------------- punch through a hit */
    case "slam": {
      const out = clamp(p / 0.58);
      const inn = clamp((p - 0.26) / 0.74);
      accumulate(smear, (c) => {
        const taps = 4;
        for (let i = 0; i < taps; i++) {
          const k = i / (taps - 1);
          drawStage(c, A, camA, {
            alpha: (1 - 0.85 * out) / taps,
            zoomMul: 1 + (0.28 + 0.34 * k) * easeInCubic(out),
          });
        }
      });
      lay(ctx, smear);
      if (inn > 0) {
        drawStage(ctx, B, camB, {
          alpha: easeOutCubic(inn),
          zoomMul: lerp(1.32, 1, easeOutExpo(inn)),
        });
      }
      flashFill(
        ctx,
        a.light ? "#ffffff" : a.accent,
        (a.light ? 0.12 : 0.4) * Math.max(0, 1 - Math.abs(p - 0.5) * 3.4),
      );
      break;
    }

    /* -------------------------------------------------- venetian bands */
    case "slice": {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const y0 = Math.round((i / n) * H);
        const y1 = Math.round(((i + 1) / n) * H);
        const lp = clamp((p - (i % 3) * 0.055) / 0.82);
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(0, y0, W, y1 - y0);
        ctx.clip();
        drawStage(ctx, A, camA, { dx: -dir * W * easeInCubic(lp) });
        drawStage(ctx, B, camB, { dx: dir * W * (1 - easeOutCubic(lp)) });
        ctx.restore();
      }
      break;
    }

    /* ------------------------------------------------------------- glitch */
    case "glitch": {
      const j = (s: number): number => rand(s) - 0.5;
      const step = Math.floor(p * 22);
      drawStage(ctx, A, camA, { dy: j(step * 3.7) * 16 * (1 - p) });
      const n = 8;
      for (let i = 0; i < n; i++) {
        const seed = step * 11.3 + i * 5.1;
        if (rand(seed) < 0.34) continue;
        const y0 = Math.round((i / n) * H + j(seed + 1) * 40);
        const h = Math.round(H / n + j(seed + 2) * 30);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(0, y0, W, h);
        ctx.clip();
        drawStage(ctx, B, camB, {
          dx: j(seed + 3) * 220 * (1 - p),
          alpha: clamp(p * 1.8),
        });
        ctx.restore();
      }
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const g = 0.42 * (1 - p) * Math.pow(Math.sin(Math.PI * clamp(p)), 0.5);
      drawStage(ctx, A, camA, { dx: -12, alpha: g });
      drawStage(ctx, A, camA, { dx: 12, alpha: g });
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        const seed = step * 3.1 + i * 9.7;
        if (rand(seed) < 0.5) continue;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = rgba(a.accent, 0.22 * (1 - p));
        ctx.fillRect(0, H * rand(seed + 1), W, 3 + rand(seed + 2) * 10);
        ctx.restore();
      }
      break;
    }

    /* ------------------------------------------------------ zoom through */
    case "through": {
      const out = clamp(p / 0.62);
      const inn = clamp((p - 0.42) / 0.58);
      accumulate(smear, (c) => {
        const taps = 5;
        for (let i = 0; i < taps; i++) {
          const k = i / (taps - 1);
          drawStage(c, A, camA, {
            alpha: (1 - 0.9 * out) / taps,
            zoomMul: 1 + (1.35 + 0.2 * k) * easeInCubic(out),
          });
        }
      });
      lay(ctx, smear);
      if (inn > 0) {
        drawStage(ctx, B, camB, {
          alpha: easeOutCubic(inn),
          zoomMul: lerp(1.8, 1, easeOutExpo(inn)),
        });
      }
      break;
    }

    /* -------------------------------------------------------- flash cut */
    case "flash": {
      if (p < 0.5) {
        drawStage(ctx, A, camA, { zoomMul: 1 + 0.04 * easeInCubic(p * 2) });
      } else {
        drawStage(ctx, B, camB, {
          zoomMul: 1 + 0.05 * (1 - easeOutExpo((p - 0.5) * 2)),
        });
      }
      flashFill(ctx, a.light ? "#ffffff" : a.accent, 0.5 * Math.max(0, 1 - Math.abs(p - 0.5) * 3.4));
      break;
    }

    /* ------------------------------------------------------------ settle */
    case "settle":
    default: {
      const k = easeInOutCubic(clamp(p));
      drawStage(ctx, A, camA, { alpha: 1 - k, zoomMul: 1 + 0.05 * k });
      drawStage(ctx, B, camB, { alpha: k, zoomMul: lerp(1.06, 1, k) });
      break;
    }
  }
}
