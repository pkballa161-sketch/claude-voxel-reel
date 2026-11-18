// The camera. Every plate is shot rather than merely drawn: a slow move across
// the whole beat, a punch on each spoken hit, and a little handheld drift so the
// frame is never frozen. Pure functions of time, so the sub-frame motion blur
// pass smears the move correctly.
import { H, W, type Ctx } from "./canvas.ts";
import type { Canvas } from "@napi-rs/canvas";
import {
  clamp,
  decay,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  noise1,
} from "./anim.ts";
import type { Line } from "../types.ts";

export interface Cam {
  zoom: number;
  x: number;
  y: number;
}

interface Hit {
  frag: string;
  zoomAmp: number;
  panAmp?: number;
}

interface Recipe {
  zoom: [number, number];
  x: [number, number];
  y: [number, number];
  ease: (p: number) => number;
  hits: Hit[];
}

const RECIPES: Record<string, Recipe> = {
  // Opening: a patient push, punctuated where the sentence lands.
  model: {
    zoom: [1.0, 1.09],
    x: [-14, 18],
    y: [6, -8],
    ease: easeInOutCubic,
    hits: [
      { frag: "motion", zoomAmp: 0.05, panAmp: -10 },
      { frag: "graphics", zoomAmp: 0.07, panAmp: 12 },
      { frag: "without", zoomAmp: 0.03 },
      { frag: "effects", zoomAmp: 0.045, panAmp: -8 },
    ],
  },
  // Lateral drift, so it reads as a different set-up from the plate before.
  prompt: {
    zoom: [1.1, 1.04],
    x: [26, -22],
    y: [-6, 10],
    ease: easeInOutCubic,
    hits: [
      { frag: "guessing", zoomAmp: 0.035, panAmp: 8 },
      { frag: "claude", zoomAmp: 0.07, panAmp: -14 },
      { frag: "program", zoomAmp: 0.05, panAmp: 10 },
    ],
  },
  // The light plate enters tight and releases as the prompt is listed.
  crazy: {
    zoom: [1.16, 1.03],
    x: [10, -16],
    y: [-10, 8],
    ease: easeInOutCubic,
    hits: [
      { frag: "cinematic", zoomAmp: 0.04 },
      { frag: "smooth", zoomAmp: 0.03, panAmp: 10 },
      { frag: "seamless", zoomAmp: 0.05, panAmp: -12 },
    ],
  },
  // Reading down the file.
  code: {
    zoom: [1.05, 1.13],
    x: [-8, 12],
    y: [-26, 22],
    ease: easeInOutCubic,
    hits: [
      { frag: "typescript", zoomAmp: 0.06, panAmp: 10 },
      { frag: "pure", zoomAmp: 0.05, panAmp: -10 },
      { frag: "time", zoomAmp: 0.04 },
    ],
  },
  frames: {
    zoom: [1.02, 1.12],
    x: [16, -12],
    y: [10, -14],
    ease: easeInOutCubic,
    hits: [
      { frag: "renders", zoomAmp: 0.05, panAmp: -8 },
      { frag: "ffmpeg", zoomAmp: 0.065, panAmp: 10 },
      { frag: "video", zoomAmp: 0.04 },
    ],
  },
  // Three refusals, three jabs.
  pipeline: {
    zoom: [1.12, 1.06],
    x: [-18, 20],
    y: [8, -8],
    ease: easeInOutCubic,
    hits: [
      { frag: "timeline", zoomAmp: 0.05, panAmp: -14 },
      { frag: "stacks", zoomAmp: 0.045, panAmp: 12 },
      { frag: "keyframes", zoomAmp: 0.06, panAmp: -10 },
      { frag: "nudge", zoomAmp: 0.05, panAmp: 8 },
    ],
  },
  procedural: {
    zoom: [1.04, 1.14],
    x: [14, -20],
    y: [12, -10],
    ease: easeInOutCubic,
    hits: [
      { frag: "number", zoomAmp: 0.05, panAmp: 10 },
      { frag: "downstream", zoomAmp: 0.035 },
      { frag: "blue", zoomAmp: 0.08, panAmp: -12 },
      { frag: "slower", zoomAmp: 0.06, panAmp: 10 },
    ],
  },
  // Holds still for the question, then commits to the slam.
  verdict: {
    zoom: [1.0, 1.16],
    x: [-6, 8],
    y: [4, -10],
    ease: easeInOutCubic,
    hits: [
      { frag: "replace", zoomAmp: 0.03 },
      { frag: "really", zoomAmp: 0.1, panAmp: -18 },
      { frag: "insane", zoomAmp: 0.07, panAmp: 12 },
    ],
  },
  outro: {
    zoom: [1.14, 1.0],
    x: [12, -10],
    y: [-8, 6],
    ease: easeOutCubic,
    hits: [
      { frag: "code", zoomAmp: 0.05, panAmp: -8 },
      { frag: "workflow", zoomAmp: 0.04, panAmp: 8 },
    ],
  },
};

const FALLBACK: Recipe = {
  zoom: [1.02, 1.08],
  x: [-8, 8],
  y: [4, -4],
  ease: easeInOutCubic,
  hits: [],
};

const SEED: Record<string, number> = {
  model: 1.7,
  prompt: 3.1,
  crazy: 4.4,
  code: 5.9,
  frames: 7.3,
  pipeline: 8.6,
  procedural: 10.2,
  verdict: 11.8,
  outro: 13.4,
};

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9']/g, "");

function wordAt(line: Line, frag: string) {
  const n = norm(frag);
  return line.words.find((w) => norm(w.w).startsWith(n));
}

/** Camera for `t` on `line`; `p` is progress through that plate. */
export function cameraAt(t: number, line: Line, p: number): Cam {
  const r = RECIPES[line.id] ?? FALLBACK;
  const k = r.ease(clamp(p));
  let zoom = lerp(r.zoom[0], r.zoom[1], k);
  let x = lerp(r.x[0], r.x[1], k);
  let y = lerp(r.y[0], r.y[1], k);

  const seed = SEED[line.id] ?? 2;
  zoom += noise1(t * 0.37 + seed) * 0.005;
  x += noise1(t * 0.29 + seed * 2) * 5;
  y += noise1(t * 0.23 + seed * 3) * 4;

  for (const hit of r.hits) {
    const w = wordAt(line, hit.frag);
    if (!w) continue;
    const d = decay(t, w.s, 7.5);
    if (d <= 0.0005) continue;
    zoom += hit.zoomAmp * d;
    const pan = hit.panAmp ?? 0;
    x += pan * d;
    y += pan * 0.45 * d;
    if (hit.zoomAmp >= 0.07) {
      // a hard hit gets a short mechanical shake
      x += Math.sin((t - w.s) * 70) * 9 * d;
      y += Math.cos((t - w.s) * 63) * 6 * d;
    }
  }

  zoom = clamp(zoom, 1, 1.28);
  const mx = ((zoom - 1) * W) / 2;
  const my = ((zoom - 1) * H) / 2;
  return {
    zoom,
    x: clamp(x, -mx, mx),
    y: clamp(y, -my, my),
  };
}

/** Draws a supersampled stage through a camera into `ctx`. */
export function drawStage(
  ctx: Ctx,
  stage: Canvas,
  cam: Cam,
  o: { dx?: number; dy?: number; alpha?: number; zoomMul?: number } = {},
): void {
  const z = cam.zoom * (o.zoomMul ?? 1);
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.translate(W / 2 + cam.x + (o.dx ?? 0), H / 2 + cam.y + (o.dy ?? 0));
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(stage, 0, 0, stage.width, stage.height, 0, 0, W, H);
  ctx.restore();
}
