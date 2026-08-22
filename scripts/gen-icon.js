// Generates the app's stylized avatar icon set. Run with:
//   npm install canvas && node scripts/gen-icon.js
// `canvas` is intentionally not a project dependency — it's a native
// module only needed for this one-off local generation step, not for
// building or running the app, so it's kept out of the deploy.
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const BEIGE = "#F2E9DA";
const SKIN = "#E8B48C";
const HAIR = "#6B4226";
const HAIR_DARK = "#4A2E18";
const FRAME = "#161616";
const LENS = "rgba(250, 240, 224, 0.6)";
const EYE = "#241a12";
const SHIRT = "#C4551E";
const NOSE_SHADOW = "rgba(120, 70, 40, 0.28)";

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(size, { maskable = false } = {}) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BEIGE;
  ctx.fillRect(0, 0, size, size);

  // Maskable icons need extra padding so the shape survives being cropped
  // to a circle/rounded-square by the OS.
  const s = maskable ? size * 0.68 : size * 0.94;
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2 + s * 0.02);
  const u = (v) => v * s;

  // Shoulders / shirt
  ctx.fillStyle = SHIRT;
  ctx.beginPath();
  ctx.moveTo(u(0.05), u(1.04));
  ctx.quadraticCurveTo(u(0.5), u(0.74), u(0.95), u(1.04));
  ctx.lineTo(u(0.95), u(1.15));
  ctx.lineTo(u(0.05), u(1.15));
  ctx.closePath();
  ctx.fill();

  // Hair — simple overlapping shapes drawn BEHIND the face; the face
  // silhouette drawn on top clips them into a clean hairline.
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.ellipse(u(0.5), u(0.26), u(0.335), u(0.29), 0, 0, Math.PI * 2);
  ctx.fill();
  // side-swept flick for some styling, tilted, overlapping the main cap
  ctx.beginPath();
  ctx.ellipse(u(0.73), u(0.24), u(0.15), u(0.24), 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(u(0.195), u(0.53), u(0.035), u(0.05), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(u(0.805), u(0.53), u(0.035), u(0.05), 0, 0, Math.PI * 2);
  ctx.fill();

  // Face shape (drawn on top of hair — clips it into a hairline)
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.moveTo(u(0.5), u(0.16));
  ctx.bezierCurveTo(u(0.74), u(0.16), u(0.82), u(0.35), u(0.80), u(0.52));
  ctx.bezierCurveTo(u(0.79), u(0.68), u(0.67), u(0.83), u(0.5), u(0.85));
  ctx.bezierCurveTo(u(0.33), u(0.83), u(0.21), u(0.68), u(0.20), u(0.52));
  ctx.bezierCurveTo(u(0.18), u(0.35), u(0.26), u(0.16), u(0.5), u(0.16));
  ctx.closePath();
  ctx.fill();

  // Eyebrows
  ctx.fillStyle = HAIR_DARK;
  ctx.beginPath();
  ctx.ellipse(u(0.365), u(0.415), u(0.075), u(0.02), -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(u(0.635), u(0.415), u(0.075), u(0.02), 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.strokeStyle = NOSE_SHADOW;
  ctx.lineWidth = u(0.02);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(u(0.49), u(0.56));
  ctx.quadraticCurveTo(u(0.465), u(0.63), u(0.5), u(0.655));
  ctx.stroke();

  // Beard
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.moveTo(u(0.22), u(0.5));
  ctx.bezierCurveTo(u(0.20), u(0.66), u(0.29), u(0.81), u(0.5), u(0.85));
  ctx.bezierCurveTo(u(0.71), u(0.81), u(0.80), u(0.66), u(0.78), u(0.5));
  ctx.bezierCurveTo(u(0.75), u(0.6), u(0.67), u(0.58), u(0.61), u(0.61));
  ctx.bezierCurveTo(u(0.565), u(0.645), u(0.435), u(0.645), u(0.39), u(0.61));
  ctx.bezierCurveTo(u(0.33), u(0.58), u(0.25), u(0.6), u(0.22), u(0.5));
  ctx.closePath();
  ctx.fill();

  // Mouth / smirk
  ctx.strokeStyle = "#2a1a10";
  ctx.lineWidth = u(0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(u(0.435), u(0.7));
  ctx.quadraticCurveTo(u(0.5), u(0.715), u(0.585), u(0.695));
  ctx.stroke();

  // Glasses lenses (fill)
  ctx.fillStyle = LENS;
  roundRectPath(ctx, u(0.225), u(0.435), u(0.225), u(0.165), u(0.055));
  ctx.fill();
  roundRectPath(ctx, u(0.55), u(0.435), u(0.225), u(0.165), u(0.055));
  ctx.fill();

  // Eyes behind lenses
  ctx.fillStyle = EYE;
  ctx.beginPath();
  ctx.arc(u(0.35), u(0.52), u(0.022), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(u(0.65), u(0.52), u(0.022), 0, Math.PI * 2);
  ctx.fill();

  // Glasses frame (stroke, on top for crisp edges)
  ctx.strokeStyle = FRAME;
  ctx.lineWidth = u(0.032);
  ctx.lineJoin = "round";
  roundRectPath(ctx, u(0.225), u(0.435), u(0.225), u(0.165), u(0.055));
  ctx.stroke();
  roundRectPath(ctx, u(0.55), u(0.435), u(0.225), u(0.165), u(0.055));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(u(0.45), u(0.49));
  ctx.lineTo(u(0.55), u(0.49));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(u(0.225), u(0.47));
  ctx.lineTo(u(0.16), u(0.45));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(u(0.775), u(0.47));
  ctx.lineTo(u(0.84), u(0.45));
  ctx.stroke();

  ctx.restore();
  return canvas;
}

const outDir = path.join(__dirname, "..", "public");
fs.writeFileSync(path.join(outDir, "icons", "icon-192.png"), drawIcon(192).toBuffer("image/png"));
fs.writeFileSync(path.join(outDir, "icons", "icon-512.png"), drawIcon(512).toBuffer("image/png"));
fs.writeFileSync(
  path.join(outDir, "icons", "icon-maskable-512.png"),
  drawIcon(512, { maskable: true }).toBuffer("image/png")
);
fs.writeFileSync(path.join(outDir, "icons", "apple-touch-icon.png"), drawIcon(180).toBuffer("image/png"));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), drawIcon(180).toBuffer("image/png"));

console.log("Icons written to public/icons/ and public/apple-touch-icon.png");
