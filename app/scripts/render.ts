// Offline renderer: draws every frame on the CPU with Skia and pipes raw
// pixels straight into ffmpeg. Motion blur is an average of sub-frames.
//
//   node scripts/render.ts                         full render
//   node scripts/render.ts --from 0 --to 900        a chunk
//   node scripts/render.ts stills --t 12.5,40.2     single frames
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { FPS, H, ROOT, W } from "../src/engine/canvas.ts";
import { createComposer, loadTimeline } from "../src/compose.ts";

const ffmpegBin = (() => {
  const local = join(process.env.HOME ?? "", "bin/ffmpeg");
  return existsSync(local) ? local : "ffmpeg";
})();

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return fallback;
}

const tl = loadTimeline();
const comp = createComposer(tl);
const totalFrames = Math.round(tl.duration * FPS);
const samples = Math.max(1, Number(arg("samples", "3")));
const crf = arg("crf", "17");
const shutter = Number(arg("shutter", "0.5"));

async function stills(): Promise<void> {
  const times = (arg("t") ?? "5").split(",").map(Number);
  const outDir = arg("out", join(ROOT, "../out/wip"))!;
  mkdirSync(outDir, { recursive: true });
  for (const t of times) {
    comp.draw(t, Math.round(t * FPS));
    const file = join(outDir, `t${t.toFixed(2)}.png`);
    writeFileSync(file, comp.out.canvas.toBuffer("image/png"));
    console.log("wrote", file);
  }
}

async function render(): Promise<void> {
  const from = Math.max(0, Number(arg("from", "0")));
  const to = Math.min(totalFrames, Number(arg("to", String(totalFrames))));
  const out = arg("out", join(ROOT, "../out/video.mp4"))!;
  mkdirSync(dirname(out), { recursive: true });

  const ff = spawn(
    ffmpegBin,
    [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-s", `${W}x${H}`,
      "-r", String(FPS),
      "-i", "-",
      "-an",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", crf,
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-g", String(FPS * 2),
      "-threads", "2",
      "-colorspace", "bt709",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-movflags", "+faststart",
      out,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );

  const started = Date.now();
  const half = (shutter / FPS) / 2;
  for (let i = from; i < to; i++) {
    const t = i / FPS;
    const target = i === from && samples > 1 ? comp.out.canvas : null;
    void target;
    const accum = comp.accum.ctx;
    accum.save();
    accum.setTransform(1, 0, 0, 1, 0, 0);
    accum.globalCompositeOperation = "source-over";
    accum.globalAlpha = 1;
    accum.fillStyle = "#000";
    accum.fillRect(0, 0, W, H);
    accum.restore();

    for (let s = 0; s < samples; s++) {
      const offset = samples === 1 ? 0 : ((s + 0.5) / samples - 0.5) * 2 * half;
      comp.drawScene(comp.scene.ctx, Math.max(0, t + offset), i);
      accum.save();
      accum.globalAlpha = 1 / samples;
      accum.globalCompositeOperation = "source-over";
      accum.drawImage(comp.scene.canvas, 0, 0);
      accum.restore();
    }

    const outCtx = comp.out.ctx;
    outCtx.save();
    outCtx.setTransform(1, 0, 0, 1, 0, 0);
    outCtx.globalAlpha = 1;
    outCtx.globalCompositeOperation = "source-over";
    outCtx.drawImage(comp.accum.canvas, 0, 0);
    outCtx.restore();
    comp.drawOverlay(outCtx, t, i);

    const buf = comp.out.canvas.data();
    if (!ff.stdin.write(buf)) await once(ff.stdin, "drain");

    if ((i - from) % 120 === 0 && i > from) {
      const done = i - from;
      const rate = done / ((Date.now() - started) / 1000);
      const eta = (to - i) / rate;
      console.log(
        `frame ${i}/${to}  ${rate.toFixed(1)} fps  eta ${Math.ceil(eta)}s`,
      );
    }
  }

  ff.stdin.end();
  const [code] = (await once(ff, "close")) as [number];
  if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
  console.log(`wrote ${out} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}

const mode = process.argv[2] === "stills" ? stills : render;
await mode();
