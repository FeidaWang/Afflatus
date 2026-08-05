#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { DATA_PIPELINES } from '../src/config/dataPipelines.js';
import { assessMarketSnapshot } from '../src/lib/marketFreshness.js';

const strict = process.argv.includes('--strict');
const jsonOutput = process.argv.includes('--json');
const nowArg = process.argv.find((argument) => argument.startsWith('--now='));
const now = nowArg ? new Date(nowArg.slice('--now='.length)) : new Date();
if (Number.isNaN(now.getTime())) throw new TypeError('Invalid --now timestamp');

function zonedDate(timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function readArtifact(output) {
  try {
    const data = JSON.parse(readFileSync(output.path, 'utf8'));
    return { value: data[output.dateField], error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

function assess(pipeline, output) {
  const artifact = readArtifact(output);
  if (artifact.error) return { ...output, value: null, state: 'invalid', stale: true, detail: artifact.error };
  if (pipeline.kind === 'market-session') {
    const snapshotDate = typeof artifact.value === 'string' ? artifact.value.slice(0, 10) : artifact.value;
    const result = assessMarketSnapshot(snapshotDate, now, { availableFromMinutes: pipeline.availableFromMinutes });
    return { ...output, value: artifact.value, ...result, detail: `expected ${result.expectedDate}` };
  }
  if (pipeline.kind === 'calendar-day') {
    const expectedDate = zonedDate(pipeline.timeZone);
    const stale = artifact.value !== expectedDate;
    return { ...output, value: artifact.value, state: stale ? 'stale' : 'fresh', stale, expectedDate, detail: `expected ${expectedDate}` };
  }
  const timestamp = Date.parse(artifact.value);
  const ageHours = Number.isFinite(timestamp) ? Math.max(0, (now.getTime() - timestamp) / 3_600_000) : null;
  const stale = ageHours == null || ageHours > pipeline.maxAgeHours;
  return { ...output, value: artifact.value, state: stale ? 'stale' : 'fresh', stale, ageHours, detail: ageHours == null ? 'invalid timestamp' : `${ageHours.toFixed(1)}h / ${pipeline.maxAgeHours}h` };
}

const report = DATA_PIPELINES.map((pipeline) => {
  const outputs = pipeline.outputs.map((output) => assess(pipeline, output));
  return { id: pipeline.id, state: outputs.some((output) => output.stale) ? 'stale' : 'fresh', outputs };
});
const staleCount = report.reduce((sum, pipeline) => sum + pipeline.outputs.filter((output) => output.stale).length, 0);

if (jsonOutput) {
  console.log(JSON.stringify({ checkedAt: now.toISOString(), staleCount, pipelines: report }, null, 2));
} else {
  for (const pipeline of report) {
    console.log(`${pipeline.state === 'fresh' ? 'OK' : 'STALE'} ${pipeline.id}`);
    for (const output of pipeline.outputs) console.log(`  ${output.state.padEnd(7)} ${output.resource.padEnd(20)} ${String(output.value || '—').padEnd(25)} ${output.detail}`);
  }
  console.log(`\n${staleCount} stale or invalid artifact(s).`);
}

if (strict && staleCount) process.exitCode = 1;
