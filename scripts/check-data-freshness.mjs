#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { DATA_PIPELINES } from '../src/config/dataPipelines.js';
import { assessPipelineOutput } from '../src/lib/dataFreshness.js';

const strict = process.argv.includes('--strict');
const jsonOutput = process.argv.includes('--json');
const nowArg = process.argv.find((argument) => argument.startsWith('--now='));
const ownerArg = process.argv.find((argument) => argument.startsWith('--owner='));
const owner = ownerArg ? ownerArg.slice('--owner='.length).trim() : null;
const now = nowArg ? new Date(nowArg.slice('--now='.length)) : new Date();
if (Number.isNaN(now.getTime())) throw new TypeError('Invalid --now timestamp');
if (ownerArg && !owner) throw new TypeError('--owner requires a non-empty owner');

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
  return { ...output, value: artifact.value, ...assessPipelineOutput(pipeline, output, artifact.value, now) };
}

const selectedPipelines = owner
  ? DATA_PIPELINES.filter((pipeline) => pipeline.owner === owner)
  : DATA_PIPELINES;
if (owner && !selectedPipelines.length) throw new TypeError(`No data pipelines owned by ${JSON.stringify(owner)}`);

const report = selectedPipelines.map((pipeline) => {
  const outputs = pipeline.outputs.map((output) => assess(pipeline, output));
  return { id: pipeline.id, state: outputs.some((output) => output.stale) ? 'stale' : 'fresh', outputs };
});
const staleCount = report.reduce((sum, pipeline) => sum + pipeline.outputs.filter((output) => output.stale).length, 0);

if (jsonOutput) {
  console.log(JSON.stringify({ checkedAt: now.toISOString(), owner, staleCount, pipelines: report }, null, 2));
} else {
  if (owner) console.log(`Owner scope: ${owner}`);
  for (const pipeline of report) {
    console.log(`${pipeline.state === 'fresh' ? 'OK' : 'STALE'} ${pipeline.id}`);
    for (const output of pipeline.outputs) console.log(`  ${output.state.padEnd(7)} ${output.resource.padEnd(20)} ${String(output.value || '—').padEnd(25)} ${output.detail}`);
  }
  console.log(`\n${staleCount} stale or invalid artifact(s).`);
}

if (strict && staleCount) process.exitCode = 1;
