// 05 — headless browser draws frames; ffmpeg turns them into a movie.
import { P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import { at, clamp, easeOutCubic, easeOutExpo, lerp } from "../engine/anim.ts";
import { bloom, chip, panel, rule } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { arrow, we, wt } from "./_lib.ts";

const TILES = 14;

function mini(ctx: Ctx, x: number, y: number, w: number, h: number, i: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#0d0f14";
  ctx.fillRect(x, y, w, h);
  const phase = i * 0.42;
  // a couple of strokes so each frame looks like a moment of the same piece
  ctx.strokeStyle = rgba(P.bone, 0.35);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + h * 0.68);
  ctx.lineTo(x + w - 8, y + h * 0.68 - Math.sin(phase) * 8);
  ctx.stroke();
  ctx.fillStyle = rgba(P.accent, 0.75);
  const bx = x + 12 + (Math.sin(phase) * 0.5 + 0.5) * (w - 34);
  ctx.fillRect(bx, y + 14, 12, 12);
  ctx.strokeStyle = rgba(P.bone, 0.18);
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h * 0.42, 12 + Math.cos(phase) * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = rgba(P.bone, 0.12);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

const plate: Plate = {
  id: "frames",
  label: "render",
  draw(ctx: Ctx, f) {
    const t = f.lt;
    const total = Math.round(f.tl.duration * 60);
    const progress = clamp(f.t / f.tl.duration);

    label(ctx, "render / frame by frame", 140, 190, { size: 17, tracking: 4, color: P.bone, alpha: 0.5 });
    label(ctx, "chrome --headless", 1780, 190, {
      size: 16,
      tracking: 3,
      color: P.bone,
      alpha: 0.35,
      align: "right",
    });
    rule(ctx, 140, 210, 1640, at(t, 0, 0.7, easeOutExpo), rgba(P.bone, 0.16), 1);

    /* ----------------------------------------------------------- filmstrip */
    const tileW = 100;
    const tileH = 56;
    const gap = 12;
    const stripW = TILES * tileW + (TILES - 1) * gap;
    const sx = W / 2 - stripW / 2;
    const sy = 260;
    for (let i = 0; i < TILES; i++) {
      const reveal = at(t, 0.5 + i * 0.13, 0.9 + i * 0.13, easeOutCubic);
      if (reveal <= 0.01) continue;
      const x = sx + i * (tileW + gap);
      ctx.save();
      ctx.globalAlpha = reveal;
      ctx.translate(0, (1 - reveal) * 14);
      mini(ctx, x, sy, tileW, tileH, i);
      ctx.restore();
    }

    // playhead sweeping the strip with the render
    const headX = sx + lerp(0, stripW - 6, progress);
    ctx.save();
    ctx.fillStyle = P.accent;
    ctx.fillRect(headX, sy - 10, 2, tileH + 20);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(headX - 3, sy - 10, 8, tileH + 20);
    ctx.restore();

    /* ------------------------------------------------------------- counter */
    const frame = Math.round(progress * total);
    const counterIn = at(t, 0.3, 1.0, easeOutCubic);
    ctx.save();
    ctx.globalAlpha = counterIn;
    const num = String(frame).padStart(4, "0");
    txt(ctx, num, 140, 470, {
      size: 104,
      face: "Mono500",
      tracking: -2,
      color: P.bone,
    });
    const nw = measure(ctx, num, 104, "Mono500", -2);
    txt(ctx, `/ ${total}`, 140 + nw + 18, 470, {
      size: 32,
      face: "Mono400",
      color: P.bone,
      alpha: 0.35,
    });
    label(ctx, "frames written", 140, 506, { size: 15, tracking: 3, color: P.bone, alpha: 0.35 });

    // progress bar
    const barY = 540;
    ctx.fillStyle = rgba(P.bone, 0.1);
    ctx.fillRect(140, barY, 1040, 5);
    ctx.fillStyle = P.accent;
    ctx.fillRect(140, barY, 1040 * progress, 5);
    ctx.restore();

    /* ----------------------------------------------------------- waveform */
    const env = f.tl.env;
    const wx = 140;
    const wy = 640;
    const ww = 1640;
    const wh = 76;
    const bars = 205;
    const head = progress;
    const waveIn = at(t, 1.0, 1.8, easeOutCubic);
    if (waveIn > 0) {
      ctx.save();
      ctx.globalAlpha = waveIn * 0.9;
      for (let i = 0; i < bars; i++) {
        const k = i / bars;
        const idx = Math.floor(k * env.length);
        const v = env[idx] ?? 0;
        const h = Math.max(1.5, v * wh);
        const x = wx + (i / bars) * ww;
        ctx.fillStyle = k < head ? rgba(P.accent, 0.85) : rgba(P.bone, 0.16);
        ctx.fillRect(x, wy - h / 2, 2.4, h);
      }
      ctx.restore();
      label(ctx, "audio_vo.py · loudness envelope", wx, wy + 62, {
        size: 14,
        tracking: 2.6,
        color: P.bone,
        alpha: 0.28,
      });
    }

    /* ----------------------------------------------------------- pipeline */
    const pipes = ["raw rgba", "libx264", "h.264", "reel.mp4"];
    const py = 790;
    let cx = 140;
    const reveal = at(t, we(f, "headless") - 0.3, we(f, "headless") + 0.5, easeOutCubic);
    for (let i = 0; i < pipes.length; i++) {
      const a = reveal * clamp((t - (we(f, "headless") - 0.3 + i * 0.18)) * 4);
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = a;
      const w = chip(ctx, pipes[i], cx, py, {
        accent: i === pipes.length - 1 ? P.accent : P.bone,
        filled: i === pipes.length - 1,
        size: 15,
      });
      cx += w + 8;
      if (i < pipes.length - 1) {
        arrow(ctx, cx, py + 16, cx + 44, py + 16, clamp((t - 1.2 - i * 0.2) * 3), rgba(P.bone, 0.45), 1.5, 7);
        cx += 56;
      }
      ctx.restore();
    }
    bloom(ctx, headX, sy + tileH / 2, 180, P.accent, 0.10);

    txt(ctx, "no editor, no stage", 1780, 806, {
      size: 17,
      face: "Mono400",
      color: P.bone,
      alpha: 0.3 * reveal,
      align: "right",
    });
    void wt;
  },
};

export default plate;
