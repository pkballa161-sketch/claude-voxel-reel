// Shared data shapes. timeline.json is written by scripts/gen_vo.mjs.
import type { SKRSContext2D } from "@napi-rs/canvas";

export interface Word {
  w: string;
  s: number;
  e: number;
}

export interface Line {
  id: string;
  text: string;
  plateStart: number;
  plateEnd: number;
  voiceStart: number;
  voiceEnd: number;
  words: Word[];
}

export interface Timeline {
  voice: string;
  sr: number;
  fps: number;
  duration: number;
  lines: Line[];
  env: number[];
}

export interface Frame {
  t: number; // song time
  lt: number; // time since the plate started
  p: number; // 0..1 through the plate
  i: number; // frame index
  line: Line;
  tl: Timeline;
  accent: string;
  level: number; // voice envelope at this frame, 0..1
}

export interface Plate {
  id: string;
  label: string;
  light?: boolean;
  draw: (ctx: SKRSContext2D, f: Frame) => void;
}
