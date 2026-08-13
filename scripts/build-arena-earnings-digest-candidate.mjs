#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  assessArenaEarningsWindow,
  mergeArenaDigestEarnings,
  validateArenaEarningsDigestSupplement,
} from '../src/lib/arenaEarningsDigest.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = option('output');
const input = option('earnings-input');
if (!output || !input || args.some((arg) => !arg.startsWith('--output=') && !arg.startsWith('--earnings-input='))) {
  throw new TypeError('usage: build-arena-earnings-digest-candidate.mjs --output=<outside-repo-dir> --earnings-input=<json>');
}
const outputDir = resolve(output);
if (!relative(ROOT, outputDir).startsWith('..')) throw new TypeError('--output must be outside the repository');
if (existsSync(outputDir) && readdirSync(outputDir).length) throw new TypeError('--output must be absent or empty');

const now = new Date();
const gate = assessArenaEarningsWindow(now);
if (!gate.due) throw new Error(`real New York earnings window is not due (${gate.reason})`);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const baselineDigest = readJson(resolve(ROOT, 'public/arena-daily-digest.json'));
const ledger = readJson(resolve(ROOT, 'public/arena-ledger.json'));
const picks = readJson(resolve(ROOT, 'public/arena-picks.json'));
if (baselineDigest.date !== gate.date) throw new Error('current-session postmarket digest must exist before an earnings supplement');
const candidateDigest = mergeArenaDigestEarnings({ digest: baselineDigest, input: readJson(resolve(input)), ledger, picks, now });
const shape = validateArenaDigest(candidateDigest);
if (!shape.ok) throw new Error(shape.errors.join('; '));
const delta = validateArenaEarningsDigestSupplement({ baselineDigest, candidateDigest, ledger, picks });
if (!delta.ok) throw new Error(delta.errors.join('; '));
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'arena-daily-digest.json'), `${JSON.stringify(candidateDigest, null, 2)}\n`);
console.log(JSON.stringify({ candidateOnly: true, pipelineId: 'arena-earnings-digest', sessionDate: gate.date, additions: candidateDigest.earnings.length - (baselineDigest.earnings || []).length }, null, 2));
