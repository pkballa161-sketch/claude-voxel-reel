// Typography. Tracking is drawn per glyph so display type keeps its rhythm.
import type { Ctx } from "./canvas.ts";

export type Align = "left" | "center" | "right";
export type Baseline = "alphabetic" | "top" | "middle" | "bottom";

export interface Txt {
  size?: number;
  face?: string;
  color?: string;
  alpha?: number;
  tracking?: number;
  align?: Align;
  baseline?: Baseline;
  glow?: number;
  glowColor?: string;
  blur?: number;
}

const charCache = new Map<string, number[]>();

function charWidths(ctx: Ctx, text: string, size: number, face: string): number[] {
  const key = `${size}|${face}|${text}`;
  const hit = charCache.get(key);
  if (hit) return hit;
  ctx.font = `${size}px ${face}`;
  const widths = Array.from(text).map((c) => ctx.measureText(c).width);
  charCache.set(key, widths);
  return widths;
}

export function measure(ctx: Ctx, text: string, size: number, face: string, tracking = 0): number {
  if (!tracking) {
    ctx.font = `${size}px ${face}`;
    return ctx.measureText(text).width;
  }
  const widths = charWidths(ctx, text, size, face);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, widths.length - 1);
  return total;
}

export function txt(ctx: Ctx, text: string, x: number, y: number, o: Txt = {}): void {
  const size = o.size ?? 34;
  const face = o.face ?? "Archivo400";
  const tracking = o.tracking ?? 0;
  const align = o.align ?? "left";
  ctx.save();
  ctx.font = `${size}px ${face}`;
  ctx.textBaseline = o.baseline ?? "alphabetic";
  ctx.fillStyle = o.color ?? "#f4f0e6";
  if (o.alpha !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, o.alpha));
  if (o.blur) ctx.filter = `blur(${o.blur}px)`;
  if (o.glow) {
    ctx.shadowColor = o.glowColor ?? o.color ?? "#ff5a1f";
    ctx.shadowBlur = o.glow;
  }

  if (!tracking) {
    ctx.textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
    ctx.fillText(text, x, y);
    ctx.restore();
    return;
  }

  const widths = charWidths(ctx, text, size, face);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, widths.length - 1);
  let cursor = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.textAlign = "left";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c !== " ") ctx.fillText(c, cursor, y);
    cursor += widths[i] + tracking;
  }
  ctx.restore();
}

/** Uppercase mono label, the workhorse of the HUD and annotations. */
export function label(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  o: Txt & { size?: number } = {},
): void {
  txt(ctx, text.toUpperCase(), x, y, {
    face: "Mono500",
    size: o.size ?? 18,
    tracking: o.tracking ?? 3.4,
    color: o.color ?? "#9b958a",
    ...o,
  });
}

/** Greedy word wrap; returns lines that fit maxWidth. */
export function wrap(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  size: number,
  face: string,
  tracking = 0,
): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(ctx, next, size, face, tracking) > maxWidth && line) {
      out.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}
