import { afterEach, describe, expect, it } from 'vitest';
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryRoots = [];

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function calendarDates(start, count) {
  const dates = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  while (dates.length < count) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

const GROUP_FILES = [
  'arena-ledger.json',
  'arena-runlog.json',
  'arena-daily-digest.json',
  'arena-predlog.json',
];

function runCatchUpFixture(fixtureRoot, tempRoot, candidateDirectory, {
  through = '2026-08-10',
  explicitThrough = true,
  now = '2026-08-11T22:00:00.000Z',
  historyRowsBySymbol,
  onRequest = '',
} = {}) {
  const fetchMock = join(tempRoot, `mock-fetch-${Math.random().toString(16).slice(2)}.mjs`);
  writeFileSync(fetchMock, `
    const rowsBySymbol = ${JSON.stringify(historyRowsBySymbol)};
    const RealDate = globalThis.Date;
    const fixedNowMs = RealDate.parse(${JSON.stringify(now)});
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixedNowMs])); }
      static now() { return fixedNowMs; }
    };
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      const symbol = url.searchParams.get('symbol');
      const outputsize = Number(url.searchParams.get('outputsize'));
      ${onRequest}
      const rows = rowsBySymbol[symbol];
      if (!rows) return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (name) => name.toLowerCase() === 'x-request-id' ? 'test-history-' + symbol : null },
        json: async () => ({ status: 'ok', values: rows.slice(-outputsize) }),
      };
    };
  `);
  const nodeOptions = [process.env.NODE_OPTIONS, `--import=${fetchMock}`].filter(Boolean).join(' ');
  const args = [
    join(fixtureRoot, 'scripts/catch-up-arena.mjs'),
    `--output=${candidateDirectory}`,
  ];
  if (explicitThrough) args.splice(1, 0, `--through=${through}`);
  return spawnSync(process.execPath, args, {
    cwd: fixtureRoot,
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    encoding: 'utf8',
  });
}

function makeFixtureRepository(tempRoot) {
  const root = join(tempRoot, 'repo');
  const sourceFiles = [
    'scripts/catch-up-arena.mjs',
    'scripts/lib/publish-transaction.mjs',
    'scripts/lib/site-publish-artifacts.mjs',
    'src/config/siteManifest.js',
    'src/lib/arenaExec.js',
    'src/lib/arenaExecution.js',
    'src/lib/arenaEarningsDigest.js',
    'src/lib/arenaRun.js',
    'src/lib/arenaRules.js',
    'src/lib/arenaReconcile.js',
    'src/lib/arenaWindowGate.js',
    'src/lib/marketFreshness.js',
    'src/lib/marketSession.js',
    'src/lib/validateArenaDigest.js',
    'src/lib/validateArenaLedger.js',
    'src/lib/validateArenaPredlog.js',
    'src/lib/validateArenaRunlog.js',
  ];
  for (const source of sourceFiles) {
    const destination = join(root, source);
    mkdirSync(join(destination, '..'), { recursive: true });
    copyFileSync(source, destination);
  }
  mkdirSync(join(root, 'public'), { recursive: true });
  writeJson(join(root, 'package.json'), { type: 'module' });

  const ledger = JSON.parse(readFileSync('public/arena-ledger.json', 'utf8'));
  ledger.updated = '2026-08-07';
  ledger.lastRunDate = '2026-08-07';
  for (const model of Object.values(ledger.models)) {
    model.positions = [];
    model.equity = model.cash;
    model.dayStartEquity = model.cash;
  }
  writeJson(join(root, 'public/arena-ledger.json'), ledger);

  const runlog = JSON.parse(readFileSync('public/arena-runlog.json', 'utf8'));
  runlog.runs = runlog.runs.filter((run) => run.date <= '2026-08-07');
  const queued = {
    date: '2026-07-23',
    window: 'post-market',
    model: 'T',
    status: 'queued',
    ordersProposed: 1,
    ordersFilled: 0,
    note: 'Pre-close proposal recorded but not executed.',
  };
  const queuedIndex = runlog.runs.findIndex((run) => (
    run.date === queued.date && run.window === queued.window && run.model === queued.model
  ));
  if (queuedIndex >= 0) runlog.runs[queuedIndex] = queued;
  else runlog.runs.push(queued);
  for (const recoveredRun of [
    {
      date: '2026-07-27', window: 'post-market', model: 'T', status: 'done',
      ordersProposed: 0, ordersFilled: 0, note: 'legacy late valuation', late: true,
    },
    {
      date: '2026-07-27', window: 'post-market', model: 'reviewer', status: 'missed',
      ordersProposed: 0, ordersFilled: 0, note: 'legacy reviewer state',
    },
  ]) {
    const index = runlog.runs.findIndex((run) => (
      run.date === recoveredRun.date
      && run.window === recoveredRun.window
      && run.model === recoveredRun.model
    ));
    if (index >= 0) runlog.runs[index] = recoveredRun;
    else runlog.runs.push(recoveredRun);
  }
  writeJson(join(root, 'public/arena-runlog.json'), runlog);

  const predlog = JSON.parse(readFileSync('public/arena-predlog.json', 'utf8'));
  predlog.updated = '2026-08-08T00:00:00.000Z';
  predlog.checkedThrough = '2026-08-07';
  predlog.days = predlog.days.filter((day) => day.date <= '2026-08-07');
  writeJson(join(root, 'public/arena-predlog.json'), predlog);

  const news = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
  writeJson(join(root, 'public/arena-news.json'), { ...news, date: '2026-08-07', aiPredictions: {} });
  const picks = JSON.parse(readFileSync('public/arena-picks.json', 'utf8'));
  writeJson(join(root, 'public/arena-picks.json'), { ...picks, date: '2026-08-07' });
  for (const path of [
    'public/arena-daily-digest.json',
    'public/arena-universe.json',
    'public/nyse-holidays-2026.json',
  ]) {
    copyFileSync(path, join(root, path));
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Arena catch-up candidate generation', () => {
  it('writes a complete postmarket candidate without changing tracked data or rewriting missed decisions', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'afflatus-catch-up-test-'));
    temporaryRoots.push(tempRoot);
    const fixtureRoot = makeFixtureRepository(tempRoot);
    const candidateDirectory = join(tempRoot, 'candidate');
    const trackedPaths = [
      'public/arena-ledger.json',
      'public/arena-runlog.json',
      'public/arena-daily-digest.json',
      'public/arena-predlog.json',
    ];
    const before = new Map(trackedPaths.map((path) => [path, readFileSync(join(fixtureRoot, path))]));
    const result = runCatchUpFixture(fixtureRoot, tempRoot, candidateDirectory, {
      historyRowsBySymbol: {
        SPY: [
          { datetime: '2026-07-23', close: 600 },
          { datetime: '2026-08-10', close: 610 },
        ],
        SMH: [
          { datetime: '2026-07-23', close: 300 },
          { datetime: '2026-08-10', close: 310 },
        ],
      },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(candidateDirectory).sort()).toEqual([
      'arena-daily-digest.json',
      'arena-ledger.json',
      'arena-predlog.json',
      'arena-runlog.json',
    ]);
    for (const [path, bytes] of before) expect(readFileSync(join(fixtureRoot, path))).toEqual(bytes);

    const runlog = JSON.parse(readFileSync(join(candidateDirectory, 'arena-runlog.json'), 'utf8'));
    const tPost = runlog.runs.find((run) => (
      run.date === '2026-08-10' && run.window === 'post-market' && run.model === 'T'
    ));
    expect(tPost).toMatchObject({
      status: 'missed',
      ordersFilled: 0,
      late: true,
      valuationRecovered: true,
      valuationOrdersFilled: 0,
    });
    expect(runlog.runs.find((run) => (
      run.date === '2026-08-10' && run.window === 'post-market' && run.model === 'reviewer'
    ))).toMatchObject({ status: 'done', late: true });
    expect(runlog.runs.find((run) => (
      run.date === '2026-07-23' && run.window === 'post-market' && run.model === 'T'
    ))).toMatchObject({ status: 'missed', ordersProposed: 1, ordersFilled: 0 });
    expect(runlog.runs.find((run) => (
      run.date === '2026-07-27' && run.window === 'post-market' && run.model === 'T'
    ))).toMatchObject({ status: 'missed', late: true, valuationRecovered: true });
    expect(runlog.runs.find((run) => (
      run.date === '2026-07-27' && run.window === 'post-market' && run.model === 'reviewer'
    ))).toMatchObject({ status: 'done', late: true });

    const predlog = JSON.parse(readFileSync(join(candidateDirectory, 'arena-predlog.json'), 'utf8'));
    // 2026-07-15 contains only partially scored predictions. The explicit
    // audit continues through settlement, but checkedThrough stays at the
    // final fully classified session before that partial day.
    expect(predlog.checkedThrough).toBe('2026-07-14');
    expect(predlog.days.find((day) => day.date === '2026-08-10')).toMatchObject({
      entries: {},
      audit: { status: 'missed-source' },
    });
    expect(predlog.days.find((day) => day.date === '2026-08-07')).toMatchObject({
      entries: {},
      audit: { status: 'no-predictions' },
    });
    expect(predlog.days.find((day) => day.date === '2026-07-15')).toMatchObject({
      audit: { status: 'partial' },
    });
    expect(predlog.days.every((day) => day.audit?.status)).toBe(true);
  });

  it('requests enough benchmark history to retain a season baseline older than 30 sessions', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'afflatus-catch-up-long-season-'));
    temporaryRoots.push(tempRoot);
    const fixtureRoot = makeFixtureRepository(tempRoot);
    const candidateDirectory = join(tempRoot, 'candidate');
    const dates = calendarDates('2026-05-04', 46);
    const holidays = new Set(JSON.parse(readFileSync('public/nyse-holidays-2026.json', 'utf8'))
      .holidays.map((holiday) => holiday.date));
    const sessionCount = dates.filter((date) => !holidays.has(date)).length;
    const start = dates[0];
    const through = dates.at(-1);
    const ledger = JSON.parse(readFileSync(join(fixtureRoot, 'public/arena-ledger.json'), 'utf8'));
    ledger.lastRunDate = dates.at(-2);
    ledger.updated = dates.at(-2);
    ledger.day = 45;
    for (const model of Object.values(ledger.models)) {
      model.lastValuationDate = dates.at(-2);
      model.equityHistory = [{ day: 0, equity: model.startEquity }, { day: 45, equity: model.equity }];
    }
    writeJson(join(fixtureRoot, 'public/arena-ledger.json'), ledger);
    const runlog = JSON.parse(readFileSync(join(fixtureRoot, 'public/arena-runlog.json'), 'utf8'));
    runlog.runs = [
      { date: start, window: 'open-window', model: 'S', status: 'done', ordersProposed: 0, ordersFilled: 0, note: 'season start' },
      { date: dates.at(-2), window: 'late-window', model: 'S', status: 'done', ordersProposed: 0, ordersFilled: 0, note: 'latest valuation' },
      { date: dates.at(-2), window: 'late-window', model: 'P', status: 'done', ordersProposed: 0, ordersFilled: 0, note: 'latest valuation' },
      { date: dates.at(-2), window: 'post-market', model: 'T', status: 'done', ordersProposed: 0, ordersFilled: 0, note: 'latest valuation' },
    ];
    writeJson(join(fixtureRoot, 'public/arena-runlog.json'), runlog);
    const rows = dates.map((date, index) => ({ datetime: date, close: 100 + index }));

    const laterNow = new Date(`${through}T22:00:00.000Z`);
    laterNow.setUTCDate(laterNow.getUTCDate() + 3);
    const result = runCatchUpFixture(fixtureRoot, tempRoot, candidateDirectory, {
      through,
      now: laterNow.toISOString(),
      historyRowsBySymbol: { SPY: rows, SMH: rows },
      onRequest: `if (outputsize < ${sessionCount + 10}) throw new Error('history outputsize was too small: ' + outputsize);`,
    });

    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.historyOutputsize).toBe(sessionCount + 10);
    expect(report.recoveredSessions).toEqual([through]);
  });

  it('repairs books skipped on a partially completed shared-ledger day', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'afflatus-catch-up-partial-day-'));
    temporaryRoots.push(tempRoot);
    const fixtureRoot = makeFixtureRepository(tempRoot);
    const candidateDirectory = join(tempRoot, 'candidate');
    const ledger = JSON.parse(readFileSync(join(fixtureRoot, 'public/arena-ledger.json'), 'utf8'));
    ledger.lastRunDate = '2026-08-10';
    ledger.updated = '2026-08-10';
    ledger.day = 13;
    ledger.models.S.lastValuationDate = '2026-08-10';
    ledger.models.S.equityHistory.push({ day: 13, equity: ledger.models.S.equity });
    for (const model of ['P', 'T']) {
      ledger.models[model].lastValuationDate = '2026-08-07';
      ledger.models[model].equityHistory = ledger.models[model].equityHistory.filter((point) => point.day <= 12);
    }
    writeJson(join(fixtureRoot, 'public/arena-ledger.json'), ledger);
    const runlog = JSON.parse(readFileSync(join(fixtureRoot, 'public/arena-runlog.json'), 'utf8'));
    runlog.runs = runlog.runs.filter((run) => run.date <= '2026-08-07');
    runlog.runs.push({
      date: '2026-08-10', window: 'open-window', model: 'S', status: 'done',
      ordersProposed: 0, ordersFilled: 0, note: 'Only S completed before interruption.',
    });
    writeJson(join(fixtureRoot, 'public/arena-runlog.json'), runlog);

    const result = runCatchUpFixture(fixtureRoot, tempRoot, candidateDirectory, {
      historyRowsBySymbol: {
        SPY: [
          { datetime: '2026-07-23', close: 600 },
          { datetime: '2026-08-10', close: 610 },
        ],
        SMH: [
          { datetime: '2026-07-23', close: 300 },
          { datetime: '2026-08-10', close: 310 },
        ],
      },
    });

    expect(result.status, result.stderr).toBe(0);
    const nextLedger = JSON.parse(readFileSync(join(candidateDirectory, 'arena-ledger.json'), 'utf8'));
    expect(nextLedger.models.S.lastValuationDate).toBe('2026-08-10');
    expect(nextLedger.models.P.lastValuationDate).toBe('2026-08-10');
    expect(nextLedger.models.T.lastValuationDate).toBe('2026-08-10');
    expect(nextLedger.models.S.equityHistory.filter((point) => point.day === 13)).toHaveLength(1);
    expect(nextLedger.models.P.equityHistory.filter((point) => point.day === 13)).toHaveLength(1);
    expect(nextLedger.models.T.equityHistory.filter((point) => point.day === 13)).toHaveLength(1);

    const nextRunlog = JSON.parse(readFileSync(join(candidateDirectory, 'arena-runlog.json'), 'utf8'));
    expect(nextRunlog.runs.find((run) => (
      run.date === '2026-08-10' && run.window === 'open-window' && run.model === 'S'
    ))).toMatchObject({ status: 'done' });
    expect(nextRunlog.runs.find((run) => (
      run.date === '2026-08-10' && run.window === 'open-window' && run.model === 'P'
    ))).toMatchObject({ status: 'missed' });
    expect(nextRunlog.runs.find((run) => (
      run.date === '2026-08-10' && run.window === 'post-market' && run.model === 'T'
    ))).toMatchObject({ status: 'missed', valuationRecovered: true });
  });

  it('leaves the current settlement session untouched while its real post-market window is due', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'afflatus-catch-up-current-session-'));
    temporaryRoots.push(tempRoot);
    const fixtureRoot = makeFixtureRepository(tempRoot);
    const candidateDirectory = join(tempRoot, 'candidate');
    const result = runCatchUpFixture(fixtureRoot, tempRoot, candidateDirectory, {
      explicitThrough: false,
      now: '2026-08-10T20:35:00.000Z',
      historyRowsBySymbol: {
        SPY: [
          { datetime: '2026-07-23', close: 600 },
          { datetime: '2026-08-07', close: 605 },
        ],
        SMH: [
          { datetime: '2026-07-23', close: 300 },
          { datetime: '2026-08-07', close: 305 },
        ],
      },
    });

    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.currentSettlementDate).toBe('2026-08-10');
    expect(report.targetThroughDate).toBe('2026-08-07');
    const nextRunlog = JSON.parse(readFileSync(join(candidateDirectory, 'arena-runlog.json'), 'utf8'));
    expect(nextRunlog.runs.some((run) => run.date === '2026-08-10')).toBe(false);
  });

  it('uses the most recently completed session before and after the real post-market window', () => {
    for (const [label, now] of [
      ['before', '2026-08-10T19:55:00.000Z'],
      ['after', '2026-08-10T21:16:00.000Z'],
    ]) {
      const tempRoot = mkdtempSync(join(tmpdir(), `afflatus-catch-up-${label}-window-`));
      temporaryRoots.push(tempRoot);
      const fixtureRoot = makeFixtureRepository(tempRoot);
      const candidateDirectory = join(tempRoot, 'candidate');
      const result = runCatchUpFixture(fixtureRoot, tempRoot, candidateDirectory, {
        explicitThrough: false,
        now,
        historyRowsBySymbol: {
          SPY: [
            { datetime: '2026-07-23', close: 600 },
            { datetime: '2026-08-07', close: 605 },
            { datetime: '2026-08-10', close: 610 },
          ],
          SMH: [
            { datetime: '2026-07-23', close: 300 },
            { datetime: '2026-08-07', close: 305 },
            { datetime: '2026-08-10', close: 310 },
          ],
        },
      });
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.postmarketDue).toBe(false);
      expect(report.targetThroughDate).toBe(label === 'before' ? '2026-08-07' : '2026-08-10');
    }
  });

  it('preserves prior-session bytes when a current-day ledger has complete bounded evidence', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'afflatus-catch-up-ahead-complete-'));
    temporaryRoots.push(tempRoot);
    const fixtureRoot = makeFixtureRepository(tempRoot);
    const firstCandidate = join(tempRoot, 'completed-candidate');
    const historyRowsBySymbol = {
      SPY: [
        { datetime: '2026-07-23', close: 600 },
        { datetime: '2026-08-10', close: 610 },
      ],
      SMH: [
        { datetime: '2026-07-23', close: 300 },
        { datetime: '2026-08-10', close: 310 },
      ],
    };
    const completed = runCatchUpFixture(fixtureRoot, tempRoot, firstCandidate, { historyRowsBySymbol });
    expect(completed.status, completed.stderr).toBe(0);
    for (const file of GROUP_FILES) copyFileSync(join(firstCandidate, file), join(fixtureRoot, 'public', file));
    const ledgerPath = join(fixtureRoot, 'public/arena-ledger.json');
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    ledger.lastRunDate = '2026-08-10';
    ledger.updated = '2026-08-10';
    writeJson(ledgerPath, ledger);
    const before = new Map(GROUP_FILES.map((file) => [file, readFileSync(join(fixtureRoot, 'public', file))]));
    const candidateDirectory = join(tempRoot, 'candidate');
    const result = runCatchUpFixture(fixtureRoot, tempRoot, candidateDirectory, {
      through: '2026-08-07',
      now: '2026-08-10T20:35:00.000Z',
      historyRowsBySymbol: {},
      onRequest: "throw new Error('ahead no-op must not fetch history');",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      historyRequestCount: 0,
      recoveredSessions: [],
    });
    for (const file of GROUP_FILES) {
      expect(readFileSync(join(candidateDirectory, file))).toEqual(before.get(file));
    }
  });

  it('fails closed instead of repairing prior history after the ledger has advanced', () => {
    for (const missing of ['valuation', 'run', 'audit']) {
      const tempRoot = mkdtempSync(join(tmpdir(), `afflatus-catch-up-ahead-${missing}-`));
      temporaryRoots.push(tempRoot);
      const fixtureRoot = makeFixtureRepository(tempRoot);
      const completedCandidate = join(tempRoot, 'completed-candidate');
      const completed = runCatchUpFixture(fixtureRoot, tempRoot, completedCandidate, {
        historyRowsBySymbol: {
          SPY: [
            { datetime: '2026-07-23', close: 600 },
            { datetime: '2026-08-10', close: 610 },
          ],
          SMH: [
            { datetime: '2026-07-23', close: 300 },
            { datetime: '2026-08-10', close: 310 },
          ],
        },
      });
      expect(completed.status, completed.stderr).toBe(0);
      for (const file of GROUP_FILES) copyFileSync(join(completedCandidate, file), join(fixtureRoot, 'public', file));
      const ledgerPath = join(fixtureRoot, 'public/arena-ledger.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
      ledger.lastRunDate = '2026-08-10';
      ledger.updated = '2026-08-10';
      if (missing === 'valuation') ledger.models.P.lastValuationDate = '2026-08-06';
      writeJson(ledgerPath, ledger);
      if (missing === 'run') {
        const path = join(fixtureRoot, 'public/arena-runlog.json');
        const runlog = JSON.parse(readFileSync(path, 'utf8'));
        runlog.runs = runlog.runs.filter((run) => !(
          run.date === '2026-08-07' && run.window === 'late-window' && run.model === 'P'
        ));
        writeJson(path, runlog);
      }
      if (missing === 'audit') {
        const path = join(fixtureRoot, 'public/arena-predlog.json');
        const predlog = JSON.parse(readFileSync(path, 'utf8'));
        const day = predlog.days.find((entry) => entry.date === '2026-08-07');
        delete day.audit;
        writeJson(path, predlog);
      }
      const candidateDirectory = join(tempRoot, 'candidate');
      const result = runCatchUpFixture(fixtureRoot, tempRoot, candidateDirectory, {
        through: '2026-08-07',
        now: '2026-08-10T20:35:00.000Z',
        historyRowsBySymbol: {},
        onRequest: "throw new Error('ahead fail-closed path must not fetch history');",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('bounded history through 2026-08-07 is incomplete');
      expect(() => readdirSync(candidateDirectory)).toThrow();
    }
  });

  it('preserves every candidate byte when prior-session catch-up is already complete', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'afflatus-catch-up-noop-'));
    temporaryRoots.push(tempRoot);
    const fixtureRoot = makeFixtureRepository(tempRoot);
    const firstCandidate = join(tempRoot, 'first-candidate');
    const historyRowsBySymbol = {
      SPY: [
        { datetime: '2026-07-23', close: 600 },
        { datetime: '2026-08-10', close: 610 },
      ],
      SMH: [
        { datetime: '2026-07-23', close: 300 },
        { datetime: '2026-08-10', close: 310 },
      ],
    };
    const first = runCatchUpFixture(fixtureRoot, tempRoot, firstCandidate, { historyRowsBySymbol });
    expect(first.status, first.stderr).toBe(0);

    const files = GROUP_FILES;
    for (const file of files) copyFileSync(join(firstCandidate, file), join(fixtureRoot, 'public', file));
    const secondCandidate = join(tempRoot, 'second-candidate');
    const second = runCatchUpFixture(fixtureRoot, tempRoot, secondCandidate, { historyRowsBySymbol });
    expect(second.status, second.stderr).toBe(0);
    expect(JSON.parse(second.stdout).note).toMatch(/already complete/);
    for (const file of files) {
      expect(readFileSync(join(secondCandidate, file))).toEqual(readFileSync(join(fixtureRoot, 'public', file)));
    }
  });
});
