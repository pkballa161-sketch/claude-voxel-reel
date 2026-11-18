// 02 — it is not guessing at keyframes; it is writing a program.
import { P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import { at, easeOutCubic, easeOutExpo, lerp, seg } from "../engine/anim.ts";
import { bloom, chip, panel, rule, strike } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { codeLine, revealMask, we, wt } from "./_lib.ts";

const TERM: Array<{ t: string; delay: number; accent?: boolean }> = [
  { t: "› make me a 15s motion piece", delay: 0.5 },
  { t: "  reading timeline.ts", delay: 1.35 },
  { t: "  writing 9 plates", delay: 2.1, accent: true },
  { t: "✓ 5,556 frames · 60 fps", delay: 3.0 },
  { t: "✓ ffmpeg on path", delay: 3.7 },
  { t: "$ bun run render", delay: 4.6 },
];

const plate: Plate = {
  id: "prompt",
  label: "not a model",
  draw(ctx: Ctx, f) {
    const t = f.lt;
    bloom(ctx, 1500, 420, 700, P.accent, 0.025 + f.level * 0.05);

    /* ------------------------------------------------------------- terminal */
    const panelIn = at(t, 0.05, 0.8, easeOutExpo);
    const px = 140;
    const py = 250;
    const pw = 760;
    const ph = 430;
    ctx.save();
    ctx.globalAlpha = panelIn;
    ctx.translate(0, (1 - panelIn) * 26);
    panel(ctx, px, py, pw, ph, { title: "claude — plate.ts" });
    ctx.restore();

    const dimTerm = lerp(1, 0.45, at(t, 3.9, 4.7, easeOutCubic));
    ctx.save();
    ctx.globalAlpha = dimTerm;
    TERM.forEach((line, i) => {
      const y = py + 92 + i * 46;
      const chars = Math.max(0, (t - line.delay) * 44);
      if (chars <= 0) return;
      const isAccent = line.accent && t > 3.4;
      if (isAccent) {
        const w = measure(ctx, line.t, 22, "Mono400", 0);
        ctx.fillStyle = rgba(P.accent, 0.12);
        ctx.fillRect(px + 22, y - 26, pw - 44, 38);
        ctx.fillStyle = P.accent;
        ctx.fillRect(px + 22, y - 26, 3, 38);
        void w;
      }
      txt(ctx, Array.from(line.t).slice(0, Math.floor(chars)).join(""), px + 42, y, {
        size: 22,
        face: "Mono400",
        color: isAccent ? P.accent : i === 0 ? P.bone : P.boneMid,
        alpha: isAccent ? 1 : 0.85,
      });
    });

    // blinking caret on the last active line
    const activeIdx = TERM.reduce((acc, line, i) => (t >= line.delay ? i : acc), -1);
    if (activeIdx >= 0) {
      const line = TERM[activeIdx];
      const y = py + 92 + activeIdx * 46;
      const shown = Math.min(Array.from(line.t).length, Math.max(0, (t - line.delay) * 44));
      const w = measure(ctx, Array.from(line.t).slice(0, Math.floor(shown)).join(""), 22, "Mono400", 0);
      if (Math.floor(t * 2.2) % 2 === 0) {
        ctx.fillStyle = P.accent;
        ctx.fillRect(px + 44 + w, y - 18, 11, 22);
      }
    }
    ctx.restore();

    /* -------------------------------------------------------------- right side */
    const swapped = at(t, wt(f, "claude") - 0.55, wt(f, "claude") - 0.02, easeOutCubic);

    // beat 1 — what it is not
    if (swapped < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - swapped;
      label(ctx, "this isn't", 980, 288, {
        size: 17,
        tracking: 4,
        color: P.bone,
        alpha: 0.45 * at(t, 0.35, 1.1),
      });
      const rows = [
        { text: "guessing", anchor: "guessing", y: 430, size: 128 },
        { text: "at keyframes", anchor: "keyframes", y: 556, size: 128 },
      ];
      rows.forEach((row) => {
        const p = at(t, wt(f, row.anchor) - 0.12, wt(f, row.anchor) + 0.7, easeOutExpo);
        const w = measure(ctx, row.text, row.size, "SerifI400", -2);
        revealMask(ctx, 970, row.y - 118, w + 40, 150, p, () =>
          txt(ctx, row.text, 980, row.y, {
            size: row.size,
            face: "SerifI400",
            tracking: -2,
            color: P.bone,
            alpha: 0.9,
          }),
        );
        const sy = at(t, wt(f, row.anchor) + 0.25, wt(f, row.anchor) + 0.62, easeOutCubic);
        strike(ctx, 962, row.y - 34, 980 + w + 14, row.y - 30, sy, P.accent, 6);
      });
      ctx.restore();
    }

    // beat 2 — what it is
    if (swapped > 0) {
      ctx.save();
      ctx.globalAlpha = swapped;
      ctx.translate(0, (1 - swapped) * 30);

      const claudeIn = at(t, wt(f, "claude") - 0.1, wt(f, "claude") + 0.8, easeOutExpo);
      const cw = measure(ctx, "CLAUDE", 148, "Archivo900", -7);
      revealMask(ctx, 972, 300, cw + 40, 180, claudeIn, () => {
        txt(ctx, "CLAUDE", 980, 430, {
          size: 148,
          face: "Archivo900",
          tracking: -7,
          color: P.bone,
        });
      });
      ctx.save();
      ctx.fillStyle = P.accent;
      ctx.fillRect(984, 452, cw * at(t, wt(f, "claude") + 0.4, wt(f, "claude") + 0.9), 9);
      ctx.restore();

      const line1 = at(t, wt(f, "writing") - 0.1, wt(f, "writing") + 0.55, easeOutCubic);
      const line2 = at(t, wt(f, "as") - 0.05, wt(f, "as") + 0.5, easeOutCubic);
      txt(ctx, "writing the animation itself", 984, 546, {
        size: 46,
        face: "Archivo500",
        color: P.bone,
        alpha: 0.92 * line1,
      });
      txt(ctx, "as a program", 984, 640, {
        size: 88,
        face: "SerifI400",
        color: P.accent,
        alpha: line2,
      });

      if (line2 > 0.4) {
        ctx.save();
        ctx.globalAlpha = at(t, wt(f, "program") - 0.1, wt(f, "program") + 0.7);
        ctx.fillStyle = "rgba(244,240,230,0.05)";
        ctx.fillRect(980, 700, 620, 108);
        codeLine(
          ctx,
          [
            { text: "export ", color: P.accent },
            { text: "default ", color: P.accent },
            { text: "class ", color: P.accent },
            { text: "Prompt ", color: P.bone },
            { text: "implements ", color: P.boneMid },
            { text: "Plate", color: P.boneMid },
          ],
          1004,
          742,
          21,
        );
        codeLine(
          ctx,
          [
            { text: "  draw", color: P.bone },
            { text: "(ctx, f) ", color: P.boneMid },
            { text: "{ /* … */ }", color: "#6f6b63" },
          ],
          1004,
          774,
          21,
        );
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.restore();
  },
};

export default plate;
