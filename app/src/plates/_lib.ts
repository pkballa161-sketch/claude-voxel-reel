// Small drawing helpers shared by the plates.
import { W, type Ctx } from "../engine/canvas.ts";
import { txt, measure, type Txt } from "../engine/type.ts";
import { at, clamp, easeOutCubic, seg } from "../engine/anim.ts";
import type { Frame, Word } from "../types.ts";

export const SAFE = { l: 140, r: 1780, cx: W / 2, t: 170, b: 800 };

export const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9']/g, "");

/** Finds the spoken word that starts with `frag`, punctuation and case aside. */
export function find(f: Frame, frag: string): Word | undefined {
  const n = norm(frag);
  return f.line.words.find((w) => norm(w.w).startsWith(n));
}

/** When a phrase is spoken, in plate-local seconds (falls back to the take). */
export function wt(f: Frame, frag: string): number {
  return (find(f, frag)?.s ?? f.line.voiceStart) - f.line.plateStart;
}

export function we(f: Frame, frag: string): number {
  return (find(f, frag)?.e ?? f.line.voiceEnd) - f.line.plateStart;
}

/** Draws only the first `chars` characters of a string. */
export function typewriter(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  chars: number,
  o: Txt = {},
): number {
  const shown = Array.from(text).slice(0, Math.max(0, Math.floor(chars))).join("");
  if (!shown) return 0;
  txt(ctx, shown, x, y, o);
  return measure(ctx, shown, o.size ?? 34, o.face ?? "Archivo400", o.tracking ?? 0);
}

/** Clip-rect style reveal: content slides up from under a mask. */
export function revealMask(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  draw: () => void,
  dir: "up" | "down" | "left" = "up",
): void {
  if (p <= 0.001) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const k = easeOutCubic(clamp(p));
  if (dir === "up") ctx.translate(0, (1 - k) * h);
  else if (dir === "down") ctx.translate(0, -(1 - k) * h);
  else ctx.translate((1 - k) * -w, 0);
  draw();
  ctx.restore();
}

export interface Token {
  text: string;
  color?: string;
  alpha?: number;
}

/** One line of code with per-token colour. */
export function codeLine(
  ctx: Ctx,
  tokens: Token[],
  x: number,
  y: number,
  size: number,
  o: { chars?: number; alpha?: number; face?: string } = {},
): number {
  let cursor = x;
  let budget = o.chars ?? Infinity;
  const face = o.face ?? "Mono400";
  for (const token of tokens) {
    if (budget <= 0) break;
    const text = Array.from(token.text).slice(0, budget).join("");
    budget -= Array.from(token.text).length;
    if (text) {
      txt(ctx, text, cursor, y, {
        size,
        face,
        color: token.color ?? "#d8d3c8",
        alpha: (o.alpha ?? 1) * (token.alpha ?? 1),
      });
      cursor += measure(ctx, text, size, face, 0);
    }
  }
  return cursor;
}

/** Arrow that draws on with progress. */
export function arrow(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  p: number,
  color: string,
  width = 2,
  head = 12,
): void {
  if (p <= 0) return;
  const x = x1 + (x2 - x1) * clamp(p);
  const y = y1 + (y2 - y1) * clamp(p);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x, y);
  ctx.stroke();
  if (p > 0.92) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.globalAlpha *= 0.9;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5));
    ctx.lineTo(x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Timing helper: seconds inside the plate. */
export const t0 = (f: Frame): number => f.lt;
