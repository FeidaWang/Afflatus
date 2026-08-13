#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  DATA_PIPELINES,
  DATA_PIPELINE_PROFILES,
  dataPipelineOutputValue,
} from '../src/config/dataPipelines.js';
import { assessPipelineOutput } from '../src/lib/dataFreshness.js';

const strict = process.argv.includes('--strict');
const jsonOutput = process.argv.includes('--json');
const nowArg = process.argv.find((argument) => argument.startsWith('--now='));
const now = nowArg ? new Date(nowArg.slice('--now='.length)) : new Date();
if (Number.isNaN(now.getTime())) throw new TypeError('Invalid --now timestamp');

function optionValues(name) {
  const prefix = `--${name}=`;
  return process.argv
    .filter((argument) => argument.startsWith(prefix))
    .flatMap((argument) => argument.slice(prefix.length).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

const requestedPipelines = optionValues('pipeline');
const requestedProfiles = optionValues('profile');
const knownPipelineIds = new Set(DATA_PIPELINES.map((pipeline) => pipeline.id));
for (const pipelineId of requestedPipelines) {
  if (!knownPipelineIds.has(pipelineId)) throw new TypeError(`Unknown pipeline ${JSON.stringify(pipelineId)}`);
}
for (const profile of requestedProfiles) {
  if (!DATA_PIPELINE_PROFILES[profile]) throw new TypeError(`Unknown profile ${JSON.stringify(profile)}`);
}
const selectedIds = new Set([
  ...requestedPipelines,
  ...requestedProfiles.flatMap((profile) => DATA_PIPELINE_PROFILES[profile]),
]);
const selectedPipelines = selectedIds.size
  ? DATA_PIPELINES.filter((pipeline) => selectedIds.has(pipeline.id))
  : DATA_PIPELINES;

function readArtifact(output) {
  try {
    const data = JSON.parse(readFileSync(output.path, 'utf8'));
    return { value: dataPipelineOutputValue(output, data), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

function assess(pipeline, output) {
  const artifact = readArtifact(output);
  if (artifact.error) return { ...output, value: null, state: 'invalid', stale: true, detail: artifact.error };
  return { ...output, value: artifact.value, ...assessPipelineOutput(pipeline, output, artifact.value, now) };
}

const report = selectedPipelines.map((pipeline) => {
  const outputs = pipeline.outputs.map((output) => assess(pipeline, output));
  return { id: pipeline.id, state: outputs.some((output) => output.stale) ? 'stale' : 'fresh', outputs };
});
const staleCount = report.reduce((sum, pipeline) => sum + pipeline.outputs.filter((output) => output.stale).length, 0);

if (jsonOutput) {
  console.log(JSON.stringify({
    checkedAt: now.toISOString(),
    scope: {
      profiles: requestedProfiles,
      pipelines: selectedPipelines.map((pipeline) => pipeline.id),
    },
    staleCount,
    pipelines: report,
  }, null, 2));
} else {
  for (const pipeline of report) {
    console.log(`${pipeline.state === 'fresh' ? 'OK' : 'STALE'} ${pipeline.id}`);
    for (const output of pipeline.outputs) console.log(`  ${output.state.padEnd(7)} ${output.resource.padEnd(20)} ${String(output.value || '—').padEnd(25)} ${output.detail}`);
  }
  console.log(`\n${staleCount} stale or invalid artifact(s).`);
}

if (strict && staleCount) process.exitCode = 1;
