// Composes a frame: plate content shot through the camera, transitions between
// plates, then treatments, HUD and captions.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Layer, P, ROOT, W, H, loadFonts, type Ctx } from "./engine/canvas.ts";
import { caption, cutSweep, grain, hud, paper, vignette } from "./engine/fx.ts";
import { at, clamp } from "./engine/anim.ts";
import { mixColor } from "./engine/color.ts";
import { cameraAt, drawStage, type Cam } from "./engine/camera.ts";
import { applyTransition, transitionAt } from "./engine/transition.ts";
import type { Frame, Line, Plate, Timeline } from "./types.ts";
import { plates } from "./plates/index.ts";

// Plates are rendered at K times the output size and then sampled down, so a
// pushed-in camera never has to upscale a raster.
export const K = 1.3;

export function loadTimeline(): Timeline {
  return JSON.parse(readFileSync(join(ROOT, "src/data/timeline.json"), "utf8")) as Timeline;
}

function accentFor(t: number, line: Line): string {
  if (line.id !== "procedural") return P.accent;
  const blue = line.words.find((w) => /blue/i.test(w.w));
  const slower = line.words.find((w) => /slower/i.test(w.w));
  if (!blue) return P.accent;
  const toBlue = mixColor(P.accent, P.blue, at(t, blue.s + 0.15, blue.s + 0.85));
  if (!slower) return toBlue;
  return mixColor(toBlue, P.accent, at(t, slower.s + 0.55, slower.s + 1.25));
}

const bgOf = (plate: Plate): string => (plate.light ? "#f2eee4" : P.ink);

export interface Composer {
  tl: Timeline;
  duration: number;
  scene: Layer;
  accum: Layer;
  out: Layer;
  drawScene: (ctx: Ctx, t: number, index: number) => Frame;
  drawOverlay: (ctx: Ctx, t: number, index: number) => void;
  draw: (t: number, index: number) => Ctx;
}

export function createComposer(tl: Timeline): Composer {
  loadFonts();
  const scene = new Layer();
  const accum = new Layer();
  const out = new Layer();
  const stageA = new Layer(Math.round(W * K), Math.round(H * K));
  const stageB = new Layer(Math.round(W * K), Math.round(H * K));
  const smear = new Layer();
  const cuts = tl.lines.map((l) => l.plateStart);

  function frameFor(line: Line, t: number, index: number): Frame {
    const span = Math.max(0.001, line.plateEnd - line.plateStart);
    const lt = Math.max(0, t - line.plateStart);
    return {
      t,
      lt,
      p: clamp(lt / span),
      i: index,
      line,
      tl,
      accent: accentFor(t, line),
      level: tl.env[Math.round(t * tl.fps)] ?? 0,
    };
  }

  /** Paints one plate into a supersampled stage, in plate coordinates. */
  function paint(stage: Layer, line: Line, t: number, index: number): void {
    const plate = plates[line.id];
    const f = frameFor(line, t, index);
    const c = stage.ctx;
    c.save();
    c.setTransform(K, 0, 0, K, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.fillStyle = bgOf(plate);
    c.fillRect(0, 0, W, H);
    if (!plate.light) {
      paper(c, { alpha: 0.036, x: -((t * 7) % 48), y: -((t * 4) % 48) });
    }
    plate.draw(c, f);
    c.restore();
  }

  const progress = (line: Line, t: number): number =>
    (t - line.plateStart) / Math.max(0.001, line.plateEnd - line.plateStart);

  const lineAt = (t: number): Line => {
    for (const l of tl.lines) if (t >= l.plateStart && t < l.plateEnd) return l;
    return t < tl.lines[0].plateStart ? tl.lines[0] : tl.lines[tl.lines.length - 1];
  };

  function drawScene(ctx: Ctx, t: number, index: number): Frame {
    const tr = transitionAt(t, tl);
    const line = lineAt(t);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = bgOf(plates[line.id]);
    ctx.fillRect(0, 0, W, H);

    if (tr) {
      const i = tl.lines.findIndex((l) => l.id === tr.toId);
      const fromLine = tl.lines[i - 1];
      const toLine = tl.lines[i];
      // The outgoing plate freezes on its last frame once the cut has passed;
      // the incoming one is already running its own intro.
      const tA = Math.min(t, toLine.plateStart);
      const tB = Math.max(t, toLine.plateStart);
      paint(stageA, fromLine, tA, index);
      paint(stageB, toLine, tB, index);
      const camA: Cam = cameraAt(tA, fromLine, progress(fromLine, tA));
      const camB: Cam = cameraAt(tB, toLine, progress(toLine, tB));
      ctx.fillStyle = mixColor(bgOf(plates[fromLine.id]), bgOf(plates[toLine.id]), tr.p);
      ctx.fillRect(0, 0, W, H);
      applyTransition(tr.kind, {
        ctx,
        smear,
        A: stageA.canvas,
        B: stageB.canvas,
        camA,
        camB,
        p: tr.p,
        accent: accentFor(t, toLine),
        light: !!plates[toLine.id].light,
      });
    } else {
      paint(stageA, line, t, index);
      drawStage(ctx, stageA.canvas, cameraAt(t, line, progress(line, t)));
    }

    ctx.restore();
    return frameFor(line, t, index);
  }

  function drawOverlay(ctx: Ctx, t: number, index: number): void {
    const line = lineAt(t);
    const plate = plates[line.id];
    const f = frameFor(line, t, index);
    if (plate.light) {
      // light plates need a much gentler falloff
      vignette(ctx, 0.28);
      grain(ctx, index, 0.28);
    } else {
      vignette(ctx, 1);
      grain(ctx, index, 0.5);
    }
    cutSweep(ctx, f.lt, f.accent);
    hud(ctx, {
      index: tl.lines.indexOf(f.line),
      count: tl.lines.length,
      label: plate.label,
      t,
      duration: tl.duration,
      cuts,
      accent: f.accent,
      light: plate.light,
    });
    caption(ctx, f.line.words, t, { light: plate.light, accent: f.accent });

    // global fade in from black and out at the tail
    const fadeIn = at(t, 0, 0.7);
    const fadeOut = at(t, tl.duration - 0.9, tl.duration);
    const dark = Math.max(1 - fadeIn, fadeOut);
    if (dark > 0.001) {
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${dark})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function draw(t: number, index: number): Ctx {
    drawScene(scene.ctx, t, index);
    out.ctx.save();
    out.ctx.setTransform(1, 0, 0, 1, 0, 0);
    out.ctx.globalAlpha = 1;
    out.ctx.globalCompositeOperation = "source-over";
    out.ctx.drawImage(scene.canvas, 0, 0);
    out.ctx.restore();
    drawOverlay(out.ctx, t, index);
    return out.ctx;
  }

  return { tl, duration: tl.duration, scene, accum, out, drawScene, drawOverlay, draw };
}
