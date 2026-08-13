#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { DATA_PIPELINES, dataPipelineOutputValue } from '../src/config/dataPipelines.js';
import { assessPipelineOutput } from '../src/lib/dataFreshness.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaNews } from '../src/lib/validateArenaNews.js';
import { validateArenaPicks, validateArenaPicksForPublication } from '../src/lib/validateArenaPicks.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { validateArenaPremarketGroup } from '../src/lib/arenaPublicationContract.js';
import { validateArenaSettlementPublication } from '../src/lib/arenaSettlementPublicationContract.js';
import { validateDailyTransits } from '../src/lib/validateDailyTransits.js';
import { validateSectorsCompetition } from '../src/lib/validateSectorsCompetition.js';
import { validateSectorsData } from '../src/lib/validateSectorsData.js';
import { validateSectorsEcosystem } from '../src/lib/validateSectorsEcosystem.js';
import { validateSectorsRivalry } from '../src/lib/validateSectorsRivalry.js';
import { validateSignalEvents } from '../src/lib/validateSignalEvents.js';
import { runAtomicPublishTransaction } from './lib/publish-transaction.mjs';
import { SITE_GENERATE_COMMAND, SITE_PUBLISH_ARTIFACTS } from './lib/site-publish-artifacts.mjs';

const validators = new Map([
  ['arena-news', validateArenaNews],
  ['arena-picks', validateArenaPicks],
  ['arena-ledger', validateArenaLedger],
  ['arena-digest', validateArenaDigest],
  ['arena-predlog', validateArenaPredlog],
  ['arena-runlog', validateArenaRunlog],
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

function arenaPreCommitCommands(pipelineId) {
  if (pipelineId === 'arena-premarket') {
    return [{
      phase: 'premarket-publication-witness',
      command: ['node', 'scripts/validate-arena-picks-publication.mjs', 'public/arena-picks.json'],
    }];
  }
  const window = new Map([
    ['arena-open', 'open'],
    ['arena-late', 'late'],
    ['arena-postmarket', 'postmarket'],
  ]).get(pipelineId);
  return window ? [{
    phase: `${window}-commit-window`,
    command: ['node', 'scripts/check-arena-window.mjs', `--window=${window}`],
  }] : [];
}

const [pipelineId, candidateDirectory, ...options] = process.argv.slice(2);
if (!pipelineId || !candidateDirectory) {
  fail('usage: node scripts/publish-data-pipeline.mjs <pipeline-id> <candidate-directory> [--message=<commit-message>]');
}
const pipeline = DATA_PIPELINES.find((item) => item.id === pipelineId);
if (!pipeline) fail(`unknown pipeline ${JSON.stringify(pipelineId)}`);
if (options.some((option) => option.startsWith('--now='))) {
  fail('the production publisher always uses the real wall clock; --now is not supported');
}
const now = new Date();
const messageOption = options.find((option) => option.startsWith('--message='));
const commitMessage = messageOption
  ? messageOption.slice('--message='.length)
  : `data: publish ${pipeline.id}`;
if (!commitMessage.trim()) fail('commit message must not be empty');

const candidates = [];
for (const output of pipeline.outputs) {
  const candidatePath = resolve(candidateDirectory, basename(output.path));
  let data;
  try {
    data = JSON.parse(readFileSync(candidatePath, 'utf8'));
  } catch (error) {
    fail(`${candidatePath}: ${error.message}`);
  }
  candidates.push({ output, candidatePath, path: join(process.cwd(), output.path), data });
}

function prepareValidatedGroup() {
  const prepared = [];
  for (const candidate of candidates) {
    const { output, candidatePath, data } = candidate;
    const validator = pipeline.id === 'arena-premarket' && output.resource === 'arena-picks'
      ? (value) => validateArenaPicksForPublication(value, { now: new Date() })
      : validators.get(output.resource);
    if (!validator) throw new Error(`no validator registered for ${output.resource}`);
    const validation = validator(data);
    if (!validation.ok) throw new Error(`${candidatePath}: ${validation.errors.join('; ')}`);
    const outputValue = dataPipelineOutputValue(output, data);
    const freshness = assessPipelineOutput(pipeline, output, outputValue, now);
    if (freshness.stale) {
      throw new Error(`${candidatePath}: ${output.dateField}=${JSON.stringify(outputValue)}, ${freshness.detail}`);
    }
    prepared.push({ path: candidate.path, data });
  }
  if (pipeline.id === 'arena-premarket') {
    const news = candidates.find((candidate) => candidate.output.resource === 'arena-news').data;
    const picks = candidates.find((candidate) => candidate.output.resource === 'arena-picks').data;
    const runlog = candidates.find((candidate) => candidate.output.resource === 'arena-runlog').data;
    const baselineLedger = JSON.parse(readFileSync(join(process.cwd(), 'public/arena-ledger.json'), 'utf8'));
    const groupValidation = validateArenaPremarketGroup(news, picks, runlog, baselineLedger);
    if (!groupValidation.ok) throw new Error(groupValidation.errors.join('; '));
  }
  if (['arena-open', 'arena-late', 'arena-postmarket'].includes(pipeline.id)) {
    const candidateLedger = candidates.find((candidate) => candidate.output.resource === 'arena-ledger')?.data;
    const candidateRunlog = candidates.find((candidate) => candidate.output.resource === 'arena-runlog')?.data;
    const baselineLedger = JSON.parse(readFileSync(join(process.cwd(), 'public/arena-ledger.json'), 'utf8'));
    const baselineRunlog = JSON.parse(readFileSync(join(process.cwd(), 'public/arena-runlog.json'), 'utf8'));
    const publishedPicks = JSON.parse(readFileSync(join(process.cwd(), 'public/arena-picks.json'), 'utf8'));
    const publishedNews = JSON.parse(readFileSync(join(process.cwd(), 'public/arena-news.json'), 'utf8'));
    const universeData = JSON.parse(readFileSync(join(process.cwd(), 'public/arena-universe.json'), 'utf8'));
    const universe = (universeData.symbols || []).map((entry) => entry.sym);
    const candidatePredlog = pipeline.id === 'arena-postmarket'
      ? candidates.find((candidate) => candidate.output.resource === 'arena-predlog')?.data
      : null;
    const baselinePredlog = pipeline.id === 'arena-postmarket'
      ? JSON.parse(readFileSync(join(process.cwd(), 'public/arena-predlog.json'), 'utf8'))
      : null;
    const settlementValidation = validateArenaSettlementPublication({
      baselineLedger,
      baselineRunlog,
      candidateLedger,
      candidateRunlog,
      publishedPicks,
      publishedNews,
      universe,
      baselinePredlog,
      candidatePredlog,
      pipelineId: pipeline.id,
      now: new Date(),
    });
    if (!settlementValidation.ok) {
      throw new Error(`Arena settlement publication contract: ${settlementValidation.errors.join('; ')}`);
    }
  }
  if (pipeline.id === 'arena-postmarket') {
    const predlog = candidates.find((candidate) => candidate.output.resource === 'arena-predlog').data;
    const digest = candidates.find((candidate) => candidate.output.resource === 'arena-digest').data;
    const runlog = candidates.find((candidate) => candidate.output.resource === 'arena-runlog').data;
    const auditStatuses = new Set(['scored', 'partial', 'no-predictions', 'missed-source']);
    for (const day of predlog.days) {
      if (!auditStatuses.has(day.audit?.status)) {
        throw new Error(`arena-predlog.json: ${day.date} needs an explicit scored/partial/no-predictions/missed-source audit`);
      }
      if (!Number.isFinite(Date.parse(day.audit.checkedAt)) || typeof day.audit.note !== 'string' || !day.audit.note.trim()) {
        throw new Error(`arena-predlog.json: ${day.date} audit needs checkedAt and note`);
      }
    }
    const checkedDay = predlog.days.find((day) => day.date === predlog.checkedThrough);
    if (!checkedDay) {
      throw new Error(`arena-predlog.json: checkedThrough ${predlog.checkedThrough} has no explicit daily audit`);
    }
    if (checkedDay.audit?.status === 'partial' || predlog.days.some((day) => (
      day.date <= predlog.checkedThrough && day.audit?.status === 'partial'
    ))) {
      throw new Error(`arena-predlog.json: checkedThrough ${predlog.checkedThrough} crosses a partial score`);
    }
    const latestAuditDate = predlog.days.reduce((latest, day) => (
      day.audit?.status && day.date > latest ? day.date : latest
    ), '');
    if (latestAuditDate !== digest.date) {
      throw new Error(`arena-predlog.json: latest explicit audit ${latestAuditDate} must match digest ${digest.date}`);
    }
    const dishonestLateT = runlog.runs.find((run) => (
      run.window === 'post-market'
      && run.model === 'T'
      && run.status === 'done'
      && run.late === true
    ));
    if (dishonestLateT) {
      throw new Error(`arena-runlog.json: late T valuation cannot rewrite missed proposal window ${dishonestLateT.date} as done`);
    }
    const reviewer = runlog.runs.find((run) => (
      run.date === digest.date
      && run.window === 'post-market'
      && run.model === 'reviewer'
    ));
    if (reviewer?.status !== 'done') {
      throw new Error(`arena-runlog.json: reviewer is not done for ${digest.date}`);
    }
  }
  return prepared;
}

try {
  const result = runAtomicPublishTransaction({
    repoRoot: process.cwd(),
    pipelineId: pipeline.id,
    prepare: prepareValidatedGroup,
    commitMessage,
    deriveCommand: SITE_GENERATE_COMMAND,
    derivedPaths: SITE_PUBLISH_ARTIFACTS,
    verificationCommands: [
      { phase: 'data-check', command: ['npm', 'run', 'data:check'] },
      {
        phase: 'freshness-strict',
        command: [
          'npm',
          'run',
          'data:freshness:strict',
          '--',
          `--pipeline=${pipeline.id}`,
          `--now=${now.toISOString()}`,
        ],
      },
      { phase: 'test', command: ['npm', 'test'] },
      { phase: 'build', command: ['npm', 'run', 'build'] },
    ],
    preCommitCommands: arenaPreCommitCommands(pipeline.id),
  });
  console.log(
    `[publish-data-pipeline] ${result.status} ${pipeline.id}: ${pipeline.outputs.map((item) => item.resource).join(', ')}`
      + (result.commit ? ` (${result.commit})` : ''),
  );
} catch (error) {
  fail(`${error.phase || 'publish'}: ${error.message}`);
}
