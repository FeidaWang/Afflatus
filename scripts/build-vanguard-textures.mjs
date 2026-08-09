import { copyFile, readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';

const SOURCE_SIZE = 512;
const OUTPUT_SIZE = 1024;
const sourcePath = resolve(process.argv[2] || 'assets/material-source/vanguard-graphite-wear-v1.png');
const outputDir = resolve(process.argv[3] || 'public/assets/combat/materials');
const run = promisify(execFile);

async function decodeSourcePng() {
  const encoded = (await readFile(sourcePath)).toString('base64');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    return Buffer.from(await page.evaluate(async ({ encoded, size }) => {
      const response = await fetch(`data:image/png;base64,${encoded}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(size, size);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, size, size);
      bitmap.close();
      const bytes = context.getImageData(0, 0, size, size).data;
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      return btoa(binary);
    }, { encoded, size: SOURCE_SIZE }), 'base64');
  } finally {
    await browser.close();
  }
}

function buildPeriodicHeight(source) {
  const height = new Float32Array(OUTPUT_SIZE * OUTPUT_SIZE);
  let sum = 0;
  for (let y = 0; y < OUTPUT_SIZE; y += 1) {
    const sy = y < SOURCE_SIZE ? y : OUTPUT_SIZE - 1 - y;
    for (let x = 0; x < OUTPUT_SIZE; x += 1) {
      const sx = x < SOURCE_SIZE ? x : OUTPUT_SIZE - 1 - x;
      const sourceOffset = (sy * SOURCE_SIZE + sx) * 4;
      const value = (
        source[sourceOffset] * 0.2126
        + source[sourceOffset + 1] * 0.7152
        + source[sourceOffset + 2] * 0.0722
      ) / 255;
      height[y * OUTPUT_SIZE + x] = value;
      sum += value;
    }
  }

  const mean = sum / height.length;
  let variance = 0;
  for (const value of height) variance += (value - mean) ** 2;
  const deviation = Math.sqrt(variance / height.length) || 1;
  for (let i = 0; i < height.length; i += 1) {
    height[i] = Math.max(0, Math.min(1, 0.5 + (height[i] - mean) / deviation * 0.13));
  }
  return height;
}

function sample(height, x, y, size = OUTPUT_SIZE) {
  return height[((y + size) % size) * size + ((x + size) % size)];
}

function buildMaps(height) {
  const normal = new Uint8Array(OUTPUT_SIZE * OUTPUT_SIZE * 4);
  const orm = new Uint8Array(OUTPUT_SIZE * OUTPUT_SIZE * 4);
  const detailWear = new Uint8Array(OUTPUT_SIZE * OUTPUT_SIZE * 4);

  for (let y = 0; y < OUTPUT_SIZE; y += 1) {
    for (let x = 0; x < OUTPUT_SIZE; x += 1) {
      const h = sample(height, x, y);
      const dx = sample(height, x + 1, y) - sample(height, x - 1, y);
      const dy = sample(height, x, y + 1) - sample(height, x, y - 1);
      const nx = -dx * 2.8;
      const ny = dy * 2.8;
      const invLength = 1 / Math.hypot(nx, ny, 1);
      const offset = (y * OUTPUT_SIZE + x) * 4;
      normal[offset] = Math.round((nx * invLength * 0.5 + 0.5) * 255);
      normal[offset + 1] = Math.round((ny * invLength * 0.5 + 0.5) * 255);
      normal[offset + 2] = Math.round((invLength * 0.5 + 0.5) * 255);
      normal[offset + 3] = 255;

      const cavity = Math.max(0, sample(height, x - 2, y) + sample(height, x + 2, y)
        + sample(height, x, y - 2) + sample(height, x, y + 2) - h * 4);
      const edge = Math.min(1, Math.hypot(dx, dy) * 13);
      const wear = Math.min(1, Math.max(0, (h - 0.55) * 3.4) + edge * 0.48);
      orm[offset] = Math.round(255 * (0.9 - Math.min(0.24, cavity * 0.7)));
      orm[offset + 1] = Math.round(255 * Math.min(0.72, 0.34 + (1 - h) * 0.28 + edge * 0.12));
      orm[offset + 2] = Math.round(255 * Math.max(0.72, 0.9 - wear * 0.12));
      orm[offset + 3] = 255;

      const detail = Math.round(255 * Math.min(1, 0.82 + (h - 0.5) * 0.22 + wear * 0.12));
      detailWear[offset] = Math.min(255, detail + Math.round(wear * 18));
      detailWear[offset + 1] = Math.min(255, detail + Math.round(edge * 10));
      detailWear[offset + 2] = detail;
      detailWear[offset + 3] = 255;
    }
  }
  return { normal, orm, detailWear };
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.byteLength);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function encodePng(data) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(OUTPUT_SIZE, 0);
  header.writeUInt32BE(OUTPUT_SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((OUTPUT_SIZE * 4 + 1) * OUTPUT_SIZE);
  for (let row = 0; row < OUTPUT_SIZE; row += 1) {
    const target = row * (OUTPUT_SIZE * 4 + 1);
    scanlines[target] = 0;
    scanlines.set(data.subarray(row * OUTPUT_SIZE * 4, (row + 1) * OUTPUT_SIZE * 4), target + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(outputDir, { recursive: true });
const source = await decodeSourcePng();
const maps = buildMaps(buildPeriodicHeight(source));
const outputs = [
  ['vanguard-normal', maps.normal, ['-uastc', '-uastc_level', '2', '-uastc_rdo_l', '1.4', '-normal_map', '-mip_renorm']],
  ['vanguard-orm', maps.orm, ['-linear', '-quality', '82', '-effort', '5', '-mip_linear']],
  ['vanguard-detail-wear', maps.detailWear, ['-linear', '-quality', '78', '-effort', '5', '-mip_linear']],
];

const scratchDir = await mkdtemp(resolve(tmpdir(), 'afflatus-vanguard-textures-'));
try {
  for (const [name, data, codecOptions] of outputs) {
    const pngPath = resolve(scratchDir, `${name}.png`);
    const ktxPath = resolve(outputDir, `${name}.ktx2`);
    await writeFile(pngPath, encodePng(data));
    await run('basisu', [
      '-file', pngPath,
      '-output_file', ktxPath,
      '-ktx2',
      '-mipmap',
      ...codecOptions,
    ], { maxBuffer: 16 * 1024 * 1024 });
    await run('basisu', [ktxPath, '-validate'], { maxBuffer: 16 * 1024 * 1024 });
    const encoded = await readFile(ktxPath);
    console.log(`wrote ${name}.ktx2 (${encoded.byteLength} bytes, ${OUTPUT_SIZE}px, 11 mips)`);
  }
} finally {
  await rm(scratchDir, { recursive: true, force: true });
}

const transcoderDir = resolve('public/vendor/basis');
await mkdir(transcoderDir, { recursive: true });
for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  await copyFile(
    resolve(`node_modules/three/examples/jsm/libs/basis/${name}`),
    resolve(transcoderDir, name),
  );
}
