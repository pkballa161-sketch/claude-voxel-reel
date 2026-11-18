// Plate registry, keyed by the narration line id in timeline.json.
import type { Plate } from "../types.ts";
import model from "./model.ts";
import prompt from "./prompt.ts";
import crazy from "./crazy.ts";
import code from "./code.ts";
import frames from "./frames.ts";
import pipeline from "./pipeline.ts";
import procedural from "./procedural.ts";
import verdict from "./verdict.ts";
import outro from "./outro.ts";

export const plates: Record<string, Plate> = {
  model,
  prompt,
  crazy,
  code,
  frames,
  pipeline,
  procedural,
  verdict,
  outro,
};
