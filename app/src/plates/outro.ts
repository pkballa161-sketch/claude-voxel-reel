// 09 — the whole workflow, said plainly.
import { H, P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import { at, clamp, easeOutCubic, easeOutExpo, lerp, seg } from "../engine/anim.ts";
import { bloom, chip, rule } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { we, wt } from "./_lib.ts";

const SOURCE = [
  "export default class Plate {",
  "  draw(ctx, f) {",
  "    const t = f.t - f.line.plateStart",
  "    const p = seg(t, w.s, w.e)",
  "    drawWord(ctx, w, easeOutExpo(p))",
  "  }",
  "}",
  "// 5,556 frames · 60 fps",
  "// no keyframes were harmed",
];

const plate: Plate = {
  id: "outro",
  label: "the workflow",
  draw(ctx: Ctx, f) {
    const t = f.lt;

    // drifting source behind the words
    ctx.save();
    ctx.globalAlpha = 0.5;
    SOURCE.forEach((line, i) => {
      const y = ((i * 118 + t * 16) % (H + 220)) - 110;
      txt(ctx, line, 1088 + (i % 2) * 40, y, {
        size: 15,
        face: "Mono400",
        color: P.bone,
        alpha: 0.1,
      });
    });
    ctx.restore();

    bloom(ctx, 700, 560, 720, P.accent, 0.04 + f.level * 0.05);

    const zoom = lerp(1.0, 1.03, easeOutCubic(seg(t, 0, 10)));
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    label(ctx, "the workflow", 140, 300, {
      size: 17,
      tracking: 4,
      color: P.bone,
      alpha: 0.4 * at(t, 0.2, 1.0),
    });
    rule(ctx, 140, 320, 300, at(t, 0.3, 1.1, easeOutExpo), rgba(P.accent, 0.7), 2);

    const line1 = at(t, wt(f, "every") - 0.15, wt(f, "every") + 0.9, easeOutExpo);
    const line2 = at(t, wt(f, "code") - 0.05, wt(f, "code") + 0.9, easeOutExpo);

    ctx.save();
    ctx.beginPath();
    ctx.rect(120, 360, 1500, 200);
    ctx.clip();
    ctx.globalAlpha = line1;
    ctx.translate(0, (1 - line1) * 80);
    txt(ctx, "EVERY FRAME", 140, 500, {
      size: 132,
      face: "Archivo900",
      tracking: -6,
      color: P.bone,
    });
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(120, 470, 1500, 220);
    ctx.clip();
    ctx.globalAlpha = line2;
    ctx.translate(0, (1 - line2) * 80);
    txt(ctx, "IS CODE.", 140, 630, {
      size: 132,
      face: "Archivo900",
      tracking: -6,
      color: P.bone,
    });
    const w = measure(ctx, "IS CODE.", 132, "Archivo900", -6);
    ctx.fillStyle = P.accent;
    ctx.fillRect(140 + w + 10, 560, 26, 26);
    ctx.restore();

    const sub = at(t, wt(f, "change") - 0.15, wt(f, "change") + 0.8, easeOutCubic);
    if (sub > 0) {
      ctx.save();
      ctx.globalAlpha = sub;
      txt(ctx, "change a line · render again", 146, 700, {
        size: 34,
        face: "Mono400",
        color: P.bone,
        alpha: 0.55,
      });
      ctx.restore();
    }

    const tail = at(t, we(f, "workflow") - 0.8, we(f, "workflow") + 0.5, easeOutCubic);
    if (tail > 0) {
      ctx.save();
      ctx.globalAlpha = tail;
      const items = ["typescript", "three.js thinking", "kokoro tts", "ffmpeg", "60 fps"];
      let x = 146;
      for (const item of items) {
        x += chip(ctx, item, x, 792, { accent: P.accent, size: 13, alpha: 0.7 }) + 8;
      }
      label(ctx, "motion as code", 1780, 806, {
        size: 15,
        tracking: 4,
        color: P.bone,
        alpha: 0.35,
        align: "right",
      });
      ctx.restore();
    }

    ctx.restore();
    void clamp;
  },
};

export default plate;
