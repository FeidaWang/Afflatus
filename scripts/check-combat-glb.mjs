import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve('public/assets/combat/afflatus-command.glb');
const data = await readFile(target);
if (data.toString('ascii', 0, 4) !== 'glTF') throw new Error('Combat GLB has an invalid magic header.');
if (data.readUInt32LE(4) !== 2) throw new Error('Combat GLB must use glTF 2.0.');
if (data.readUInt32LE(8) !== data.length) throw new Error('Combat GLB header length does not match the asset.');
if (data.length > 180_000) throw new Error(`Combat GLB exceeds the 180 KB budget (${data.length} bytes).`);
console.log(`combat GLB ok (${data.length} bytes)`);
