#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { DATA_PIPELINES } from '../src/config/dataPipelines.js';
import { assessPipelineOutput } from '../src/lib/dataFreshness.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaNews } from '../src/lib/validateArenaNews.js';
import { validateArenaPicks } from '../src/lib/validateArenaPicks.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { upsertRunlogEntry } from '../src/lib/arenaReconcile.js';
import { validateDailyTransits } from '../src/lib/validateDailyTransits.js';
import { validateSectorsCompetition } from '../src/lib/validateSectorsCompetition.js';
import { validateSectorsData } from '../src/lib/validateSectorsData.js';
import { validateSectorsEcosystem } from '../src/lib/validateSectorsEcosystem.js';
import { validateSectorsRivalry } from '../src/lib/validateSectorsRivalry.js';
import { validateSignalEvents } from '../src/lib/validateSignalEvents.js';
import { atomicWriteJsonGroup } from './lib/atomic-json.mjs';

const validators = new Map([
  ['arena-news', validateArenaNews],
  ['arena-picks', validateArenaPicks],
  ['arena-ledger', validateArenaLedger],
  ['arena-digest', validateArenaDigest],
  ['arena-predlog', validateArenaPredlog],
  ['signal', validateSignalEvents],
  ['sectors', validateSectorsData],
  ['sectors-competition', validateSectorsCompetition],
  ['sectors-ecosystem', validateSectorsEcosystem],
  ['sectors-rivalry', validateSectorsRivalry],
  ['transits', validateDailyTransits],
]);

function fail(message) {
  console.error(`[publish-data-pipeline] ERROR: ${message}`);
  process.exit(1);
}

const [pipelineId, candidateDirectory, ...options] = process.argv.slice(2);
if (!pipelineId || !candidateDirectory) {
  fail('usage: node scripts/publish-data-pipeline.mjs <pipeline-id> <candidate-directory> [--now=<ISO>]');
}
const pipeline = DATA_PIPELINES.find((item) => item.id === pipelineId);
if (!pipeline) fail(`unknown pipeline ${JSON.stringify(pipelineId)}`);
const nowOption = options.find((option) => option.startsWith('--now='));
const now = nowOption ? new Date(nowOption.slice(6)) : new Date();
if (Number.isNaN(now.getTime())) fail('invalid --now timestamp');

const candidates = [];
for (const output of pipeline.outputs) {
  const validator = validators.get(output.resource);
  if (!validator) fail(`no validator registered for ${output.resource}`);
  const candidatePath = resolve(candidateDirectory, basename(output.path));
  let data;
  try {
    data = JSON.parse(readFileSync(candidatePath, 'utf8'));
  } catch (error) {
    fail(`${candidatePath}: ${error.message}`);
  }
  const validation = validator(data);
  if (!validation.ok) fail(`${candidatePath}: ${validation.errors.join('; ')}`);
  const freshness = assessPipelineOutput(pipeline, output, data[output.dateField], now);
  if (freshness.stale) fail(`${candidatePath}: ${output.dateField}=${JSON.stringify(data[output.dateField])}, ${freshness.detail}`);
  candidates.push({ path: join(process.cwd(), output.path), data });
}

if (pipeline.id === 'arena-premarket') {
  const news = candidates.find((candidate) => candidate.path.endsWith('/arena-news.json')).data;
  const picks = candidates.find((candidate) => candidate.path.endsWith('/arena-picks.json')).data;
  if (news.date !== picks.date) fail(`arena premarket group has mismatched dates: ${news.date} / ${picks.date}`);
  const runlogPath = join(process.cwd(), 'public/arena-runlog.json');
  let runlog = JSON.parse(readFileSync(runlogPath, 'utf8'));
  runlog = upsertRunlogEntry(runlog, {
    date: news.date,
    window: 'pre-market-gather',
    model: 'gatherer',
    status: 'done',
    ordersProposed: 0,
    ordersFilled: 0,
    note: `Validated bilingual briefing published with ${news.items.length} sourced item(s).`,
  });
  const pickCount = Object.values(picks.models).reduce((sum, list) => sum + list.length, 0);
  runlog = upsertRunlogEntry(runlog, {
    date: picks.date,
    window: 'picks-publish',
    model: 'gatherer',
    status: 'done',
    ordersProposed: pickCount,
    ordersFilled: 0,
    note: `Validated picks board published with ${pickCount} candidate(s); empty arrays are an intentional fail-closed outcome.`,
  });
  const validation = validateArenaRunlog(runlog);
  if (!validation.ok) fail(`arena-runlog.json: ${validation.errors.join('; ')}`);
  candidates.push({ path: runlogPath, data: runlog });
}

atomicWriteJsonGroup(candidates);
console.log(`[publish-data-pipeline] published ${pipeline.id}: ${pipeline.outputs.map((item) => item.resource).join(', ')}`);
