# Motion as Code

An 81-second explainer that is entirely code: narration from Kokoro, every frame
drawn by a pure function of time with Skia, encoded by ffmpeg. No After Effects,
no keyframes, no editor.

**Watch:** `out/motion-as-code.mp4` (1080p60, 124 MB) or `out/reel-720p.mp4` (12 MB).

```bash
cd app
node scripts/gen_vo.mjs     # Kokoro narration + word timings -> audio/, src/data/timeline.json
node scripts/mix_audio.mjs  # procedural SFX, ducked under the voice -> out/mix.wav
node scripts/render.ts      # every frame -> out/video.mp4
bash scripts/build.sh       # all three, chunked, muxed to out/motion-as-code.mp4
node scripts/serve.ts       # preview page at http://localhost:3000
```

Stills while editing: `node scripts/render.ts stills --t 12.5,41.5 --out ../out/wip`.
Fast drafts: `SAMPLES=1 CHUNK=1200 bash scripts/build.sh` (no motion blur).

## How it fits together

| Path | Role |
| --- | --- |
| `app/scripts/script.mjs` | The narration, one entry per plate, with its silent lead-in and tail |
| `app/scripts/gen_vo.mjs` | Kokoro 82M (q8 ONNX) on CPU, trims and normalises each take, assembles the master WAV, writes word timings and an envelope |
| `app/scripts/mix_audio.mjs` | Synthesises whooshes, impacts, risers and blips, side-chains them under the voice |
| `app/scripts/render.ts` | Draws 1920×1080 frames, averages 3 sub-frames for motion blur, pipes raw RGBA into libx264 |
| `app/src/engine/` | Canvas + fonts, easing, typography, paper/grain/vignette/HUD/captions |
| `app/src/engine/camera.ts` | A camera per plate: a slow move across the beat, a punch on each spoken hit, handheld drift |
| `app/src/engine/transition.ts` | Eight boundary moves — whip pan, punch-in, venetian bands, glitch, zoom-through, flash, settle |
| `app/src/plates/` | The nine plates; each is a class-free module with one `draw(ctx, f)` |
| `app/src/compose.ts` | Picks the plate for a time, shoots it through the camera, blends the transition, draws treatments, HUD, karaoke captions |
| `app/src/data/timeline.json` | Word-level timings and plate boundaries, generated |

`f.t` is song time and `f.line.plateStart` anchors each plate. Plates find their
words by content (`wt(f, "claude")`), so re-recording the voiceover re-times the
animation without touching a plate.

Word timings are anchored to the measured speech window of each take and
distributed inside it by syllable weight, so they are accurate at phrase
boundaries and approximate within a phrase.

## Notes

- Fonts: Archivo, IBM Plex Mono, Cormorant Garamond (SIL OFL), fetched by
  `app/scripts/fetch_fonts.mjs` into `app/fonts/`.
- The visual language (ink/bone/signal orange, graph paper, mono HUD) follows
  pdoom-video by mexicat, MIT.
- Renderer runs on the CPU (no GPU in this environment); plates render at 1.3×
  so the camera never upscales a raster. 1080p60 with three sub-frames takes
  about twelve minutes on 2 cores.
