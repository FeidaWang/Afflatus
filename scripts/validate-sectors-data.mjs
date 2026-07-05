#!/usr/bin/env node
/* validate-sectors-data.mjs — deterministic publish gate for Sectors (V9-V11, ROADMAP §7.2).
 *
 * The sectors-watch scheduled task is the "LLM proposes" half: it runs prompts/
 * sectors-watch.md then prompts/postmemory-top10.md in the same weekly run and drafts
 * an updated public/sectors-data.json. Same pattern as Signal's validator (V7) — this
 * is the syntax/shape gate that must pass before an unattended task commits+pushes,
 * since nobody reviews the diff first.
 *
 * Usage: node scripts/validate-sectors-data.mjs [path-to-json]
 *   Defaults to public/sectors-data.json. Exits 0 with a one-line summary on success;
 *   exits 1 with every problem found on failure (JSON.parse errors reported first).
 *
 * The scheduled task must run this AFTER writing its draft and BEFORE `git add` — if it
 * exits non-zero, abort the publish step and leave the working tree as-is. */
import { readFileSync } from 'node:fs';
import { validateSectorsData } from '../src/lib/validateSectorsData.js';

const path = process.argv[2] || 'public/sectors-data.json';

let raw;
try {
  raw = readFileSync(path, 'utf8');
} catch (e) {
  console.error(`FAIL: could not read ${path}: ${e.message}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`FAIL: ${path} is not valid JSON — ${e.message}`);
  process.exit(1);
}

const { ok, errors } = validateSectorsData(data);
if (!ok) {
  console.error(`FAIL: ${path} failed schema validation (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const mwCount = Array.isArray(data.modelWatch) ? data.modelWatch.length : 0;
const pmCount = data.postMemory && Array.isArray(data.postMemory.cards) ? data.postMemory.cards.length : 0;
console.log(`OK: ${path} valid — version ${data.version}, modelWatch=${mwCount} vendor cards, postMemory=${pmCount} thesis cards`);
process.exit(0);
