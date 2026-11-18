// The narration. Each line becomes one plate; `pre` and `post` are the
// silent visual lead-in and tail around the spoken take.
export const VOICE = "af_heart";
export const SPEED = 0.98;

export const LINES = [
  {
    id: "model",
    pre: 3.0,
    post: 0.7,
    text:
      "What if I told you that you can make motion graphics like this, without ever opening After Effects?",
  },
  {
    id: "prompt",
    pre: 0.9,
    post: 0.8,
    text:
      "And no. This isn't a model guessing at keyframes. It's Claude, writing the animation itself, as a program.",
  },
  {
    id: "crazy",
    pre: 0.9,
    post: 1.0,
    text:
      "So you give it a prompt. Create a fifteen second cinematic sequence, with kinetic typography, smooth shape transitions, and seamless camera movement.",
  },
  {
    id: "code",
    pre: 0.8,
    post: 0.7,
    text:
      "What comes back isn't a video file. It's TypeScript. Every frame, drawn as a pure function of time.",
  },
  {
    id: "frames",
    pre: 0.8,
    post: 0.8,
    text:
      "Then a headless browser renders it, frame by frame, and ffmpeg stitches the frames into a video.",
  },
  {
    id: "pipeline",
    pre: 0.9,
    post: 0.9,
    text: "No timeline. No layer stacks. No thousands of keyframes to nudge.",
  },
  {
    id: "procedural",
    pre: 0.8,
    post: 0.9,
    text:
      "Change one number, and every frame downstream recomputes. Want it blue? Say so. Slower? Say so.",
  },
  {
    id: "verdict",
    pre: 1.1,
    post: 2.6,
    text:
      "So does this replace After Effects? Not really. But for motion driven by a voiceover, and defined mathematically, it's pretty insane.",
  },
  {
    id: "outro",
    pre: 1.8,
    post: 2.4,
    text:
      "Every frame you just saw is code. Change a line, render again. That's the whole workflow.",
  },
];
