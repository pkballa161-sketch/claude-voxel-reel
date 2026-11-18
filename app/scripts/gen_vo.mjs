// Generates the voiceover with Kokoro (82M, q8 ONNX, running on CPU),
// trims and normalises each take, assembles the master WAV and writes the
// word-level timing data the plates animate against.
import { KokoroTTS } from "kokoro-js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LINES, SPEED, VOICE } from "./script.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SR = 24000;
const voDir = join(root, "audio/vo");
const dataDir = join(root, "src/data");
mkdirSync(voDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });

/* ------------------------------------------------------------------ wav io */

function writeWav(path, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // pcm
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
}

/* --------------------------------------------------------------- take prep */

/** Removes leading/trailing silence and peak-normalises, keeping a little air. */
function prep(raw) {
  let peak = 0;
  for (let i = 0; i < raw.length; i++) peak = Math.max(peak, Math.abs(raw[i]));
  const gate = Math.max(0.004, peak * 0.045);

  let start = 0;
  while (start < raw.length && Math.abs(raw[start]) < gate) start++;
  let end = raw.length - 1;
  while (end > start && Math.abs(raw[end]) < gate) end--;

  const pad = Math.round(SR * 0.045);
  start = Math.max(0, start - pad);
  end = Math.min(raw.length - 1, end + pad);

  const out = new Float32Array(end - start + 1);
  let max = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = raw[start + i];
    max = Math.max(max, Math.abs(out[i]));
  }
  const gain = max > 0 ? 0.92 / max : 1;
  // soft-knee limiter so the normalised peak never clips
  for (let i = 0; i < out.length; i++) {
    const v = out[i] * gain;
    out[i] = Math.tanh(v * 1.08) / Math.tanh(1.08);
  }
  return out;
}

/* ------------------------------------------------------- word timing model */

const VOWELS = /[aeiouy]+/g;

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z0-9']/g, "");
  if (!w) return 1;
  if (/^\d+$/.test(w)) return Math.max(1, Math.min(4, Math.round(w.length * 0.62)));
  const m = w.match(VOWELS);
  let n = m ? m.length : 1;
  if (w.endsWith("e") && n > 1 && !/[aeiouy]e$/.test(w)) n -= 1;
  if (/^(a|the|of|to|and|in|it|is|as|at)$/.test(w)) n = 1;
  return Math.max(1, n);
}

const PAUSE = { ",": 0.55, ";": 0.5, ":": 0.45, ".": 0.85, "?": 0.85, "!": 0.7 };

/** Splits a take into words weighted by syllables + punctuation, inside the
 *  measured speech window. Anchoring on real boundaries keeps it tight. */
function wordTimings(text, start, end) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((tok) => {
    let w = syllables(tok);
    const tail = tok.slice(-1);
    if (PAUSE[tail]) w += PAUSE[tail];
    if (/[—–]$/.test(tok) || /^-/.test(tok)) w += 0.9;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const span = end - start;
  let cursor = start;
  return tokens.map((tok, i) => {
    const dur = (weights[i] / total) * span;
    const word = { w: tok, s: cursor, e: cursor + dur };
    cursor += dur;
    return word;
  });
}

/** RMS envelope at 60 Hz, normalised — drives the audio-reactive bits. */
function envelope(samples) {
  const fps = 60;
  const per = SR / fps;
  const out = [];
  let max = 1e-6;
  for (let f = 0; f * per < samples.length; f++) {
    const a = Math.round(f * per);
    const b = Math.min(samples.length, Math.round((f + 1) * per));
    let sum = 0;
    for (let i = a; i < b; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / Math.max(1, b - a));
    out.push(rms);
    max = Math.max(max, rms);
  }
  return out.map((v) => Math.min(1, Math.pow(v / max, 0.75)));
}

/* ------------------------------------------------------------------ driver */

const cacheKey = (text) => createHash("sha1").update(`${VOICE}|${SPEED}|${text}`).digest("hex").slice(0, 16);

console.log(`kokoro · voice=${VOICE} · speed=${SPEED}`);
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
  dtype: "q8",
  device: "cpu",
});

const takes = [];
for (const line of LINES) {
  const key = cacheKey(line.text);
  const wav = join(voDir, `${line.id}.wav`);
  const mark = join(voDir, `${line.id}.key`);
  if (existsSync(wav) && existsSync(mark) && readFileSync(mark, "utf8") === key) {
    console.log(`  cached ${line.id}`);
  } else {
    const t0 = Date.now();
    const audio = await tts.generate(line.text, { voice: VOICE, speed: SPEED });
    const samples = prep(Float32Array.from(audio.audio));
    writeWav(wav, samples);
    writeFileSync(mark, key);
    console.log(`  ${line.id}: ${(samples.length / SR).toFixed(2)}s in ${Date.now() - t0}ms`);
  }
  takes.push({ ...line, samples: readSamples(wav) });
}

function readSamples(path) {
  const buf = readFileSync(path);
  const n = (buf.length - 44) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(44 + i * 2) / 32767;
  return out;
}

// Lay the takes out on the master timeline.
const lead = 0.25;
let cursor = lead;
const lines = [];
const master = [];
const silence = (seconds) => new Float32Array(Math.round(seconds * SR));

master.push(silence(lead));
for (const take of takes) {
  const plateStart = cursor;
  cursor += take.pre;
  const voiceStart = cursor;
  master.push(silence(take.pre));
  master.push(take.samples);
  const voiceEnd = voiceStart + take.samples.length / SR;
  master.push(silence(take.post));
  cursor = voiceEnd + take.post;
  const words = wordTimings(take.text, voiceStart, voiceEnd - 0.06).map((w) => ({
    w: w.w,
    s: +w.s.toFixed(4),
    e: +w.e.toFixed(4),
  }));
  lines.push({
    id: take.id,
    text: take.text,
    plateStart: +plateStart.toFixed(4),
    plateEnd: +cursor.toFixed(4),
    voiceStart: +voiceStart.toFixed(4),
    voiceEnd: +voiceEnd.toFixed(4),
    words,
  });
}

// Tail so the last beat can breathe.
const tail = 1.2;
master.push(silence(tail));
const total = master.reduce((a, b) => a + b.length, 0);
const flat = new Float32Array(total);
let o = 0;
for (const chunk of master) {
  flat.set(chunk, o);
  o += chunk.length;
}
writeWav(join(root, "audio/voiceover.wav"), flat);

const timeline = {
  voice: VOICE,
  sr: SR,
  fps: 60,
  duration: +(total / SR).toFixed(4),
  lines,
  env: envelope(flat).map((v) => +v.toFixed(3)),
};
writeFileSync(join(dataDir, "timeline.json"), JSON.stringify(timeline, null, 2));

console.log(`\nvoiceover ${(total / SR).toFixed(2)}s · ${lines.length} plates`);
for (const l of lines) {
  console.log(
    `  ${l.id.padEnd(12)} ${l.plateStart.toFixed(2).padStart(6)} → ${l.plateEnd
      .toFixed(2)
      .padStart(6)}  (voice ${l.voiceStart.toFixed(2)}–${l.voiceEnd.toFixed(2)})`,
  );
}
