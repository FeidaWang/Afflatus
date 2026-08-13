import { afterEach, describe, expect, it } from 'vitest';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildArenaWindowCandidates,
  planArenaWindowModel,
  recordMissedArenaWindow,
  selectArenaWindowProposalIntents,
} from '../src/lib/arenaWindowCandidates.js';

const DATE = '2026-08-12';
const OPEN_NOW = '2026-08-12T14:10:00.000Z';
const LATE_NOW = '2026-08-12T19:35:00.000Z';
const temporaryRoots = [];

function premarketWitnesses() {
  return [
    { date: DATE, window: 'pre-market-gather', model: 'gatherer', status: 'done' },
    { date: DATE, window: 'picks-publish', model: 'gatherer', status: 'done' },
  ];
}

function pick(model, id, overrides = {}) {
  return {
    proposalId: id,
    sessionDate: DATE,
    decidedAt: '2026-08-12T12:45:00.000Z',
    expiresAt: '2026-08-12T19:45:00.000Z',
    allowedExecutionWindows: ['open-window', 'late-window'],
    sym: model === 'S' ? 'NVDA' : 'AMD',
    ...overrides,
  };
}

function picks(overrides = {}) {
  return {
    date: DATE,
    decisionStatus: 'sealed',
    executable: true,
    models: {
      S: [pick('S', 'S-both')],
      P: [pick('P', 'P-both')],
      T: [],
    },
    ...overrides,
  };
}

function ledger(trades = {}) {
  return {
    updated: '2026-08-11',
    models: {
      S: { trades: trades.S || [] },
      P: { trades: trades.P || [] },
      T: { trades: trades.T || [] },
    },
  };
}

function runlog(extra = []) {
  return { runs: [...premarketWitnesses(), ...extra] };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Arena open/late candidate planning', () => {
  it('selects only same-session, unconsumed proposals authorized for the real window', () => {
    const snapshot = picks({
      models: {
        S: [
          pick('S', 'eligible'),
          pick('S', 'late-only', { allowedExecutionWindows: ['late-window'] }),
          pick('S', 'expired', { expiresAt: '2026-08-12T14:00:00.000Z' }),
          pick('S', 'other-day', { sessionDate: '2026-08-11' }),
          pick('S', 'consumed'),
        ],
        P: [],
        T: [],
      },
    });
    expect(selectArenaWindowProposalIntents({
      picks: snapshot,
      ledger: ledger({ S: [{ proposalId: 'consumed' }] }),
      runlog: runlog(),
      model: 'S',
      window: 'open',
      sessionDate: DATE,
      nowIso: OPEN_NOW,
    })).toEqual([{ proposalId: 'eligible' }]);
  });

  it('allows a threshold-skipped open proposal to retry late, but never a filled proposal', () => {
    const attemptedOpen = {
      date: DATE,
      window: 'open-window',
      model: 'S',
      status: 'done',
      ordersProposed: 1,
      ordersFilled: 0,
      proposalIds: ['S-both'],
      skippedProposals: [{ proposalId: 'S-both', reason: 'entry threshold' }],
    };
    const common = {
      picks: picks(),
      runlog: runlog([attemptedOpen]),
      model: 'S',
      window: 'late',
      sessionDate: DATE,
      nowIso: LATE_NOW,
    };
    expect(selectArenaWindowProposalIntents({ ...common, ledger: ledger() }))
      .toEqual([{ proposalId: 'S-both' }]);
    expect(selectArenaWindowProposalIntents({
      ...common,
      ledger: ledger({ S: [{ proposalId: 'S-both' }] }),
    })).toEqual([]);
  });

  it('uses honest missed status for stale/non-executable snapshots or missing premarket witnesses', () => {
    const common = {
      ledger: ledger(),
      model: 'S',
      window: 'open',
      sessionDate: DATE,
      nowIso: OPEN_NOW,
    };
    expect(planArenaWindowModel({
      ...common,
      picks: picks({ date: '2026-08-11' }),
      runlog: runlog(),
    }).action).toBe('miss');
    expect(planArenaWindowModel({
      ...common,
      picks: picks({ decisionStatus: 'missed', executable: false, models: { S: [], P: [], T: [] } }),
      runlog: runlog(),
    }).action).toBe('miss');
    expect(planArenaWindowModel({
      ...common,
      picks: picks(),
      runlog: { runs: [] },
    }).action).toBe('miss');
  });

  it('treats a sealed empty model decision as a truthful zero-order settlement', () => {
    const plan = planArenaWindowModel({
      picks: picks({ models: { S: [], P: [], T: [] } }),
      ledger: ledger(),
      runlog: runlog(),
      model: 'S',
      window: 'open',
      sessionDate: DATE,
      nowIso: OPEN_NOW,
    });
    expect(plan).toMatchObject({ action: 'settle', proposedOrders: [] });
  });

  it('preserves terminal identities and transitions queued evidence to an audited missed entry', () => {
    const terminal = {
      date: DATE, window: 'open-window', model: 'S', status: 'done', ordersProposed: 0, ordersFilled: 0,
    };
    expect(planArenaWindowModel({
      picks: picks(), ledger: ledger(), runlog: runlog([terminal]), model: 'S',
      window: 'open', sessionDate: DATE, nowIso: OPEN_NOW,
    })).toMatchObject({ action: 'preserve', existingStatus: 'done' });

    const queued = {
      date: DATE,
      window: 'open-window',
      model: 'S',
      status: 'queued',
      ordersProposed: 1,
      proposalIds: ['untrusted-old-id'],
      note: 'queued before decision verification',
    };
    const next = recordMissedArenaWindow(runlog([queued]), {
      model: 'S',
      window: 'open-window',
      sessionDate: DATE,
      nowIso: OPEN_NOW,
      reason: 'No sealed snapshot exists.',
    });
    expect(next.runs.at(-1)).toMatchObject({
      status: 'missed',
      decisionMissed: true,
      ordersProposed: 0,
      ordersFilled: 0,
      queuedAudit: { ordersProposed: 1, proposalIds: ['untrusted-old-id'] },
    });
  });

  it('settles S then P against one accumulated ledger/runlog candidate', async () => {
    const callOrder = [];
    const group = await buildArenaWindowCandidates({
      baselineLedger: ledger(),
      baselineRunlog: runlog(),
      picks: picks(),
      window: 'open',
      sessionDate: DATE,
      now: () => new Date(OPEN_NOW),
      settle: async ({ ledger: currentLedger, runlog: currentRunlog, input }) => {
        callOrder.push(input.book);
        if (input.book === 'P') {
          expect(currentLedger.models.S.settled).toBe(true);
          expect(currentRunlog.runs).toContainEqual(expect.objectContaining({ model: 'S', status: 'done' }));
        }
        return {
          ledger: {
            ...currentLedger,
            updated: DATE,
            models: {
              ...currentLedger.models,
              [input.book]: { ...currentLedger.models[input.book], settled: true },
            },
          },
          runlog: {
            ...currentRunlog,
            runs: [...currentRunlog.runs, {
              date: DATE,
              window: input.window,
              model: input.book,
              status: 'done',
              ordersProposed: input.proposedOrders.length,
              ordersFilled: 0,
            }],
          },
        };
      },
    });
    expect(callOrder).toEqual(['S', 'P']);
    expect(group.noOp).toBe(false);
    expect(group.ledger.updated).toBe(DATE);
    expect(group.results.map((result) => result.action)).toEqual(['settle', 'settle']);
  });

  it('builds a complete zero-trade missed group through witnessed valuation settlement', async () => {
    const callOrder = [];
    const group = await buildArenaWindowCandidates({
      baselineLedger: ledger(),
      baselineRunlog: runlog(),
      picks: picks({ date: '2026-08-11' }),
      window: 'late',
      sessionDate: DATE,
      now: () => new Date(LATE_NOW),
      settle: async ({ ledger: currentLedger, runlog: currentRunlog, input }) => {
        callOrder.push(input.book);
        expect(input).toMatchObject({ valuationOnly: true, decisionMissed: true, proposedOrders: [] });
        return {
          ledger: { ...currentLedger, updated: DATE },
          runlog: recordMissedArenaWindow(currentRunlog, {
            model: input.book,
            window: input.window,
            sessionDate: DATE,
            nowIso: LATE_NOW,
            reason: input.note,
          }),
        };
      },
    });
    expect(group.results.map((result) => result.action)).toEqual(['miss', 'miss']);
    expect(callOrder).toEqual(['S', 'P']);
    expect(group.runlog.runs.slice(-2)).toEqual([
      expect.objectContaining({ model: 'S', window: 'late-window', status: 'missed', decisionMissed: true }),
      expect.objectContaining({ model: 'P', window: 'late-window', status: 'missed', decisionMissed: true }),
    ]);
    expect(group.ledger.updated).toBe(DATE);
    expect(group.ledger.models).toEqual(ledger().models);
  });
});

describe('Arena window candidate CLI', () => {
  it('rejects a caller-controlled clock', () => {
    const result = spawnSync(process.execPath, [
      'scripts/build-arena-window-candidates.mjs',
      '--window=open',
      '--output=/tmp/afflatus-window-candidate-test',
      `--now=${OPEN_NOW}`,
    ], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unknown option --now/);
  });

  it('writes only a complete candidate group and leaves public data untouched for an honest missed decision', () => {
    const root = mkdtempSync(join(tmpdir(), 'afflatus-window-candidates-test-'));
    temporaryRoots.push(root);
    const fixture = join(root, 'repo');
    const output = join(root, 'candidate');
    const clock = join(root, 'fake-clock.mjs');
    const sourceFiles = [
      'scripts/build-arena-window-candidates.mjs',
      'scripts/apply-arena-run.mjs',
      'src/lib/arenaWindowCandidates.js',
      'src/lib/arenaWindowGate.js',
      'src/lib/marketSession.js',
      'src/lib/arenaDecisionProvenance.js',
      'src/lib/arenaExecution.js',
      'src/lib/validateArenaLedger.js',
      'src/lib/validateArenaPicks.js',
      'src/lib/validateArenaRunlog.js',
      'src/lib/arenaSettlementPublicationContract.js',
      'src/lib/arenaRules.js',
      'src/lib/arenaExec.js',
      'src/lib/predlogEntry.js',
      'src/lib/arenaRun.js',
      'src/lib/arenaReconcile.js',
      'public/arena-universe.json',
    ];
    for (const source of sourceFiles) {
      const destination = join(fixture, source);
      mkdirSync(join(destination, '..'), { recursive: true });
      copyFileSync(source, destination);
    }
    mkdirSync(join(fixture, 'public'), { recursive: true });
    writeFileSync(join(fixture, 'package.json'), '{"type":"module"}\n');
    const emptyLedger = JSON.parse(readFileSync('public/arena-ledger.json', 'utf8'));
    for (const model of ['S', 'P', 'T']) {
      emptyLedger.models[model].positions = [];
      emptyLedger.models[model].equity = emptyLedger.models[model].cash;
    }
    writeFileSync(join(fixture, 'public/arena-ledger.json'), `${JSON.stringify(emptyLedger, null, 2)}\n`);
    copyFileSync('public/arena-picks.json', join(fixture, 'public/arena-picks.json'));
    const cleanRunlog = JSON.parse(readFileSync('public/arena-runlog.json', 'utf8'));
    cleanRunlog.runs = cleanRunlog.runs.filter((run) => run.status !== 'queued');
    writeFileSync(join(fixture, 'public/arena-runlog.json'), `${JSON.stringify(cleanRunlog, null, 2)}\n`);
    writeFileSync(clock, `
      const RealDate = globalThis.Date;
      const fixed = ${JSON.stringify(OPEN_NOW)};
      globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return RealDate.parse(fixed); }
        static parse(value) { return RealDate.parse(value); }
        static UTC(...args) { return RealDate.UTC(...args); }
      };
    `);
    const beforeLedger = readFileSync(join(fixture, 'public/arena-ledger.json'));
    const beforeRunlog = readFileSync(join(fixture, 'public/arena-runlog.json'));
    const result = spawnSync(process.execPath, [
      join(fixture, 'scripts/build-arena-window-candidates.mjs'),
      '--window=open',
      `--output=${output}`,
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${clock}`].filter(Boolean).join(' '),
      },
      cwd: fixture,
    });
    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      candidateOnly: true,
      pipelineId: 'arena-open',
      sessionDate: DATE,
      results: [
        { model: 'S', action: 'miss', proposals: 0 },
        { model: 'P', action: 'miss', proposals: 0 },
      ],
    });
    const candidateLedger = JSON.parse(readFileSync(join(output, 'arena-ledger.json'), 'utf8'));
    const candidateRunlog = JSON.parse(readFileSync(join(output, 'arena-runlog.json'), 'utf8'));
    expect(candidateLedger.updated).toBe(DATE);
    expect(candidateRunlog.runs.slice(-2)).toEqual([
      expect.objectContaining({ model: 'S', status: 'missed', decisionMissed: true }),
      expect.objectContaining({ model: 'P', status: 'missed', decisionMissed: true }),
    ]);
    expect(readFileSync(join(fixture, 'public/arena-ledger.json'))).toEqual(beforeLedger);
    expect(readFileSync(join(fixture, 'public/arena-runlog.json'))).toEqual(beforeRunlog);
  });
});
