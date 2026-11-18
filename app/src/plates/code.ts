// 04 — the answer is source code; every frame is f(t).
import { P, W, type Ctx } from "../engine/canvas.ts";
import { label, measure, txt } from "../engine/type.ts";
import { at, clamp, easeInOutCubic, easeOutCubic, easeOutExpo, lerp, seg } from "../engine/anim.ts";
import { bloom, chip, panel, rule } from "../engine/fx.ts";
import { rgba } from "../engine/color.ts";
import type { Plate } from "../types.ts";
import { codeLine, we, wt, type Token } from "./_lib.ts";

const ACCENT = P.accent;
const TYPE = "#9b958a";
const STR = "#e4dccb";
const PUNCT = "#7d786f";
const COMMENT = "#5f5b54";

const CODE: Token[][] = [
  [{ text: "export ", color: ACCENT }, { text: "default ", color: ACCENT }, { text: "class ", color: ACCENT }, { text: "Code ", color: "bold" as any }, { text: "implements " , color: TYPE}, { text: "Plate ", color: TYPE }, { text: "{", color: PUNCT }],
  [{ text: "  draw", color: STR }, { text: "(", color: PUNCT }, { text: "ctx", color: STR }, { text: ": ", color: PUNCT }, { text: "Ctx", color: TYPE }, { text: ", ", color: PUNCT }, { text: "f", color: STR }, { text: ": ", color: PUNCT }, { text: "Frame", color: TYPE }, { text: ") {", color: PUNCT }],
  [{ text: "    const ", color: ACCENT }, { text: "t", color: STR }, { text: " = ", color: PUNCT }, { text: "f.t", color: STR }, { text: " - ", color: PUNCT }, { text: "f.line.plateStart", color: STR }],
  [{ text: "    const ", color: ACCENT }, { text: "e", color: STR }, { text: " = ", color: PUNCT }, { text: "easeOutExpo", color: STR }, { text: "(", color: PUNCT }, { text: "seg", color: STR }, { text: "(", color: PUNCT }, { text: "t", color: STR }, { text: ", ", color: PUNCT }, { text: "0", color: ACCENT }, { text: ", ", color: PUNCT }, { text: "0.9", color: ACCENT }, { text: "))", color: PUNCT }],
  [],
  [{ text: "    paper", color: STR }, { text: "(", color: PUNCT }, { text: "ctx", color: STR }, { text: ", { ", color: PUNCT }, { text: "alpha", color: STR }, { text: ": ", color: PUNCT }, { text: "0.036", color: ACCENT }, { text: " })", color: PUNCT }],
  [{ text: "    for ", color: ACCENT }, { text: "(", color: PUNCT }, { text: "const ", color: ACCENT }, { text: "w", color: STR }, { text: " of ", color: ACCENT }, { text: "f.line.words", color: STR }, { text: ") {", color: PUNCT }],
  [{ text: "      const ", color: ACCENT }, { text: "p", color: STR }, { text: " = ", color: PUNCT }, { text: "seg", color: STR }, { text: "(", color: PUNCT }, { text: "t", color: STR }, { text: ", ", color: PUNCT }, { text: "w.s", color: STR }, { text: ", ", color: PUNCT }, { text: "w.e", color: STR }, { text: ")", color: PUNCT }],
  [{ text: "      drawWord", color: STR }, { text: "(", color: PUNCT }, { text: "ctx", color: STR }, { text: ", ", color: PUNCT }, { text: "w", color: STR }, { text: ", ", color: PUNCT }, { text: "e", color: STR }, { text: " * ", color: PUNCT }, { text: "p", color: STR }, { text: ")", color: PUNCT }],
  [{ text: "    }", color: PUNCT }],
  [{ text: "    return ", color: ACCENT }, { text: "ctx", color: STR }, { text: "   ", color: PUNCT }, { text: "// pure", color: COMMENT }],
  [{ text: "  }", color: PUNCT }],
  [{ text: "}", color: PUNCT }],
];

const plate: Plate = {
  id: "code",
  label: "source",
  draw(ctx: Ctx, f) {
    const t = f.lt;
    const px = 140;
    const py = 220;
    const pw = 1080;
    const ph = 540;

    // ghost f(t) behind everything
    txt(ctx, "f(t)", 1500, 760, {
      size: 420,
      face: "Archivo900",
      tracking: -14,
      color: P.bone,
      alpha: 0.035,
    });
    bloom(ctx, 1540, 420, 520, P.accent, 0.03 + f.level * 0.05);

    /* ----------------------------------------------------------- editor */
    const inP = at(t, 0.05, 0.75, easeOutExpo);
    ctx.save();
    ctx.globalAlpha = inP;
    ctx.translate(0, (1 - inP) * 26);
    panel(ctx, px, py, pw, ph, { title: "src/plates/code.ts" });

    const lineH = 34;
    const size = 21;
    let charsBudget = Math.max(0, (t - 0.5) * 150);
    CODE.forEach((line, i) => {
      const y = py + 88 + i * lineH;
      // gutter
      txt(ctx, String(i + 1).padStart(2, "0"), px + 24, y, {
        size: 16,
        face: "Mono400",
        color: P.bone,
        alpha: 0.18,
      });
      if (!line.length) {
        charsBudget -= 1;
        return;
      }
      const length = line.reduce((a, tok) => a + Array.from(tok.text).length, 0);
      if (charsBudget <= 0) {
        charsBudget -= length;
        return;
      }
      const show = Math.min(length, charsBudget);
      // syntax colour guard: tokens carry colours except the class name
      const tokens = line.map((tok) =>
        tok.color === ("bold" as any) ? { ...tok, color: P.bone } : tok,
      );
      codeLine(ctx, tokens, px + 70, y, size, { chars: show });
      if (show < length) charsBudget = 0;
      else charsBudget -= length + 1;
    });

    // highlight bar that sweeps the block once typing settles
    const hi = at(t, 4.6, 5.4, easeOutCubic);
    if (hi > 0) {
      const y = py + 88 + 7 * lineH;
      ctx.save();
      ctx.globalAlpha = 0.16 * hi * (0.55 + 0.45 * Math.sin(t * 3.4) * 0.5 + 0.225);
      ctx.fillStyle = P.accent;
      ctx.fillRect(px + 52, y - 24, (pw - 76) * hi, 32);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.9 * hi;
      ctx.fillStyle = P.accent;
      ctx.fillRect(px + 52, y - 24, 3, 32);
      ctx.restore();
    }
    ctx.restore();

    /* ------------------------------------------------------------ graph */
    const gp = at(t, 2.0, 3.0, easeOutExpo);
    if (gp > 0) {
      const gx = 1290;
      const gy = 240;
      const gw = 490;
      const gh = 360;
      ctx.save();
      ctx.globalAlpha = gp;
      ctx.translate(0, (1 - gp) * 24);
      panel(ctx, gx, gy, gw, gh, { title: "frame = f(t)" });

      const ox = gx + 56;
      const oy = gy + gh - 62;
      const iw = gw - 100;
      const ih = gh - 140;
      // axes
      ctx.strokeStyle = rgba(P.bone, 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox, gy + 70);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox + iw, oy);
      ctx.stroke();
      label(ctx, "t", ox + iw - 4, oy + 30, { size: 14, tracking: 2, color: P.bone, alpha: 0.4, align: "right" });
      label(ctx, "frame", ox - 10, gy + 80, { size: 13, tracking: 2, color: P.bone, alpha: 0.35, align: "left" });

      // the curve: a pure function of time
      const drawP = at(t, 2.4, 4.4, easeInOutCubic);
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const steps = 90;
      for (let i = 0; i <= steps * clamp(drawP); i++) {
        const k = i / steps;
        const x = ox + k * iw;
        const value = 1 - Math.pow(1 - k, 3);
        const y = oy - value * ih;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // head that tracks the current moment
      const headK = clamp(f.p * 1.15);
      const hx = ox + headK * iw;
      const hy = oy - (1 - Math.pow(1 - headK, 3)) * ih;
      ctx.strokeStyle = rgba(P.accent, 0.25);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, oy);
      ctx.lineTo(hx, hy);
      ctx.moveTo(ox, hy);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = P.accent;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = gp * 0.25;
      ctx.beginPath();
      ctx.arc(hx, hy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ------------------------------------------------------------ chips */
    const chipsIn = at(t, we(f, "time") - 0.6, we(f, "time") + 0.2);
    if (chipsIn > 0) {
      ctx.save();
      ctx.globalAlpha = chipsIn;
      let cx = 1290;
      for (const c of ["deterministic", "no cache", "seek-safe"]) {
        cx += chip(ctx, c, cx, 660, { accent: P.accent, size: 13, alpha: 0.85 }) + 10;
      }
      rule(ctx, 1290, 720, 490, chipsIn, rgba(P.bone, 0.12), 1);
      txt(ctx, "same frame, every run", 1290, 760, {
        size: 18,
        face: "Mono400",
        color: P.bone,
        alpha: 0.4,
      });
      ctx.restore();
    }

    // "not a video file" struck out under the editor during the opening line
    const stamp = at(t, 0.6, 1.2, easeOutExpo) * (1 - at(t, 2.9, 3.5, easeOutCubic));
    if (stamp > 0.01) {
      ctx.save();
      ctx.globalAlpha = stamp;
      txt(ctx, "what comes back is not a video file", 140, 828, {
        size: 38,
        face: "SerifI400",
        color: P.bone,
        alpha: 0.8,
      });
      const sw = measure(ctx, "what comes back is not a video file", 38, "SerifI400", 0);
      ctx.strokeStyle = rgba(P.accent, 0.85);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(136, 810);
      ctx.lineTo(136 + (sw + 8) * stamp, 806);
      ctx.stroke();
      ctx.restore();
    }
  },
};

export default plate;
