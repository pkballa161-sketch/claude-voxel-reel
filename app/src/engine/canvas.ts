// Canvas, fonts and palette. Everything downstream draws in 1920x1080.
import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const W = 1920;
export const H = 1080;
export const FPS = 60;

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "../..");

// Registering each weight under its own alias keeps weight selection explicit
// instead of relying on family matching inside Skia.
const FACES: Record<string, string> = {
  Archivo400: "Archivo-400.ttf",
  Archivo500: "Archivo-500.ttf",
  Archivo600: "Archivo-600.ttf",
  Archivo700: "Archivo-700.ttf",
  Archivo800: "Archivo-800.ttf",
  Archivo900: "Archivo-900.ttf",
  Mono400: "IBMPlexMono-400.ttf",
  Mono500: "IBMPlexMono-500.ttf",
  Mono600: "IBMPlexMono-600.ttf",
  Serif400: "CormorantGaramond-400.ttf",
  Serif600: "CormorantGaramond-600.ttf",
  SerifI400: "CormorantGaramond-Italic-400.ttf",
  SerifI600: "CormorantGaramond-Italic-600.ttf",
};

let loaded = false;

export function loadFonts(): void {
  if (loaded) return;
  for (const [alias, file] of Object.entries(FACES)) {
    const key = GlobalFonts.registerFromPath(join(ROOT, "fonts", file), alias);
    if (!key) throw new Error(`could not register font ${file}`);
  }
  loaded = true;
}

export const P = {
  ink: "#07080a",
  ink2: "#0c0e12",
  panel: "#111319",
  panel2: "#171a21",
  bone: "#f4f0e6",
  boneMid: "#9b958a",
  boneDim: "#4a4843",
  rule: "rgba(244,240,230,0.13)",
  accent: "#ff5a1f",
  accentDim: "rgba(255,90,31,0.30)",
  accentFaint: "rgba(255,90,31,0.10)",
  blue: "#6f9dff",
  blueDim: "rgba(111,157,255,0.30)",
};

export function makeCanvas(w = W, h = H): Canvas {
  return createCanvas(w, h);
}

export type Ctx = SKRSContext2D;

/** A scratch canvas used for masks, motion blur and glow passes. */
export class Layer {
  canvas: Canvas;
  ctx: Ctx;
  constructor(w = W, h = H) {
    this.canvas = createCanvas(w, h);
    this.ctx = this.canvas.getContext("2d");
  }
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
