import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 1800;
const H = 1000;
const out = new Uint8Array((W * 4 + 1) * H);

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
const add = (acc, r, g, b, a) => {
  const k = clamp(a);
  acc.r += r * k;
  acc.g += g * k;
  acc.b += b * k;
  acc.a = Math.max(acc.a, k);
};

for (let py = 0; py < H; py++) {
  const row = py * (W * 4 + 1);
  out[row] = 0;
  for (let px = 0; px < W; px++) {
    const nx = (px / W - 0.5) * 2.35;
    const ny = (py / H - 0.50) * 1.55;
    const r = Math.hypot(nx, ny);
    const theta = Math.atan2(ny, nx);
    const n = hash(px >> 1, py >> 1);
    const acc = { r: 0, g: 0, b: 0, a: 0 };

    const halo = Math.exp(-Math.pow((r - 0.34) * 5.0, 2)) * 0.38 + Math.exp(-Math.pow((r - 0.56) * 3.2, 2)) * 0.12;
    add(acc, 255, 235, 190, halo * (0.58 + n * 0.20));

    const lensTop = Math.exp(-Math.pow((Math.hypot(nx * 0.90, (ny + 0.09) * 1.20) - 0.44) * 8.5, 2));
    const lensBottom = Math.exp(-Math.pow((Math.hypot(nx * 0.92, (ny - 0.12) * 1.20) - 0.45) * 9.0, 2));
    add(acc, 255, 242, 213, lensTop * 0.52 * smooth(0.72, -0.05, ny));
    add(acc, 214, 176, 116, lensBottom * 0.22 * smooth(-0.70, 0.06, ny));

    const diskR = Math.sqrt(Math.pow(nx / 1.08, 2) + Math.pow((ny + 0.01) / 0.145, 2));
    const disk = Math.exp(-Math.pow((diskR - 0.86) * 7.0, 2));
    const streaks = 0.72 + 0.18 * Math.sin(nx * 44 + theta * 7) + 0.10 * Math.sin(nx * 91 + n * 5);
    const rightTail = smooth(-0.95, 0.72, nx) * smooth(1.24, 0.36, Math.abs(ny) + Math.max(0, -nx) * 0.05);
    const leftTail = smooth(1.02, -0.72, nx) * 0.72;
    const diskAlpha = disk * (0.72 + rightTail * 0.45 + leftTail * 0.16) * streaks;
    add(acc, 255, 236, 200, diskAlpha * 0.72);
    add(acc, 175, 128, 70, diskAlpha * 0.32);

    const frontBand = Math.exp(-Math.pow(ny * 18.0, 2)) * smooth(-0.95, 0.94, nx) * smooth(1.16, 0.16, Math.abs(nx));
    add(acc, 250, 226, 183, frontBand * 0.46);

    const photon = Math.exp(-Math.pow((r - 0.315) * 35.0, 2));
    add(acc, 255, 247, 223, photon * 0.48);

    const core = smooth(0.335, 0.250, r);
    const frontMask = clamp(frontBand * 0.58 + disk * Math.exp(-Math.pow(ny * 16, 2)) * 0.24);
    if (core > 0) {
      const dim = clamp(core * (1 - frontMask));
      acc.r *= (1 - dim);
      acc.g *= (1 - dim);
      acc.b *= (1 - dim);
      acc.a = Math.max(acc.a, core * 0.98);
    }

    const softEdge = smooth(1.30, 0.74, Math.sqrt(Math.pow(nx / 1.12, 2) + Math.pow(ny / 0.58, 2)));
    const a = clamp(acc.a * softEdge);
    const i = row + 1 + px * 4;
    out[i] = clamp(acc.r, 0, 255);
    out[i + 1] = clamp(acc.g, 0, 255);
    out[i + 2] = clamp(acc.b, 0, 255);
    out[i + 3] = Math.round(a * 255);
  }
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(out, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

writeFileSync(new URL('../public/assets/hud/interstellar-blackhole.png', import.meta.url), png);
