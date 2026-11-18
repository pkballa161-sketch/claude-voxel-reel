// Downloads the static TTFs the renderer needs into app/fonts.
// Google Fonts serves truetype files when the UA is old/unknown.
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "fonts");
await mkdir(dir, { recursive: true });

const requests = [
  ["Archivo:wght@400;500;600;700;800;900", "Archivo", "Archivo"],
  ["IBM+Plex+Mono:wght@400;500;600", "IBMPlexMono", "IBMPlexMono"],
  ["Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600", "CormorantGaramond", "CormorantGaramond"],
];

for (const [family, base, ] of requests) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}`, {
    headers: { "user-agent": "curl/7.0" },
  }).then((r) => r.text());

  // Split the stylesheet into @font-face blocks and pull out style/weight/url.
  const blocks = css.split("@font-face").slice(1);
  for (const block of blocks) {
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1] ?? "400";
    const style = /font-style:\s*(\w+)/.exec(block)?.[1] ?? "normal";
    const url = /url\((https:[^)]+\.ttf)\)/.exec(block)?.[1];
    if (!url) continue;
    const name = `${base}-${style === "italic" ? "Italic-" : ""}${weight}.ttf`;
    const out = join(dir, name);
    if (existsSync(out)) continue;
    const buf = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
    await writeFile(out, buf);
    console.log("saved", name, (buf.length / 1024).toFixed(0) + "kb");
  }
}
