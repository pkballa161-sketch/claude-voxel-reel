// Composes a frame: plate content, treatments, HUD and captions.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Layer, P, ROOT, W, H, loadFonts, type Ctx } from "./engine/canvas.ts";
import { caption, cutSweep, grain, hud, paper, vignette } from "./engine/fx.ts";
import { at } from "./engine/anim.ts";
import { mixColor } from "./engine/color.ts";
import type { Frame, Line, Plate, Timeline } from "./types.ts";
import { plates } from "./plates/index.ts";

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

function plateFor(t: number, tl: Timeline): { plate: Plate; line: Line } {
  let line = tl.lines[tl.lines.length - 1];
  for (const l of tl.lines) {
    if (t >= l.plateStart && t < l.plateEnd) {
      line = l;
      break;
    }
  }
  return { plate: plates[line.id], line };
}

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
  const cuts = tl.lines.map((l) => l.plateStart);

  function frameAt(t: number, index: number): Frame {
    const { plate, line } = plateFor(t, tl);
    void plate;
    const span = Math.max(0.001, line.plateEnd - line.plateStart);
    const lt = t - line.plateStart;
    return {
      t,
      lt,
      p: lt / span,
      i: index,
      line,
      tl,
      accent: accentFor(t, line),
      level: tl.env[Math.round(t * tl.fps)] ?? 0,
    };
  }

  function drawScene(ctx: Ctx, t: number, index: number): Frame {
    const f = frameAt(t, index);
    const plate = plates[f.line.id];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = plate.light ? "#f2eee4" : P.ink;
    ctx.fillRect(0, 0, W, H);
    if (!plate.light) {
      paper(ctx, { alpha: 0.036, x: -((f.t * 7) % 48), y: -((f.t * 4) % 48) });
    }
    plate.draw(ctx, f);
    ctx.restore();
    return f;
  }

  function drawOverlay(ctx: Ctx, t: number, index: number): void {
    const f = frameAt(t, index);
    const plate = plates[f.line.id];
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
