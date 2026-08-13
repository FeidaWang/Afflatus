#!/usr/bin/env node
/* Build a complete candidate-only arena-open or arena-late group.
 *
 * Usage:
 *   node scripts/build-arena-window-candidates.mjs --window=open|late --output=<outside-repo-dir>
 *
 * The command never publishes, commits, or pushes. It plans and settles S,
 * then P, against one accumulated temporary ledger/runlog pair. The existing
 * apply-arena-run CLI owns live quote fetching, receipt persistence and its
 * second real-clock gate. Missing/stale/non-executable pre-market decisions
 * produce immutable missed runlog entries and no trade.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildArenaWindowCandidates } from '../src/lib/arenaWindowCandidates.js';
import { assessArenaWindow } from '../src/lib/arenaWindowGate.js';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaPicks } from '../src/lib/validateArenaPicks.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { validateArenaSettlementPublication } from '../src/lib/arenaSettlementPublicationContract.js';

const ROOT = resolve(import.meta.dirname, '..');
const LEDGER_FILE = 'arena-ledger.json';
const RUNLOG_FILE = 'arena-runlog.json';
const PUBLIC_LEDGER = resolve(ROOT, 'public', LEDGER_FILE);
const PUBLIC_RUNLOG = resolve(ROOT, 'public', RUNLOG_FILE);
const PUBLIC_PICKS = resolve(ROOT, 'public', 'arena-picks.json');
const PUBLIC_UNIVERSE = resolve(ROOT, 'public', 'arena-universe.json');

function fail(message) {
  console.error(`[arena-window-candidates] ERROR: ${message}`);
  process.exit(1);
}

function parseOptions(args) {
  const values = {};
  for (const argument of args) {
    if (argument.startsWith('--window=')) values.window = argument.slice('--window='.length);
    else if (argument.startsWith('--output=')) values.output = argument.slice('--output='.length);
    else if (argument.startsWith('--')) throw new Error(`unknown option ${argument}`);
    else throw new Error(`unexpected positional argument ${argument}`);
  }
  return values;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function runApply(inputPath, stagingDirectory) {
  const result = spawnSync(process.execPath, [
    resolve(ROOT, 'scripts', 'apply-arena-run.mjs'),
    inputPath,
    `--output=${stagingDirectory}`,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`apply-arena-run.mjs failed${detail ? `: ${detail}` : ''}`);
  }
}

let options;
try { options = parseOptions(process.argv.slice(2)); } catch (error) { fail(error.message); }
if (!['open', 'late'].includes(options.window) || !options.output) {
  fail('usage: build-arena-window-candidates.mjs --window=open|late --output=<outside-repo-dir>');
}
const outputDirectory = resolve(options.output);
if (!relative(ROOT, outputDirectory).startsWith('..')) fail('--output must be outside the repository');
if (existsSync(outputDirectory) && readdirSync(outputDirectory).length > 0) fail('--output must be absent or empty');

const initialNow = new Date();
const initialGate = assessArenaWindow(options.window, initialNow);
if (!initialGate.session || !initialGate.due) {
  fail(`real New York ${options.window} window is not due (${initialGate.reason})`);
}
const sessionDate = initialGate.date;
const pipelineId = options.window === 'open' ? 'arena-open' : 'arena-late';
const baselineLedger = readJson(PUBLIC_LEDGER);
const baselineRunlog = readJson(PUBLIC_RUNLOG);
const picks = readJson(PUBLIC_PICKS);
const universe = (readJson(PUBLIC_UNIVERSE).symbols || []).map((entry) => entry.sym);
const picksValidation = validateArenaPicks(picks);
if (!picksValidation.ok) fail(`arena-picks.json: ${picksValidation.errors.join('; ')}`);

const staging = mkdtempSync(resolve(tmpdir(), 'afflatus-arena-window-candidates-'));
const inputs = mkdtempSync(resolve(tmpdir(), 'afflatus-arena-window-inputs-'));
let orchestrationError = null;
try {
  const group = await buildArenaWindowCandidates({
    baselineLedger,
    baselineRunlog,
    picks,
    window: options.window,
    sessionDate,
    now: () => new Date(),
    settle: async ({ ledger, runlog, input }) => {
      writeJson(resolve(staging, LEDGER_FILE), ledger);
      writeJson(resolve(staging, RUNLOG_FILE), runlog);
      const inputPath = resolve(inputs, `${input.book}-${options.window}.json`);
      writeJson(inputPath, input);
      runApply(inputPath, staging);
      return {
        ledger: readJson(resolve(staging, LEDGER_FILE)),
        runlog: readJson(resolve(staging, RUNLOG_FILE)),
      };
    },
  });

  const finalNow = new Date();
  const finalGate = assessArenaWindow(options.window, finalNow);
  if (!finalGate.due || finalGate.date !== sessionDate) {
    throw new Error(`${options.window} window closed before complete group validation (${finalGate.reason})`);
  }
  if (group.noOp) {
    console.log(JSON.stringify({
      candidateOnly: true,
      noOp: true,
      pipelineId,
      sessionDate,
      reason: 'S and P already have terminal runlog identities for this window',
    }, null, 2));
  } else {
    const validations = [
      [LEDGER_FILE, validateArenaLedger(group.ledger)],
      [RUNLOG_FILE, validateArenaRunlog(group.runlog)],
      ['Arena settlement delta', validateArenaSettlementPublication({
        baselineLedger,
        baselineRunlog,
        candidateLedger: group.ledger,
        candidateRunlog: group.runlog,
        publishedPicks: picks,
        universe,
        pipelineId,
        now: finalNow,
      })],
    ];
    for (const [label, validation] of validations) {
      if (!validation.ok) throw new Error(`${label}: ${validation.errors.join('; ')}`);
    }
    mkdirSync(outputDirectory, { recursive: true });
    writeJson(resolve(outputDirectory, LEDGER_FILE), group.ledger);
    writeJson(resolve(outputDirectory, RUNLOG_FILE), group.runlog);
    console.log(JSON.stringify({
      candidateOnly: true,
      noOp: false,
      pipelineId,
      sessionDate,
      results: group.results.map((result) => ({
        model: result.model,
        action: result.action,
        proposals: result.proposedOrders?.length || 0,
        ...(result.existingStatus ? { existingStatus: result.existingStatus } : {}),
      })),
      outputs: [
        resolve(outputDirectory, LEDGER_FILE),
        resolve(outputDirectory, RUNLOG_FILE),
      ],
    }, null, 2));
  }
} catch (error) {
  orchestrationError = error;
} finally {
  rmSync(staging, { recursive: true, force: true });
  rmSync(inputs, { recursive: true, force: true });
}
if (orchestrationError) fail(orchestrationError.message);
