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
