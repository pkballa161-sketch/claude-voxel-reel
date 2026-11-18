// Tiny static server for the preview page (with range support for <video>).
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { ROOT } from "../src/engine/canvas.ts";

const port = Number(process.env.PORT ?? 5173);
// the preview page and the renders live at the repository root
const siteRoot = join(ROOT, "..");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".json": "application/json",
};

createServer((req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  const path = join(siteRoot, url === "/" ? "preview/index.html" : url);
  if (!existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  const size = statSync(path).size;
  const type = types[extname(path)] ?? "application/octet-stream";
  const range = req.headers.range;

  if (range) {
    const [startText, endText] = range.replace(/bytes=/, "").split("-");
    const start = Number(startText);
    const end = endText ? Number(endText) : size - 1;
    res.writeHead(206, {
      "content-type": type,
      "accept-ranges": "bytes",
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": end - start + 1,
    });
    createReadStream(path, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
  createReadStream(path).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`preview on http://0.0.0.0:${port}`);
});
