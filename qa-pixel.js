/* qa-pixel.js — decode a PNG screenshot and report canvas-content evidence.
   No deps: parse PNG chunks, inflate IDAT, unfilter scanlines. */
const fs = require('fs'), zlib = require('zlib');

function decodePNG(path) {
  const b = fs.readFileSync(path);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8);
    const data = b.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error('unsupported png ' + bitDepth + '/' + colorType);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, bb = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1; else if (f === 4) v += paeth(a, bb, c);
      cur[x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}

function near(r, g, b, tr, tg, tb, tol) { return Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(b - tb) <= tol; }

const file = process.argv[2];
const { w, h, bpp, data } = decodePNG(file);
const px = (x, y) => { const i = (y * w + x) * bpp; return [data[i], data[i + 1], data[i + 2]]; };

let gold = 0, teal = 0, paper = 0, brassHi = 0, red = 0, nonBg = 0;
const N = 40000;
for (let k = 0; k < N; k++) {
  const x = Math.floor(Math.random() * w), y = Math.floor(Math.random() * h);
  const [r, g, b] = px(x, y);
  if (near(r, g, b, 11, 13, 16, 6)) continue; // page bg
  nonBg++;
  if (near(r, g, b, 212, 169, 78, 40)) gold++;
  if (near(r, g, b, 240, 205, 127, 40)) brassHi++;
  if (near(r, g, b, 91, 168, 160, 40)) teal++;
  if (near(r, g, b, 232, 228, 218, 30)) paper++;
  if (near(r, g, b, 199, 91, 79, 40)) red++;
}
const pct = (n) => (100 * n / N).toFixed(2) + '%';

// canvas-evidence: count bright (non-text-dim) pixels inside studio band
let studioColored = 0;
for (let k = 0; k < N; k++) {
  const x = Math.floor(Math.random() * w), y = Math.floor(h * 0.28 + Math.random() * h * 0.45);
  const [r, g, b] = px(x, y);
  if (near(r, g, b, 212, 169, 78, 50) || near(r, g, b, 91, 168, 160, 50) || near(r, g, b, 240, 205, 127, 50)) studioColored++;
}

console.log(JSON.stringify({ file: file.split('/').pop(), w, h, nonBg: pct(nonBg), gold, brassHi, teal, paper, red, studioColored, sampled: N }));
if (gold < 30) { console.log('WARN: almost no gold pixels — sigma path/radar may be empty'); process.exit(1); }
if (studioColored < 15) { console.log('WARN: studio band looks empty — canvases may not have drawn'); process.exit(1); }
console.log('PIXEL-QA-OK');
