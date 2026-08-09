import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve('public/assets/combat/afflatus-command.glb');
const data = await readFile(target);
if (data.toString('ascii', 0, 4) !== 'glTF') throw new Error('Combat GLB has an invalid magic header.');
if (data.readUInt32LE(4) !== 2) throw new Error('Combat GLB must use glTF 2.0.');
if (data.readUInt32LE(8) !== data.length) throw new Error('Combat GLB header length does not match the asset.');
// The original 17 KB primitive placeholder could fit under 180 KB, but it had
// no credible armour or surface structure.  The rebuilt seven-material hull
// remains intentionally sub-420 KB — still smaller than a single compressed
// hero image and bounded enough for the homepage critical path.
if (data.length > 420_000) throw new Error(`Combat GLB exceeds the 420 KB budget (${data.length} bytes).`);
console.log(`combat GLB ok (${data.length} bytes)`);

// Third-party combat craft are deliberately outside the critical 420 KB
// procedural-shell budget: both are lazy, KTX2 + Meshopt web derivatives and
// are only requested after the combat surface becomes active. Keep explicit
// ceilings here so a future asset refresh cannot silently restore the 6.7 MB
// fighter or 73.6 MB Venator downloads.
const authoredModelBudgets = new Map([
  ['fictional-6th-gen-fighter.glb', { min: 1_000_000, max: 3_100_000 }],
  ['venator-class-star-destroyer.glb', { min: 4_000_000, max: 11_500_000 }],
]);
for (const [name, budget] of authoredModelBudgets) {
  const model = await readFile(resolve('public/assets/combat/models', name));
  if (model.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${name} has an invalid GLB magic header.`);
  if (model.readUInt32LE(4) !== 2) throw new Error(`${name} must use glTF 2.0.`);
  if (model.readUInt32LE(8) !== model.length) throw new Error(`${name} has a mismatched GLB length header.`);
  if (model.length < budget.min || model.length > budget.max) {
    throw new Error(`${name} is outside its ${budget.min}-${budget.max} byte web budget (${model.length} bytes).`);
  }
  console.log(`${name} ok (${model.length} bytes)`);
}

const ktxIdentifier = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const textureBudgets = new Map([
  ['vanguard-normal.ktx2', 1_400_000],
  ['vanguard-orm.ktx2', 260_000],
  ['vanguard-detail-wear.ktx2', 240_000],
]);
for (const [name, budget] of textureBudgets) {
  const texture = await readFile(resolve('public/assets/combat/materials', name));
  if (!texture.subarray(0, 12).equals(ktxIdentifier)) throw new Error(`${name} has an invalid KTX2 identifier.`);
  const width = texture.readUInt32LE(20);
  const height = texture.readUInt32LE(24);
  const mipCount = texture.readUInt32LE(40);
  if (width !== 1024 || height !== 1024 || mipCount !== 11) {
    throw new Error(`${name} must be a 1024px KTX2 texture with 11 mip levels.`);
  }
  if (texture.length > budget) throw new Error(`${name} exceeds its ${budget}-byte budget (${texture.length} bytes).`);
  console.log(`${name} ok (${texture.length} bytes, ${width}px, ${mipCount} mips)`);
}

for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  const transcoder = await readFile(resolve('public/vendor/basis', name));
  if (transcoder.length < 32_000) throw new Error(`${name} is missing or truncated.`);
}
