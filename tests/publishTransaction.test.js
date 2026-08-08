import { afterEach, describe, expect, it } from 'vitest';
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
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  PublishTransactionError,
  recoverAtomicPublish,
  runAtomicPublishTransaction,
} from '../scripts/lib/publish-transaction.mjs';
import { DATA_PIPELINES } from '../src/config/dataPipelines.js';

const roots = [];

function makeRepository() {
  const root = mkdtempSync(join(tmpdir(), 'afflatus-publish-'));
  roots.push(root);
  mkdirSync(join(root, '.git'));
  mkdirSync(join(root, 'public'));
  writeFileSync(join(root, 'public/a.json'), '{"version":"old-a"}\n');
  writeFileSync(join(root, 'public/b.json'), '{"version":"old-b"}\n');
  writeFileSync(join(root, 'unrelated.txt'), 'leave me alone\n');
  return root;
}

function createRunner({ buildStatus = 0, commitStatus = 0, postPublishDiffStatus = 1 } = {}) {
  const calls = [];
  let worktreeDiffCalls = 0;
  const runner = (command, args) => {
    calls.push([command, [...args]]);
    if (command === 'npm') return { status: buildStatus, stderr: buildStatus ? 'smoke failed' : '' };
    if (command === 'git' && args[0] === 'diff') {
      if (args.includes('--cached')) return { status: 0, stdout: '' };
      worktreeDiffCalls += 1;
      return { status: worktreeDiffCalls === 1 ? 0 : postPublishDiffStatus, stdout: '' };
    }
    if (command === 'git' && args[0] === 'commit') return { status: commitStatus, stderr: commitStatus ? 'commit rejected' : '' };
    if (command === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: 'abc123\n' };
    if (command === 'git' && args[0] === 'log') return { status: 0, stdout: '' };
    throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
  };
  return { runner, calls };
}

function entries() {
  return [
    { path: 'public/a.json', data: { version: 'new-a' } },
    { path: 'public/b.json', data: { version: 'new-b' } },
  ];
}

function actualRunner(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('complete atomic data publish transaction', () => {
  it('is the declared publication mode for every mutable pipeline', () => {
    expect(new Set(DATA_PIPELINES.map((pipeline) => pipeline.publishMode))).toEqual(
      new Set(['recoverable-build-commit-transaction']),
    );
  });

  it('orders validate -> stage/rename -> build smoke -> path-only commit', () => {
    const root = makeRepository();
    const phases = [];
    const { runner, calls } = createRunner();
    const result = runAtomicPublishTransaction({
      repoRoot: root,
      pipelineId: 'test-pipeline',
      transactionId: 'txn-success',
      prepare: entries,
      commandRunner: runner,
      onPhase: (phase) => phases.push(phase),
    });

    expect(result).toMatchObject({ status: 'committed', commit: 'abc123' });
    expect(phases).toEqual(['validate', 'stage', 'publish', 'build', 'commit', 'complete']);
    expect(JSON.parse(readFileSync(join(root, 'public/a.json'), 'utf8'))).toEqual({ version: 'new-a' });
    expect(JSON.parse(readFileSync(join(root, 'public/b.json'), 'utf8'))).toEqual({ version: 'new-b' });
    expect(readFileSync(join(root, 'unrelated.txt'), 'utf8')).toBe('leave me alone\n');
    expect(readdirSync(join(root, '.git'))).toEqual([]);

    const commit = calls.find(([command, args]) => command === 'git' && args[0] === 'commit');
    expect(commit[1]).toContain('--only');
    expect(commit[1]).toContain('Afflatus-Data-Publish: txn-success');
    expect(commit[1].slice(commit[1].indexOf('--') + 1)).toEqual(['public/a.json', 'public/b.json']);
  });

  it('creates a real path-only Git commit without consuming unrelated staged work', () => {
    const root = mkdtempSync(join(tmpdir(), 'afflatus-publish-git-'));
    roots.push(root);
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'public/a.json'), '{"version":"old-a"}\n');
    writeFileSync(join(root, 'public/b.json'), '{"version":"old-b"}\n');
    writeFileSync(join(root, 'unrelated.txt'), 'initial\n');
    for (const [command, args] of [
      ['git', ['init', '-q']],
      ['git', ['config', 'user.email', 'tests@example.invalid']],
      ['git', ['config', 'user.name', 'Afflatus Tests']],
      ['git', ['add', '.']],
      ['git', ['commit', '-qm', 'initial']],
    ]) expect(actualRunner(command, args, { cwd: root }).status).toBe(0);
    writeFileSync(join(root, 'unrelated.txt'), 'staged user work\n');
    expect(actualRunner('git', ['add', 'unrelated.txt'], { cwd: root }).status).toBe(0);

    const result = runAtomicPublishTransaction({
      repoRoot: root,
      pipelineId: 'real-git-test',
      transactionId: 'real-git-txn',
      entries: entries(),
      buildCommand: [process.execPath, '-e', 'process.exit(0)'],
      commandRunner: actualRunner,
    });
    expect(result.status).toBe('committed');
    const committedPaths = actualRunner('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], { cwd: root })
      .stdout.trim().split('\n').filter(Boolean).sort();
    expect(committedPaths).toEqual(['public/a.json', 'public/b.json']);
    expect(actualRunner('git', ['diff', '--cached', '--name-only'], { cwd: root }).stdout.trim()).toBe('unrelated.txt');
  });

  it('commits declared site artifacts regenerated from the published data', () => {
    const root = mkdtempSync(join(tmpdir(), 'afflatus-publish-derived-'));
    roots.push(root);
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'public/a.json'), '{"version":"old-a"}\n');
    writeFileSync(join(root, 'public/b.json'), '{"version":"old-b"}\n');
    writeFileSync(join(root, 'derived.html'), 'old derived\n');
    writeFileSync(join(root, 'unrelated.txt'), 'initial\n');
    for (const [command, args] of [
      ['git', ['init', '-q']],
      ['git', ['config', 'user.email', 'tests@example.invalid']],
      ['git', ['config', 'user.name', 'Afflatus Tests']],
      ['git', ['add', '.']],
      ['git', ['commit', '-qm', 'initial']],
    ]) expect(actualRunner(command, args, { cwd: root }).status).toBe(0);

    const result = runAtomicPublishTransaction({
      repoRoot: root,
      pipelineId: 'derived-git-test',
      transactionId: 'derived-git-txn',
      entries: entries(),
      deriveCommand: [
        process.execPath,
        '-e',
        "require('node:fs').writeFileSync('derived.html', 'new derived\\n')",
      ],
      derivedPaths: ['derived.html'],
      buildCommand: [process.execPath, '-e', 'process.exit(0)'],
      commandRunner: actualRunner,
    });

    expect(result.status).toBe('committed');
    expect(readFileSync(join(root, 'derived.html'), 'utf8')).toBe('new derived\n');
    const committedPaths = actualRunner('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], { cwd: root })
      .stdout.trim().split('\n').filter(Boolean).sort();
    expect(committedPaths).toEqual(['derived.html', 'public/a.json', 'public/b.json']);
  });

  it('restores every original byte when the build smoke fails', () => {
    const root = makeRepository();
    const beforeA = readFileSync(join(root, 'public/a.json'));
    const beforeB = readFileSync(join(root, 'public/b.json'));
    const { runner, calls } = createRunner({ buildStatus: 1 });

    expect(() => runAtomicPublishTransaction({
      repoRoot: root,
      pipelineId: 'test-pipeline',
      transactionId: 'txn-build-fail',
      entries: entries(),
      commandRunner: runner,
    })).toThrowError(PublishTransactionError);
    expect(readFileSync(join(root, 'public/a.json'))).toEqual(beforeA);
    expect(readFileSync(join(root, 'public/b.json'))).toEqual(beforeB);
    expect(calls.some(([command, args]) => command === 'git' && args[0] === 'commit')).toBe(false);
    expect(readdirSync(join(root, '.git'))).toEqual([]);
  });

  it('restores generated artifacts when a later build smoke fails', () => {
    const root = makeRepository();
    const derivedPath = join(root, 'derived.html');
    writeFileSync(derivedPath, 'old derived\n');
    const phases = [];
    const { runner: baseRunner } = createRunner({ buildStatus: 1 });
    const runner = (command, args, options) => {
      if (command === 'derive') {
        writeFileSync(derivedPath, 'new derived\n');
        return { status: 0, stdout: '' };
      }
      return baseRunner(command, args, options);
    };

    expect(() => runAtomicPublishTransaction({
      repoRoot: root,
      pipelineId: 'derived-rollback-test',
      transactionId: 'derived-rollback-txn',
      entries: entries(),
      deriveCommand: ['derive'],
      derivedPaths: ['derived.html'],
      commandRunner: runner,
      onPhase: (phase) => phases.push(phase),
    })).toThrowError(PublishTransactionError);

    expect(phases).toEqual(['validate', 'stage', 'publish', 'derive', 'build']);
    expect(readFileSync(derivedPath, 'utf8')).toBe('old derived\n');
    expect(readdirSync(join(root, '.git'))).toEqual([]);
  });

  it('rolls the renamed group back when Git refuses the commit', () => {
    const root = makeRepository();
    const { runner } = createRunner({ commitStatus: 1 });
    let failure;
    try {
      runAtomicPublishTransaction({
        repoRoot: root,
        pipelineId: 'test-pipeline',
        transactionId: 'txn-commit-fail',
        entries: entries(),
        commandRunner: runner,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ phase: 'commit' });
    expect(readFileSync(join(root, 'public/a.json'), 'utf8')).toBe('{"version":"old-a"}\n');
    expect(readFileSync(join(root, 'public/b.json'), 'utf8')).toBe('{"version":"old-b"}\n');
    expect(readdirSync(join(root, '.git'))).toEqual([]);
  });

  it('fails validation before creating a staged file or running a command', () => {
    const root = makeRepository();
    const { runner, calls } = createRunner();
    expect(() => runAtomicPublishTransaction({
      repoRoot: root,
      pipelineId: 'test-pipeline',
      transactionId: 'txn-invalid',
      prepare() { throw new Error('schema mismatch'); },
      commandRunner: runner,
    })).toThrow(/schema mismatch/);
    expect(calls).toEqual([]);
    expect(readdirSync(join(root, 'public')).sort()).toEqual(['a.json', 'b.json']);
    expect(readdirSync(join(root, '.git'))).toEqual([]);
  });

  it('recovers a crash journal by restoring its same-directory backup', () => {
    const root = makeRepository();
    const targetPath = join(root, 'public/a.json');
    const backupPath = `${targetPath}.crashed.backup`;
    const stagePath = `${targetPath}.crashed.stage`;
    writeFileSync(backupPath, '{"version":"old-a"}\n');
    writeFileSync(targetPath, '{"version":"half-published"}\n');
    writeFileSync(stagePath, '{"version":"staged"}\n');
    writeFileSync(join(root, '.git/afflatus-data-publish.json'), JSON.stringify({
      version: 1,
      id: 'crashed',
      phase: 'published',
      entries: [{ targetPath, backupPath, stagePath, hadOriginal: true }],
    }));
    const { runner } = createRunner();
    const result = recoverAtomicPublish({ repoRoot: root, commandRunner: runner });
    expect(result).toMatchObject({ recovered: true, action: 'rolled-back' });
    expect(readFileSync(targetPath, 'utf8')).toBe('{"version":"old-a"}\n');
    expect(existsSync(backupPath)).toBe(false);
    expect(existsSync(stagePath)).toBe(false);
  });

  it('reclaims a dead owned lock, recovers its journal, then publishes normally', () => {
    const root = makeRepository();
    const targetPath = join(root, 'public/a.json');
    const backupPath = `${targetPath}.dead.backup`;
    const stagePath = `${targetPath}.dead.stage`;
    writeFileSync(backupPath, '{"version":"old-a"}\n');
    writeFileSync(targetPath, '{"version":"half-published"}\n');
    writeFileSync(join(root, '.git/afflatus-data-publish.json'), JSON.stringify({
      version: 1,
      id: 'dead-publisher',
      phase: 'published',
      entries: [{ targetPath, backupPath, stagePath, hadOriginal: true }],
    }));
    const lock = join(root, '.git/afflatus-data-pipeline.lock');
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: 2_147_483_647, transactionId: 'dead-publisher' }));
    const { runner } = createRunner();

    const result = runAtomicPublishTransaction({
      repoRoot: root,
      pipelineId: 'test-pipeline',
      transactionId: 'replacement',
      entries: entries(),
      commandRunner: runner,
    });
    expect(result.status).toBe('committed');
    expect(JSON.parse(readFileSync(targetPath, 'utf8'))).toEqual({ version: 'new-a' });
    expect(readdirSync(join(root, '.git'))).toEqual([]);
  });
});
