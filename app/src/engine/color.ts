// Colour helpers: hex in, interpolation and alpha out.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hex(value: string): RGB {
  const v = value.replace("#", "");
  const n = parseInt(
    v.length === 3
      ? v
          .split("")
          .map((c) => c + c)
          .join("")
      : v,
    16,
  );
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(color: string, alpha: number): string {
  const { r, g, b } = hex(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function mixColor(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const to = (p: number, q: number) => Math.round(p + (q - p) * k);
  return `rgb(${to(x.r, y.r)},${to(x.g, y.g)},${to(x.b, y.b)})`;
}

export function shade(color: string, amount: number): string {
  // amount > 0 lightens toward white, < 0 darkens toward black
  const { r, g, b } = hex(color);
  const target = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  const to = (p: number) => Math.round(p + (target - p) * k);
  return `rgb(${to(r)},${to(g)},${to(b)})`;
}
