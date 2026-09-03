// Generates app-icon.png (1024x1024, macOS squircle style) matching the app's
// dark glassmorphism theme: #090d16 background, #38bdf8 -> #6366f1 waveform.
// Run: node scripts/make-icon.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;
const PAD = 100; // macOS icon grid padding
const RADIUS = 185; // squircle corner radius at 1024px
const rect = { x0: PAD, y0: PAD, x1: SIZE - PAD, y1: SIZE - PAD };

const px = new Uint8Array(SIZE * SIZE * 4);

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function inRoundedRect(x, y) {
  const cx = Math.max(rect.x0 + RADIUS, Math.min(x, rect.x1 - RADIUS));
  const cy = Math.max(rect.y0 + RADIUS, Math.min(y, rect.y1 - RADIUS));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

function inCapsule(x, y, cx0, cy0, cx1, cy1, r) {
  const nx = Math.max(cx0, Math.min(x, cx1));
  const ny = Math.max(cy0, Math.min(y, cy1));
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy <= r * r;
}

// Waveform bars: 13 capsules, symmetric envelope, centered on the canvas.
const BAR_W = 26;
const BAR_GAP = 30;
const BAR_R = BAR_W / 2;
const heights = [130, 210, 310, 430, 560, 660, 690, 660, 560, 430, 310, 210, 130];
const bars = [];
{
  const totalW = bars_len(heights.length, BAR_W, BAR_GAP);
  let x = SIZE / 2 - totalW / 2 + BAR_R;
  for (const h of heights) {
    const half = h / 2;
    bars.push({ x0: x - BAR_R, y0: SIZE / 2 - half, x1: x + BAR_R, y1: SIZE / 2 + half });
    x += BAR_W + BAR_GAP;
  }
}
function bars_len(count, w, gap) {
  return count * w + (count - 1) * gap;
}

function bgColor(x, y) {
  // Vertical glass gradient with a faint cyan glow top-left and indigo glow bottom-right
  const t = clamp01((y - rect.y0) / (rect.y1 - rect.y0));
  let r = lerp(11, 16, t);
  let g = lerp(17, 26, t);
  let b = lerp(32, 54, t);
  const dTL = Math.hypot(x - rect.x0, y - rect.y0) / (SIZE * 0.9);
  const dBR = Math.hypot(x - rect.x1, y - rect.y1) / (SIZE * 0.9);
  r = lerp(r, 56, clamp01(1 - dTL) * 0.35 + clamp01(1 - dBR) * 0.25);
  g = lerp(g, 130, clamp01(1 - dTL) * 0.35);
  b = lerp(b, 190, clamp01(1 - dTL) * 0.35 + clamp01(1 - dBR) * 0.3);
  return [r, g, b];
}

function waveColor(x) {
  const t = clamp01((x - rect.x0) / (rect.x1 - rect.x0));
  // #38bdf8 (56,189,248) -> #6366f1 (99,102,241)
  return [lerp(56, 99, t), lerp(189, 102, t), lerp(248, 241, t)];
}

// 2x2 supersampled coverage for crisp edges at icon scale
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let inside = 0;
    let barHit = false;
    for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const sx = x + ox;
      const sy = y + oy;
      if (!inRoundedRect(sx, sy)) continue;
      inside++;
      for (const b of bars) {
        if (inCapsule(sx, sy, b.x0 + BAR_R, b.y0 + BAR_R, b.x1 - BAR_R, b.y1 - BAR_R, BAR_R)) {
          barHit = true;
          break;
        }
      }
    }
    const i = (y * SIZE + x) * 4;
    if (inside === 0) continue; // transparent outside squircle
    const [bgR, bgG, bgB] = bgColor(x, y);
    if (barHit) {
      const [r, g, b] = waveColor(x);
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    } else {
      px[i] = bgR; px[i + 1] = bgG; px[i + 2] = bgB;
      px[i + 3] = Math.round((inside / 4) * 255);
    }
  }
}

// --- Minimal PNG encoder (RGBA8, filter 0) ---
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'app-icon.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);
