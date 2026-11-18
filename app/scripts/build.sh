#!/usr/bin/env bash
# Renders the reel in chunks, mixes the soundtrack, then muxes the final MP4.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(cd .. && pwd)"
export PATH="$HOME/bin:$PATH"
FF="${FFMPEG:-ffmpeg}"

echo "== soundtrack =="
node scripts/mix_audio.mjs

TOTAL=$(node -e 'const t=require("./src/data/timeline.json");console.log(Math.round(t.duration*60))')
CHUNK=${CHUNK:-1200}
SAMPLES=${SAMPLES:-3}
mkdir -p "$ROOT/out/chunks"
rm -f "$ROOT"/out/chunks/*.mp4 "$ROOT"/out/chunks/list.txt

echo "== picture: $TOTAL frames, $SAMPLES sub-frames =="
start=0
while [ "$start" -lt "$TOTAL" ]; do
  end=$((start + CHUNK))
  [ "$end" -gt "$TOTAL" ] && end=$TOTAL
  echo "-- frames $start..$end"
  node scripts/render.ts --from "$start" --to "$end" --samples "$SAMPLES" \
    --out "$ROOT/out/chunks/c_$(printf '%05d' "$start").mp4"
  start=$end
done

echo "== concat =="
for f in "$ROOT"/out/chunks/c_*.mp4; do echo "file '$f'"; done > "$ROOT/out/chunks/list.txt"
"$FF" -y -hide_banner -loglevel error -f concat -safe 0 -i "$ROOT/out/chunks/list.txt" \
  -c copy "$ROOT/out/picture.mp4"

echo "== mux =="
"$FF" -y -hide_banner -loglevel error \
  -i "$ROOT/out/picture.mp4" -i "$ROOT/out/mix.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -shortest \
  -movflags +faststart "$ROOT/out/motion-as-code.mp4"

echo "== web copy =="
"$FF" -y -hide_banner -loglevel error -i "$ROOT/out/motion-as-code.mp4" \
  -vf "scale=1280:720:flags=lanczos" -c:v libx264 -preset medium -crf 21 \
  -c:a aac -b:a 160k -movflags +faststart "$ROOT/out/reel-720p.mp4"

echo "== done =="
ls -lh "$ROOT/out/motion-as-code.mp4" "$ROOT/out/reel-720p.mp4"
