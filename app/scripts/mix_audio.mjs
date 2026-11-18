// Builds the soundtrack: the Kokoro voiceover plus procedurally synthesised
// sound effects, side-chained under the voice. No sample libraries, so the
// whole mix is reproducible from the timeline.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SR = 48000;
const tl = JSON.parse(readFileSync(join(root, "src/data/timeline.json"), "utf8"));
const total = Math.ceil(tl.duration * SR);
const L = new Float32Array(total);
const R = new Float32Array(total);

/* ------------------------------------------------------------------ utils */

function readWav(path) {
  const buf = readFileSync(path);
  const channels = buf.readUInt16LE(22);
  const sr = buf.readUInt32LE(24);
  const bits = buf.readUInt16LE(34);
  const dataLen = buf.readUInt32LE(40);
  const n = dataLen / (bits / 8) / channels;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = 44 + i * channels * (bits / 8);
    out[i] = buf.readInt16LE(o) / 32768;
  }
  return { samples: out, sr };
}

function writeWav(path, left, right) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const a = Math.max(-1, Math.min(1, Number.isFinite(left[i]) ? left[i] : 0));
    const b = Math.max(-1, Math.min(1, Number.isFinite(right[i]) ? right[i] : 0));
    buf.writeInt16LE(Math.round(a * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(b * 32767), 44 + i * 4 + 2);
  }
  writeFileSync(path, buf);
}

function add(buf, index, value, pan = 0) {
  if (index < 0 || index >= total) return;
  const lg = Math.cos(((pan + 1) * Math.PI) / 4);
  const rg = Math.sin(((pan + 1) * Math.PI) / 4);
  buf === L ? (L[index] += value * lg) : null;
  R[index] += value * rg;
}

/* --------------------------------------------------------------- synthesis */

function whoosh(t0, gain = 0.22, pan = 0.1, dur = 0.85) {
  let lp = 0;
  const start = Math.floor(t0 * SR);
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    const sweep = Math.sin(Math.PI * p);
    const cut = 320 + 7200 * sweep;
    const a = Math.min(0.92, (cut / SR) * 6.283);
    lp += a * (Math.random() * 2 - 1 - lp);
    const env = Math.pow(sweep, 1.8);
    add(L, start + i, lp * env * gain, pan);
  }
}

function impact(t0, gain = 0.5, pan = 0) {
  const dur = 1.3;
  const start = Math.floor(t0 * SR);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    const f = 34 + 96 * Math.exp(-p * 7);
    phase += (f / SR) * Math.PI * 2;
    const body = Math.sin(phase) * Math.exp(-p * 5.2);
    lp += 0.35 * (Math.random() * 2 - 1 - lp);
    const crack = lp * Math.exp(-p * 55) * 1.6;
    const env = Math.tanh((body + crack) * 1.4);
    add(L, start + i, env * gain, pan);
  }
}

function riser(t0, dur = 1.7, gain = 0.16, pan = 0) {
  const start = Math.floor(t0 * SR);
  let lp = 0;
  let phase = 0;
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    const f = 180 + 1500 * p * p;
    phase += (f / SR) * Math.PI * 2;
    const tone = Math.sin(phase) * 0.35;
    const a = Math.min(0.9, ((400 + 5000 * p) / SR) * 6.283);
    lp += a * (Math.random() * 2 - 1 - lp);
    const env = Math.pow(p, 2.2) * (p > 0.985 ? 0 : 1);
    add(L, start + i, (tone + lp * 0.8) * env * gain, pan);
  }
}

function tick(t0, gain = 0.16, pan = 0) {
  const dur = 0.05;
  const start = Math.floor(t0 * SR);
  let lp = 0;
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    lp += 0.5 * (Math.random() * 2 - 1 - lp);
    const env = Math.exp(-p * 16);
    add(L, start + i, lp * env * gain, pan);
  }
}

function blip(t0, gain = 0.14, pan = 0, base = 720) {
  const dur = 0.28;
  const start = Math.floor(t0 * SR);
  let phase = 0;
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    const f = base + 320 * Math.min(1, p * 2.2);
    phase += (f / SR) * Math.PI * 2;
    const env = Math.exp(-p * 9);
    add(L, start + i, Math.sin(phase) * env * gain, pan);
  }
}

/* --------------------------------------------------------------- the voice */

const voice = readWav(join(root, "audio/voiceover.wav"));
const ratio = voice.sr / SR;
const voice48 = new Float32Array(Math.ceil(voice.samples.length / ratio));
for (let i = 0; i < voice48.length; i++) {
  const src = i * ratio;
  const i0 = Math.floor(src);
  const i1 = Math.min(voice.samples.length - 1, i0 + 1);
  const f = src - i0;
  voice48[i] = voice.samples[i0] * (1 - f) + voice.samples[i1] * f;
}

// the voice goes down first, so the effects bus can be ducked against it
for (let i = 0; i < voice48.length && i < total; i++) {
  L[i] += voice48[i];
  R[i] += voice48[i];
}

/* -------------------------------------------------------------- sfx cues */

const cues = [];
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
const when = (lineId, fragment) => {
  const line = tl.lines.find((l) => l.id === lineId);
  const word = line?.words.find((w) => norm(w.w).startsWith(norm(fragment)));
  return word?.s ?? null;
};

// a soft transition on every plate cut
tl.lines.forEach((line, i) => {
  if (i === 0) return;
  cues.push({ type: "whoosh", t: line.plateStart - 0.12, gain: 0.15, pan: 0.15 });
});

// accents that match the edit
const accents = [
  ["prompt", "claude", "impact", 0.30],
  ["crazy", "fifteen", "tick", 0.12],
  ["code", "typescript", "blip", 0.1],
  ["frames", "frame", "tick", 0.1],
  ["pipeline", "timeline", "impact", 0.18],
  ["pipeline", "layer", "impact", 0.2],
  ["pipeline", "keyframes", "impact", 0.24],
  ["procedural", "blue", "blip", 0.16],
  ["procedural", "slower", "blip", 0.14],
  ["verdict", "really", "impact", 0.32],
  ["verdict", "insane", "impact", 0.42],
  ["outro", "code", "impact", 0.2],
];
for (const [id, frag, type, gain] of accents) {
  const t = when(id, frag);
  if (t != null) cues.push({ type, t, gain });
}

const verdictSlam = when("verdict", "pretty");
if (verdictSlam != null) cues.push({ type: "riser", t: verdictSlam - 1.9, dur: 1.9, gain: 0.13 });
const outroLine = tl.lines.find((l) => l.id === "outro");
if (outroLine) cues.push({ type: "riser", t: outroLine.plateStart + 0.1, dur: 1.5, gain: 0.07 });

// render the cues into their own bus so they can be ducked
const BUF_L = new Float32Array(total);
const BUF_R = new Float32Array(total);
const busL = { push: true };
const originalL = L.slice();
const originalR = R.slice();
L.fill(0);
R.fill(0);
for (const cue of cues) {
  if (cue.type === "whoosh") whoosh(cue.t, cue.gain, cue.pan ?? 0.2);
  else if (cue.type === "impact") impact(cue.t, cue.gain, cue.pan ?? 0);
  else if (cue.type === "riser") riser(cue.t, cue.dur ?? 1.7, cue.gain, cue.pan ?? 0);
  else if (cue.type === "tick") tick(cue.t, cue.gain, cue.pan ?? 0.1);
  else if (cue.type === "blip") blip(cue.t, cue.gain, cue.pan ?? 0.1);
}
BUF_L.set(L);
BUF_R.set(R);
void busL;

// voice envelope for side-chain ducking
const per = SR / 100;
const env = new Float32Array(Math.ceil(total / per));
for (let f = 0; f < env.length; f++) {
  let sum = 0;
  const a = Math.floor(f * per);
  const b = Math.min(total, Math.floor((f + 1) * per));
  for (let i = a; i < b; i++) {
    const v = i < voice48.length ? voice48[i] : 0;
    sum += v * v;
  }
  env[f] = Math.sqrt(sum / Math.max(1, b - a));
}
let peak = 1e-6;
for (const v of env) peak = Math.max(peak, v);
for (let i = 0; i < env.length; i++) env[i] = Math.min(1, env[i] / peak);

// mix: ducked effects + voice
for (let i = 0; i < total; i++) {
  const e = env[Math.floor(i / per)] ?? 0;
  const duck = 1 - 0.4 * e;
  L[i] = originalL[i] + BUF_L[i] * duck * 1.15;
  R[i] = originalR[i] + BUF_R[i] * duck * 1.15;
}

// gentle peak trim, then loudnorm handles the rest in the mux step
let max = 0;
for (let i = 0; i < total; i++) max = Math.max(max, Math.abs(L[i]), Math.abs(R[i]));
const trim = max > 0.94 ? 0.94 / max : 1;
for (let i = 0; i < total; i++) {
  L[i] *= trim;
  R[i] *= trim;
}

mkdirSync(join(root, "../out"), { recursive: true });
writeWav(join(root, "../out/mix.wav"), L, R);
console.log(
  `mix.wav · ${(total / SR).toFixed(2)}s · ${cues.length} cues · peak trim ${trim.toFixed(2)}`,
);
