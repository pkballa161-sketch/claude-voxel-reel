// Easing and small maths helpers. Everything is a pure function of time.

export const clamp = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const mix = lerp;

/** Normalised progress of t through [a, b], clamped. */
export const seg = (t: number, a: number, b: number): number => clamp((t - a) / (b - a || 1e-6));

export const smoothstep = (x: number): number => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};

export const easeOutQuad = (x: number): number => 1 - (1 - x) * (1 - x);
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeInCubic = (x: number): number => x * x * x;
export const easeOutQuint = (x: number): number => 1 - Math.pow(1 - x, 5);
export const easeOutExpo = (x: number): number => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeInExpo = (x: number): number => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
export const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const easeInOutQuint = (x: number): number =>
  x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
export const easeOutBack = (x: number, s = 1.5): number =>
  1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
export const easeOutElastic = (x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

export type Ease = (x: number) => number;

/** Eased progress through a time window. */
export const at = (t: number, a: number, b: number, ease: Ease = easeOutCubic): number =>
  ease(seg(t, a, b));

/** Fades in over [a, a+fi] and out over [b-fo, b]. */
export const windowed = (t: number, a: number, b: number, fi = 0.3, fo = 0.3): number =>
  Math.min(at(t, a, a + fi), 1 - at(t, b - fo, b));

/** 1 → 0 decay used for impacts. */
export const decay = (t: number, a: number, k = 6): number =>
  t < a ? 0 : Math.exp(-(t - a) * k);

/** Deterministic pseudo-random in [0,1). */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function randRange(seed: number, a: number, b: number): number {
  return a + rand(seed) * (b - a);
}

/** Smooth 1-D value noise. */
export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(rand(i), rand(i + 1), u) * 2 - 1;
}

/** Percussive pulse that peaks at `a` and decays. */
export const pulse = (t: number, a: number, k = 8): number => decay(t, a, k);

/** Range remap with clamping. */
export const remap = (v: number, a: number, b: number, c: number, d: number): number =>
  lerp(c, d, clamp((v - a) / (b - a || 1e-6)));

/** Steps through `count` buckets across [a, b]. */
export const step = (t: number, a: number, b: number, count: number): number =>
  Math.floor(clamp((t - a) / (b - a || 1e-6)) * count * 0.999);
