#!/usr/bin/env node
/* validate-signal-events.mjs — deterministic publish gate for Signal (V7, ROADMAP §7.3).
 *
 * The signal-warsh scheduled task is the "LLM proposes" half: it researches releases/
 * speeches via WebSearch and drafts an updated public/signal-events.json following
 * prompts/signal-warsh.md. Editorial content doesn't need a settlement engine the way
 * Arena's ledger does, but it DOES need a syntax/shape gate before an unattended task
 * commits+pushes it with nobody reviewing the diff first — this is that gate.
 *
 * Usage: node scripts/validate-signal-events.mjs [path-to-json]
 *   Defaults to public/signal-events.json. Exits 0 and prints a one-line summary on
 *   success; exits 1 and prints every problem found on failure (including JSON.parse
 *   syntax errors, which are reported before any structural checks run).
 *
 * The scheduled task must run this AFTER writing its draft and BEFORE `git add` — if it
 * exits non-zero, abort the publish step, leave the working tree as-is, and stop (don't
 * force-push a broken file just because the task already got this far). */
import { readFileSync } from 'node:fs';
import { validateSignalEvents } from '../src/lib/validateSignalEvents.js';

const path = process.argv[2] || 'public/signal-events.json';

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
  console.error('This is exactly the class of bug this validator exists to catch (an unescaped quote broke V6 once already). Do not publish.');
  process.exit(1);
}

const { ok, errors } = validateSignalEvents(data);
if (!ok) {
  console.error(`FAIL: ${path} failed schema validation (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`OK: ${path} valid — version ${data.version}, ${data.pillars.length} pillars, ${data.events.length} events, hawkDoveCompass.score=${data.hawkDoveCompass.score}`);
process.exit(0);
