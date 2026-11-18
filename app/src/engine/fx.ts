// Shared treatments: construction paper, grain, vignette, HUD, karaoke
// captions, progress and the cut sweep.
import { createCanvas, type Canvas, type CanvasPattern } from "@napi-rs/canvas";
import { H, P, W, type Ctx } from "./canvas.ts";
import { at, clamp, easeOutCubic, easeOutExpo, lerp, seg } from "./anim.ts";
import { mixColor, rgba } from "./color.ts";
import { label, measure, txt } from "./type.ts";
import type { Word } from "../types.ts";

/* --------------------------------------------------------------- paper */

type PaperKind = "dark" | "light";

const tileCache: Partial<Record<PaperKind, Canvas>> = {};
const patternCache = new WeakMap<Ctx, Partial<Record<PaperKind, CanvasPattern>>>();

function paperTile(kind: PaperKind): Canvas {
  const hit = tileCache[kind];
  if (hit) return hit;
  const tile = createCanvas(240, 240);
  const g = tile.getContext("2d");
  g.fillStyle = kind === "dark" ? "#f4f0e6" : "#16181d";
  for (let i = 0; i <= 240; i += 48) {
    g.fillRect(i, 0, 1, 240);
    g.fillRect(0, i, 240, 1);
  }
  // heavier every fifth rule, like engineering paper
  g.fillStyle = kind === "dark" ? "#f4f0e6" : "#16181d";
  g.globalAlpha = 0.9;
  g.fillRect(240 - 1, 0, 1, 240);
  g.fillRect(0, 240 - 1, 240, 1);
  tileCache[kind] = tile;
  return tile;
}

function paperPattern(ctx: Ctx, kind: PaperKind): CanvasPattern {
  let entry = patternCache.get(ctx);
  if (!entry) {
    entry = {};
    patternCache.set(ctx, entry);
  }
  let pat = entry[kind];
  if (!pat) {
    pat = ctx.createPattern(paperTile(kind), "repeat")!;
    entry[kind] = pat;
  }
  return pat;
}

export interface PaperOpts {
  alpha?: number;
  zoom?: number;
  x?: number;
  y?: number;
  light?: boolean;
}

export function paper(ctx: Ctx, o: PaperOpts = {}): void {
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 0.05;
  ctx.fillStyle = paperPattern(ctx, o.light ? "light" : "dark");
  ctx.translate(o.x ?? 0, o.y ?? 0);
  ctx.scale(o.zoom ?? 1, o.zoom ?? 1);
  ctx.fillRect(-W, -H, W * 3, H * 3);
  ctx.restore();
}

/** Dot field used behind the opening plate. */
export function dots(
  ctx: Ctx,
  o: { x?: number; y?: number; step?: number; size?: number; color?: string; alpha?: number; cx?: number; cy?: number; radius?: number },
): void {
  const step = o.step ?? 48;
  const size = o.size ?? 1.6;
  const cx = o.cx ?? W / 2;
  const cy = o.cy ?? H / 2;
  const radius = o.radius ?? 620;
  ctx.save();
  ctx.fillStyle = o.color ?? P.bone;
  const base = o.alpha ?? 0.16;
  const x0 = o.x ?? 0;
  const y0 = o.y ?? 0;
  for (let y = y0 % step; y < H + step; y += step) {
    for (let x = x0 % step; x < W + step; x += step) {
      const d = Math.hypot(x - cx, y - cy);
      const falloff = clamp(1 - d / radius);
      if (falloff <= 0.01) continue;
      ctx.globalAlpha = base * falloff * falloff;
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------- vignette */

let vignetteLayer: Canvas | null = null;

function it(): Ctx {
  return vignetteLayer!.getContext("2d");
}

function vignetteCanvas(): Canvas {
  if (vignetteLayer) return vignetteLayer;
  const c = createCanvas(W, H);
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 1.05);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.14)");
  grad.addColorStop(1, "rgba(0,0,0,0.62)");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // bottom falloff so the caption always sits on clean ink
  const bottom = g.createLinearGradient(0, H * 0.78, 0, H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = bottom;
  g.fillRect(0, H * 0.78, W, H * 0.22);
  vignetteLayer = c;
  return c;
}

export function vignette(ctx: Ctx, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(vignetteCanvas(), 0, 0);
  ctx.restore();
}

/* ---------------------------------------------------------------- grain */

const grainSheets: Canvas[] = [];

function grainSheet(seed: number): Canvas {
  const hit = grainSheets[seed];
  if (hit) return hit;
  const c = createCanvas(W, H);
  const g = c.getContext("2d");
  const img = g.createImageData(W, H);
  const d = img.data;
  let s = seed * 9973 + 1;
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = 118 + ((s / 2147483647) * 60 - 30);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainSheets[seed] = c;
  return c;
}

export function grain(ctx: Ctx, frame: number, amount = 0.5): void {
  const sheet = grainSheet(frame % 4);
  const dx = ((frame * 37) % 17) - 8;
  const dy = ((frame * 53) % 19) - 9;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = amount;
  ctx.drawImage(sheet, dx, dy);
  ctx.restore();
}

/* ------------------------------------------------------------------ hud */

export interface HudOpts {
  index: number;
  count: number;
  label: string;
  t: number;
  duration: number;
  cuts: number[];
  accent: string;
  light?: boolean;
}

const pad = (n: number, w = 2): string => String(Math.floor(n)).padStart(w, "0");

export function hud(ctx: Ctx, o: HudOpts): void {
  const ink = o.light ? "#14161a" : P.bone;
  const dim = o.light ? "rgba(20,22,26,0.45)" : "rgba(244,240,230,0.42)";

  // top-left wordmark
  ctx.save();
  ctx.fillStyle = o.accent;
  ctx.fillRect(140, 56, 9, 9);
  ctx.restore();
  label(ctx, "motion as code", 162, 66, {
    size: 16,
    tracking: 4.2,
    color: ink,
    alpha: 0.5,
  });

  // top-right plate marker
  label(ctx, `plate ${pad(o.index + 1)} / ${pad(o.count)}`, 1780, 66, {
    size: 16,
    tracking: 3.4,
    color: ink,
    alpha: 0.32,
    align: "right",
  });
  label(ctx, o.label, 1780, 96, {
    size: 16,
    tracking: 3.4,
    color: o.accent,
    alpha: 0.7,
    align: "right",
  });

  // timecode
  const tc = `${pad(o.t / 60)}:${pad(o.t % 60)}:${pad((o.t * 60) % 60)}`;
  label(ctx, tc, 140, 1042, { size: 16, tracking: 2.8, color: ink, alpha: 0.3 });
  label(ctx, "1920×1080 · 60 fps", 1780, 1042, {
    size: 16,
    tracking: 2.4,
    color: ink,
    alpha: 0.22,
    align: "right",
  });

  // progress
  const x0 = 140;
  const x1 = 1780;
  const y = 1068;
  const p = clamp(o.t / o.duration);
  ctx.save();
  ctx.fillStyle = dim;
  ctx.globalAlpha *= 0.35;
  ctx.fillRect(x0, y, x1 - x0, 1);
  for (const c of o.cuts) {
    if (c <= 0) continue;
    ctx.fillRect(x0 + (x1 - x0) * (c / o.duration), y - 3, 1, 7);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = o.accent;
  ctx.fillRect(x0, y, (x1 - x0) * p, 2);
  ctx.restore();
}

/* -------------------------------------------------------------- caption */

interface Slot {
  word: Word;
  x: number;
  y: number;
  w: number;
}

export interface CaptionOpts {
  light?: boolean;
  accent: string;
  maxWidth?: number;
}

/** Word-level karaoke caption, two lines maximum. */
export function caption(ctx: Ctx, words: Word[], t: number, o: CaptionOpts): void {
  if (!words.length) return;
  const size = 26;
  const track = 2.4;
  const gap = 16;
  const maxWidth = o.maxWidth ?? 1560;
  const face = "Mono500";

  const texts = words.map((w) => w.w.toUpperCase());
  const widths = texts.map((s) => measure(ctx, s, size, face, track));
  const total =
    widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, words.length - 1);

  const lines: number[][] = [];
  if (total <= maxWidth) {
    lines.push(words.map((_, i) => i));
  } else {
    // split at the word nearest the middle, preferring punctuation
    let best = Math.floor(words.length / 2);
    let bestScore = Infinity;
    for (let i = 1; i < words.length - 1; i++) {
      const left = widths.slice(0, i).reduce((a, b) => a + b, 0) + gap * (i - 1);
      const right =
        widths.slice(i).reduce((a, b) => a + b, 0) + gap * (words.length - i - 1);
      const punct = /[,.;:!?—]$/.test(words[i - 1].w) ? -260 : 0;
      const score = Math.abs(left - right) + punct;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    lines.push(words.map((_, i) => i).slice(0, best));
    lines.push(words.map((_, i) => i).slice(best));
  }

  const baseY = lines.length > 1 ? 924 : 952;
  const slots: Slot[] = [];
  lines.forEach((idxs, row) => {
    const rowWidth =
      idxs.reduce((a, i) => a + widths[i], 0) + gap * Math.max(0, idxs.length - 1);
    let x = W / 2 - rowWidth / 2;
    const y = baseY + row * 34;
    for (const i of idxs) {
      slots.push({ word: words[i], x, y, w: widths[i] });
      x += widths[i] + gap;
    }
  });

  const inkColor = o.light ? "#14161a" : P.bone;
  let active = -1;
  for (let i = 0; i < slots.length; i++) {
    if (t >= slots[i].word.s) active = i;
  }
  if (t >= slots[slots.length - 1].word.e) active = slots.length - 1;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const done = t >= slot.word.e;
    const isActive = i === active && t >= slot.word.s;
    const alpha = isActive ? 1 : done ? 0.3 : 0.52;
    txt(ctx, texts[words.indexOf(slot.word)], slot.x, slot.y, {
      size,
      face,
      tracking: track,
      color: isActive ? inkColor : mixColor(inkColor, o.light ? "#f4f0e6" : "#07080a", 0.35),
      alpha,
    });
  }

  if (active >= 0) {
    const slot = slots[active];
    const prev = slots[Math.max(0, active - 1)];
    const sameRow = Math.abs(prev.y - slot.y) < 2;
    const k = at(t, slot.word.s, slot.word.s + 0.2, easeOutCubic);
    const x = sameRow ? lerp(prev.x, slot.x, k) : slot.x;
    ctx.save();
    ctx.fillStyle = o.accent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, slot.y + 12, Math.max(10, slot.w), 2.5);
    ctx.restore();
  }
}

/* ---------------------------------------------------------------- cuts */

/** Shutter sweep that runs for a beat after every plate cut. */
export function cutSweep(ctx: Ctx, lt: number, accent: string): void {
  if (lt > 0.36) return;
  const p = easeOutExpo(clamp(lt / 0.34));
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = rgba(accent, 0.05 * (1 - p));
  ctx.fillRect(0, 0, W, H);
  const x = lerp(-260, W + 260, p);
  const g = ctx.createLinearGradient(x - 220, 0, x + 220, 0);
  g.addColorStop(0, rgba(accent, 0));
  g.addColorStop(0.5, rgba(accent, 0.5 * (1 - p)));
  g.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - 240, 0, 480, H);
  ctx.restore();
}

/* -------------------------------------------------------------- objects */

export interface PanelOpts {
  fill?: string;
  stroke?: string;
  radius?: number;
  title?: string;
  accent?: string;
  light?: boolean;
  dots?: boolean;
}

export function panel(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  o: PanelOpts = {},
): void {
  const r = o.radius ?? 12;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  ctx.fillStyle = o.fill ?? P.panel;
  ctx.fill();
  ctx.strokeStyle = o.stroke ?? (o.light ? "rgba(20,22,26,0.14)" : "rgba(244,240,230,0.10)");
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (o.title) {
    const th = 40;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, th);
    ctx.clip();
    ctx.fillStyle = o.light ? "rgba(20,22,26,0.05)" : "rgba(244,240,230,0.045)";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = o.light ? "rgba(20,22,26,0.12)" : "rgba(244,240,230,0.08)";
    ctx.beginPath();
    ctx.moveTo(x, y + th);
    ctx.lineTo(x + w, y + th);
    ctx.stroke();
    ctx.restore();
    if (o.dots !== false) {
      const c = o.accent ?? P.accent;
      const colors = [c, rgba(c, 0.45), o.light ? "rgba(20,22,26,0.18)" : "rgba(244,240,230,0.18)"];
      colors.forEach((color, i) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + 20 + i * 16, y + th / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }
    label(ctx, o.title, x + 76, y + th / 2 + 5, {
      size: 15,
      tracking: 3,
      color: o.light ? "#14161a" : P.bone,
      alpha: 0.4,
    });
  }
}

export interface ChipOpts {
  accent?: string;
  light?: boolean;
  size?: number;
  filled?: boolean;
  alpha?: number;
  align?: "left" | "center";
}

/** Small outlined tag. Returns its width so callers can lay out runs. */
export function chip(ctx: Ctx, text: string, x: number, y: number, o: ChipOpts = {}): number {
  const size = o.size ?? 15;
  const track = 2.6;
  const padX = 12;
  const w = measure(ctx, text.toUpperCase(), size, "Mono500", track) + padX * 2;
  const h = size + 17;
  const accent = o.accent ?? P.accent;
  const bx = o.align === "center" ? x - w / 2 : x;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx, y, w, h, 4) : ctx.rect(bx, y, w, h);
  if (o.filled) {
    ctx.fillStyle = accent;
    ctx.fill();
  } else {
    ctx.strokeStyle = rgba(accent, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
  label(ctx, text, bx + padX, y + h / 2 + 5, {
    size,
    tracking: track,
    color: o.filled ? (o.light ? "#f4f0e6" : "#07080a") : accent,
    alpha: o.alpha ?? 1,
  });
  return w;
}

/** Hand-drawn looking strike that draws on over `p`. */
export function strike(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  p: number,
  color: string,
  width = 5,
): void {
  if (p <= 0) return;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(6, Math.round(len / 22));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const bx = x2 - x1;
  const by = y2 - y1;
  const nx = -by / (len || 1);
  const ny = bx / (len || 1);
  const shown = Math.max(2, Math.round(steps * clamp(p)));
  for (let i = 0; i <= shown; i++) {
    const k = i / steps;
    const wobble = Math.sin(k * 9.1) * 2.6 + Math.sin(k * 3.3) * 1.8;
    const x = x1 + bx * k + nx * wobble;
    const y = y1 + by * k + ny * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Thin rule that grows horizontally. */
export function rule(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  p: number,
  color = "rgba(244,240,230,0.16)",
  thickness = 1,
): void {
  if (p <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * clamp(p), thickness);
  ctx.restore();
}

/** Soft accent bloom behind a focal point. */
export function bloom(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 0.5): void {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.28));
  g.addColorStop(1, rgba(color, 0));
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
