#!/usr/bin/env node
/**
 * Worlds 2026 publication window gate (pre-commit hook of `data:publish
 * worlds-daily`). A prediction is sealed by its kickoff: once a series has
 * started, the staged public/worlds-data.json may not add or alter its pick,
 * and a series that already has a result keeps the pick it was scored with.
 * The baseline is HEAD's copy of the file (absent on the very first publish).
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PATH = 'public/worlds-data.json';
if (process.argv.some((argument) => argument.startsWith('--now'))) {
  throw new TypeError('The production window gate always uses the real wall clock; --now is not supported');
}
const now = new Date();

function readCandidate() {
  return JSON.parse(readFileSync(PATH, 'utf8'));
}

function readBaseline() {
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:${PATH}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    return { series: [] };
  }
}

const candidate = readCandidate();
const baseline = readBaseline();
const baselineById = new Map((baseline.series || []).map((series) => [series.id, series]));
const samePick = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const violations = [];
for (const series of candidate.series || []) {
  const previous = baselineById.get(series.id);
  const started = Number.isFinite(Date.parse(series.kickoff)) && Date.parse(series.kickoff) <= now.getTime();
  if (started && series.pick && !samePick(series.pick, previous?.pick)) {
    violations.push(`${series.id}: kickoff ${series.kickoff} has passed; its pick must equal the published pick`);
  }
  if (series.result && previous?.pick && !samePick(series.pick, previous.pick)) {
    violations.push(`${series.id}: resolved series may not change the pick it was scored with`);
  }
}

console.log(JSON.stringify({
  checkedAt: now.toISOString(),
  baseline: baselineById.size ? 'HEAD' : 'none',
  series: (candidate.series || []).length,
  violations,
}, null, 2));
if (violations.length) process.exitCode = 3;
