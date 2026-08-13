import { afterEach, describe, expect, it } from 'vitest';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const SOURCE_ROOT = resolve(import.meta.dirname, '..');
const roots = [];

function run(command, args, cwd, options = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
  });
}

function must(command, args, cwd, options = {}) {
  const result = run(command, args, cwd, options);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout || ''}${result.stderr || ''}`,
    );
  }
  return result;
}

function git(cwd, ...args) {
  return must('git', args, cwd).stdout.trim();
}

function copyPublisherScripts(repo) {
  const scripts = [
    'push-data.sh',
    'publish-arena-run.sh',
    'queue-arena-outbox.mjs',
    'verify-data-transaction-head.mjs',
  ];
  for (const script of scripts) {
    const target = join(repo, 'scripts', script);
    copyFileSync(join(SOURCE_ROOT, 'scripts', script), target);
    if (script.endsWith('.sh') || script.startsWith('verify-')) chmodSync(target, 0o755);
  }
  mkdirSync(join(repo, 'scripts', 'lib'), { recursive: true });
  copyFileSync(
    join(SOURCE_ROOT, 'scripts', 'lib', 'site-publish-artifacts.mjs'),
    join(repo, 'scripts', 'lib', 'site-publish-artifacts.mjs'),
  );
  mkdirSync(join(repo, 'src', 'config'), { recursive: true });
  writeFileSync(join(repo, 'src', 'config', 'dataPipelines.js'), `
export const DATA_PIPELINES = [
  { id: 'test-data', outputs: [{ resource: 'test-data', path: 'public/data.json' }] },
  { id: 'second-data', outputs: [{ resource: 'second-data', path: 'public/second.json' }] },
  { id: 'arena-open', outputs: [
    { resource: 'arena-ledger', path: 'public/arena-ledger.json' },
    { resource: 'arena-runlog', path: 'public/arena-runlog.json' },
  ] },
];
`);
  writeFileSync(join(repo, 'src', 'config', 'siteManifest.js'), `
export const SITE_MANIFEST = [{ status: 'active', file: 'generated.html' }];
`);
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'afflatus-push-reliability-'));
  roots.push(root);
  const remote = join(root, 'remote.git');
  const repo = join(root, 'repo');
  mkdirSync(repo);
  must('git', ['init', '-q', '--bare', remote], root);
  must('git', ['init', '-q'], repo);
  git(repo, 'config', 'user.email', 'automation-tests@example.invalid');
  git(repo, 'config', 'user.name', 'Automation Tests');
  git(repo, 'config', 'commit.gpgsign', 'false');
  mkdirSync(join(repo, 'scripts'));
  mkdirSync(join(repo, 'public'));
  copyPublisherScripts(repo);
  const fakeBin = join(repo, 'test-bin');
  mkdirSync(fakeBin);
  const fakeNpm = join(fakeBin, 'npm');
  writeFileSync(fakeNpm, `#!/bin/bash
printf '%s\\n' "$*" >> "$PWD/validation.log"
if [ -n "\${FAKE_NPM_FAIL_MATCH:-}" ] && [[ "$*" == *"$FAKE_NPM_FAIL_MATCH"* ]]; then
  exit 23
fi
exit 0
`);
  chmodSync(fakeNpm, 0o755);
  writeFileSync(join(repo, '.gitignore'), 'scripts/*.log\nscripts/outbox/\nvalidation.log\n');
  writeFileSync(join(repo, 'generated.html'), 'generated baseline\n');
  writeFileSync(join(repo, 'public', 'data.json'), '{"version":1}\n');
  writeFileSync(join(repo, 'public', 'second.json'), '{"version":1}\n');
  writeFileSync(join(repo, 'public', 'arena-ledger.json'), '{"version":1}\n');
  writeFileSync(join(repo, 'public', 'arena-runlog.json'), '{"runs":[]}\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'baseline');
  git(repo, 'branch', '-M', 'main');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-u', 'origin', 'HEAD:refs/heads/main');
  must('git', ['--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main'], root);
  const baseline = git(repo, 'rev-parse', 'HEAD');
  return { root, remote, repo, baseline, fakeBin };
}

let transactionCounter = 0;

function commitData(repo, path, content, message = 'data transaction', pipelineId = 'test-data') {
  writeFileSync(join(repo, path), content);
  git(repo, 'add', path);
  transactionCounter += 1;
  git(
    repo,
    'commit', '-qm', message,
    '-m', `Afflatus-Data-Publish: test-${transactionCounter}`,
    '-m', `Afflatus-Data-Pipeline: ${pipelineId}`,
  );
  return git(repo, 'rev-parse', 'HEAD');
}

function commitArenaData(repo, runlogContent = '{"runs":[{"done":true}]}\n') {
  writeFileSync(join(repo, 'public', 'arena-ledger.json'), '{"version":2}\n');
  writeFileSync(join(repo, 'public', 'arena-runlog.json'), runlogContent);
  git(repo, 'add', 'public/arena-ledger.json', 'public/arena-runlog.json');
  transactionCounter += 1;
  git(
    repo,
    'commit', '-qm', 'atomic Arena transaction',
    '-m', `Afflatus-Data-Publish: test-${transactionCounter}`,
    '-m', 'Afflatus-Data-Pipeline: arena-open',
  );
  return git(repo, 'rev-parse', 'HEAD');
}

function runPushData(repo, env = {}) {
  const commandPath = `${join(repo, 'test-bin')}:${env.PATH || process.env.PATH}`;
  return run(
    'bash',
    ['scripts/push-data.sh', 'public/data.json', 'test transaction'],
    repo,
    { env: { ...env, PATH: commandPath } },
  );
}

function runArenaPush(repo, runId = '2026-08-11_post-market_T', env = {}) {
  const commandPath = `${join(repo, 'test-bin')}:${env.PATH || process.env.PATH}`;
  return run(
    'bash',
    ['scripts/publish-arena-run.sh', runId, 'Arena settlement test'],
    repo,
    { env: { ...env, PATH: commandPath } },
  );
}

function remoteMain(repo) {
  const line = git(repo, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main');
  return line.split(/\s+/, 1)[0];
}

function advanceRemote(fixture, path, content) {
  const actor = join(fixture.root, `actor-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  git(fixture.root, 'clone', '-q', fixture.remote, actor);
  git(actor, 'config', 'user.email', 'remote-actor@example.invalid');
  git(actor, 'config', 'user.name', 'Remote Actor');
  git(actor, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(actor, path), content);
  git(actor, 'add', path);
  git(actor, 'commit', '-qm', 'remote advance');
  git(actor, 'push', 'origin', 'HEAD:refs/heads/main');
  return git(actor, 'rev-parse', 'HEAD');
}

function prepareRemoteAdvance(fixture, path, content) {
  const actor = join(fixture.root, `racing-actor-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  git(fixture.root, 'clone', '-q', fixture.remote, actor);
  git(actor, 'config', 'user.email', 'remote-racer@example.invalid');
  git(actor, 'config', 'user.name', 'Remote Racer');
  git(actor, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(actor, path), content);
  git(actor, 'add', path);
  git(actor, 'commit', '-qm', 'racing remote advance');
  return { actor, sha: git(actor, 'rev-parse', 'HEAD') };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('data push helper reliability', () => {
  it('hard-codes the explicit main ref and never uses pull, autostash, or local main as the push source', () => {
    for (const name of ['push-data.sh', 'publish-arena-run.sh']) {
      const source = readFileSync(join(SOURCE_ROOT, 'scripts', name), 'utf8');
      expect(source).toContain('set -euo pipefail');
      expect(source).toContain('TARGET_REF="refs/heads/main"');
      expect(source).toContain('git ls-remote --exit-code "$REMOTE" "$TARGET_REF"');
      expect(source).not.toContain('autostash');
      expect(source).not.toMatch(/git pull\b/);
      expect(source).not.toMatch(/git push\s+origin\s+main/);
      expect(source).not.toContain('afflatus-data-pipeline.lock');
    }
    expect(readFileSync(join(SOURCE_ROOT, 'scripts', 'push-data.sh'), 'utf8'))
      .toContain('git push "$REMOTE" "HEAD:$TARGET_REF"');
    expect(readFileSync(join(SOURCE_ROOT, 'scripts', 'publish-arena-run.sh'), 'utf8'))
      .toContain('bash scripts/push-data.sh');
  });

  it('pushes the dedicated tracked main transaction HEAD', () => {
    const fixture = makeFixture();
    const transaction = commitData(fixture.repo, 'public/data.json', '{"version":2}\n');
    const result = runPushData(fixture.repo);

    expect(result.status, result.stderr).toBe(0);
    expect(remoteMain(fixture.repo)).toBe(transaction);
    expect(git(fixture.repo, 'rev-parse', 'HEAD')).toBe(transaction);
    expect(git(fixture.repo, 'rev-parse', 'main')).toBe(transaction);
    const log = readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8');
    expect(log).toContain(`event=committed status=ready sha=${transaction}`);
    expect(log).toContain(`event=pushed status=ok sha=${transaction}`);
    expect(log).toContain(`event=verified status=ok sha=${transaction}`);
  }, 30_000);

  it('rejects a transaction on a feature branch even when trailers and paths are valid', () => {
    const fixture = makeFixture();
    git(fixture.repo, 'switch', '-qc', 'automation-transaction');
    commitData(fixture.repo, 'public/data.json', '{"version":2}\n');

    const result = runPushData(fixture.repo);

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(fixture.baseline);
    expect(readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8'))
      .toContain('event=preflight status=failed');
  });

  it('fetches once and rebases a divergent clean transaction before pushing', () => {
    const fixture = makeFixture();
    commitData(fixture.repo, 'public/data.json', '{"version":2}\n');
    const remoteAdvance = advanceRemote(fixture, 'remote-only.txt', 'remote work\n');

    const result = runPushData(fixture.repo);

    expect(result.status, result.stderr).toBe(0);
    const reconciledHead = git(fixture.repo, 'rev-parse', 'HEAD');
    expect(reconciledHead).not.toBe(remoteAdvance);
    expect(remoteMain(fixture.repo)).toBe(reconciledHead);
    expect(git(fixture.repo, 'merge-base', '--is-ancestor', remoteAdvance, reconciledHead)).toBe('');
    const log = readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8');
    expect(log).toContain('event=reconciled status=rebased');
    expect(log).toContain(`event=verified status=ok sha=${reconciledHead}`);
    expect(readFileSync(join(fixture.repo, 'validation.log'), 'utf8').trim().split('\n')).toEqual([
      'run data:check',
      'run data:freshness:strict -- --pipeline=test-data',
      'test',
      'run build',
    ]);
  }, 30_000);

  it('rejects a clean HEAD without atomic transaction trailers before fetching or validating', () => {
    const fixture = makeFixture();
    writeFileSync(join(fixture.repo, 'public', 'data.json'), '{"version":2}\n');
    git(fixture.repo, 'add', 'public/data.json');
    git(fixture.repo, 'commit', '-qm', 'unwitnessed data edit');

    const result = runPushData(fixture.repo);

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(fixture.baseline);
    expect(existsSync(join(fixture.repo, 'validation.log'))).toBe(false);
    expect(readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8'))
      .toContain('event=transaction status=failed');
  });

  it('rejects a transaction whose HEAD contains a path outside its declared boundary', () => {
    const fixture = makeFixture();
    writeFileSync(join(fixture.repo, 'public', 'data.json'), '{"version":2}\n');
    writeFileSync(join(fixture.repo, 'unexpected.txt'), 'must not publish\n');
    git(fixture.repo, 'add', 'public/data.json', 'unexpected.txt');
    transactionCounter += 1;
    git(
      fixture.repo,
      'commit', '-qm', 'over-broad transaction',
      '-m', `Afflatus-Data-Publish: test-${transactionCounter}`,
      '-m', 'Afflatus-Data-Pipeline: test-data',
    );

    const result = runPushData(fixture.repo);

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(fixture.baseline);
    expect(existsSync(join(fixture.repo, 'validation.log'))).toBe(false);
  });

  it('rejects a valid transaction HEAD when an unpublished non-transaction ancestor hitchhikes', () => {
    const fixture = makeFixture();
    writeFileSync(join(fixture.repo, 'malicious-ancestor.txt'), 'must never hitchhike\n');
    git(fixture.repo, 'add', 'malicious-ancestor.txt');
    git(fixture.repo, 'commit', '-qm', 'unrelated unpublished ancestor');
    commitData(fixture.repo, 'public/data.json', '{"version":2}\n');

    const result = runPushData(fixture.repo);

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(fixture.baseline);
    expect(readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8'))
      .toContain('event=transaction-range status=failed');
  });

  it('publishes a backlog of multiple complete data transactions but no other commits', () => {
    const fixture = makeFixture();
    const first = commitData(fixture.repo, 'public/data.json', '{"version":2}\n');
    const second = commitData(fixture.repo, 'public/data.json', '{"version":3}\n');

    const result = runPushData(fixture.repo);

    expect(result.status, result.stderr).toBe(0);
    expect(remoteMain(fixture.repo)).toBe(second);
    expect(git(fixture.repo, 'merge-base', '--is-ancestor', first, second)).toBe('');
    const log = readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8');
    expect(log.match(/event=transaction-range status=ok/g)).toHaveLength(2);
  }, 30_000);

  it('runs scoped strict freshness for every distinct pipeline in a backlog', () => {
    const fixture = makeFixture();
    commitData(fixture.repo, 'public/second.json', '{"version":2}\n', 'second', 'second-data');
    commitData(fixture.repo, 'public/data.json', '{"version":2}\n');

    const result = runPushData(fixture.repo, { FAKE_NPM_FAIL_MATCH: 'pipeline=second-data' });

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(fixture.baseline);
    const validation = readFileSync(join(fixture.repo, 'validation.log'), 'utf8');
    expect(validation).toContain('run data:freshness:strict -- --pipeline=second-data');
    expect(validation).not.toContain('run build');
  }, 30_000);

  it('installs fail-safe signal cleanup and disables unattended credential prompts', () => {
    const source = readFileSync(join(SOURCE_ROOT, 'scripts', 'push-data.sh'), 'utf8');
    expect(source).toContain('export GIT_TERMINAL_PROMPT=0');
    expect(source).toContain('export GCM_INTERACTIVE=Never');
    expect(source).toContain('BatchMode=yes');
    expect(source).toContain('ConnectTimeout=20');
    expect(source).toContain('http.lowSpeedTime');
    expect(source).toContain("trap 'cleanup_on_signal 130' INT");
    expect(source).toContain("trap 'cleanup_on_signal 143' TERM");
    expect(source).toContain('git rebase --abort');
  });

  it('aborts a rebase owned by this helper when TERM interrupts it', () => {
    const fixture = makeFixture();
    commitData(fixture.repo, 'public/data.json', '{"version":2}\n');
    advanceRemote(fixture, 'remote-only.txt', 'remote work\n');
    const realGit = must('which', ['git'], fixture.root).stdout.trim();
    const shimDir = join(fixture.root, 'term-bin');
    mkdirSync(shimDir);
    const shim = join(shimDir, 'git');
    writeFileSync(shim, `#!/bin/bash
if [ "\${1:-}" = "rebase" ] && [ "\${2:-}" != "--abort" ]; then
  ${JSON.stringify(realGit)} rebase "$2" >/dev/null 2>&1
  kill -TERM "$PPID"
  sleep 1
  exit 143
fi
exec ${JSON.stringify(realGit)} "$@"
`);
    chmodSync(shim, 0o755);

    const result = runPushData(fixture.repo, { PATH: `${shimDir}:${process.env.PATH}` });

    expect(result.status).not.toBe(0);
    expect(existsSync(join(fixture.repo, '.git', 'rebase-merge'))).toBe(false);
    expect(existsSync(join(fixture.repo, '.git', 'rebase-apply'))).toBe(false);
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('');
  }, 30_000);

  it('stops before push when any post-reconcile verification command fails', () => {
    const fixture = makeFixture();
    commitData(fixture.repo, 'public/data.json', '{"version":2}\n');
    const remoteAdvance = advanceRemote(fixture, 'remote-only.txt', 'remote work\n');

    const result = runPushData(fixture.repo, { FAKE_NPM_FAIL_MATCH: 'freshness:strict' });

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(remoteAdvance);
    expect(readFileSync(join(fixture.repo, 'validation.log'), 'utf8')).toContain(
      'run data:freshness:strict -- --pipeline=test-data',
    );
    expect(readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8'))
      .not.toContain('event=pushed status=ok');
  }, 30_000);

  it('refetches, rebases, revalidates, and retries exactly once after a remote push race', () => {
    const fixture = makeFixture();
    commitData(fixture.repo, 'public/data.json', '{"version":2}\n');
    const race = prepareRemoteAdvance(fixture, 'racer-only.txt', 'racing work\n');
    const realGit = must('which', ['git'], fixture.root).stdout.trim();
    const shimDir = join(fixture.root, 'race-bin');
    const statePath = join(fixture.root, 'race-triggered');
    mkdirSync(shimDir);
    const shim = join(shimDir, 'git');
    writeFileSync(shim, `#!/bin/bash
if [ "\${1:-}" = "push" ] && [ ! -e ${JSON.stringify(statePath)} ]; then
  touch ${JSON.stringify(statePath)}
  ${JSON.stringify(realGit)} -C ${JSON.stringify(race.actor)} push origin HEAD:refs/heads/main >/dev/null 2>&1
fi
exec ${JSON.stringify(realGit)} "$@"
`);
    chmodSync(shim, 0o755);

    const result = runPushData(fixture.repo, {
      PATH: `${shimDir}:${process.env.PATH}`,
    });

    expect(result.status, result.stderr).toBe(0);
    const published = remoteMain(fixture.repo);
    expect(git(fixture.repo, 'merge-base', '--is-ancestor', race.sha, published)).toBe('');
    expect(git(fixture.repo, 'rev-parse', 'HEAD')).toBe(published);
    const validationLines = readFileSync(join(fixture.repo, 'validation.log'), 'utf8').trim().split('\n');
    expect(validationLines).toHaveLength(8);
    expect(validationLines.filter((line) => line === 'run build')).toHaveLength(2);
    const log = readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8');
    expect(log.match(/event=pushed status=retrying/g)).toHaveLength(1);
    expect(log).toContain('event=reconciled status=rebased');
    expect(log).toContain('event=verified status=ok');
  }, 30_000);

  it('aborts a single conflicting rebase and reports a non-zero audited failure', () => {
    const fixture = makeFixture();
    const transaction = commitData(fixture.repo, 'public/data.json', '{"side":"transaction"}\n');
    const remoteAdvance = advanceRemote(fixture, 'public/data.json', '{"side":"remote"}\n');

    const result = runPushData(fixture.repo);

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(remoteAdvance);
    expect(git(fixture.repo, 'rev-parse', 'HEAD')).toBe(transaction);
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('');
    expect(existsSync(join(fixture.repo, '.git', 'rebase-merge'))).toBe(false);
    const log = readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8');
    expect(log).toContain('event=reconciled status=failed');
    expect(log).not.toContain('event=pushed status=ok');
  }, 30_000);

  it('refuses any tracked dirty state before fetching or pushing', () => {
    const fixture = makeFixture();
    commitData(fixture.repo, 'public/data.json', '{"version":2}\n');
    writeFileSync(join(fixture.repo, 'public', 'arena-runlog.json'), '{"dirty":true}\n');

    const result = runPushData(fixture.repo);

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(fixture.baseline);
    const log = readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8');
    expect(log).toContain('event=preflight status=failed');
    expect(log).not.toContain('event=pushed status=ok');
  }, 30_000);
});

describe('Arena outbox and verification semantics', () => {
  it('rejects a forged Arena transaction that omits another atomic-group output', () => {
    const fixture = makeFixture();
    commitData(
      fixture.repo, 'public/arena-runlog.json', '{"runs":[{"done":true}]}\n', 'runlog only', 'arena-open',
    );

    const result = runArenaPush(fixture.repo);

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(fixture.baseline);
    expect(result.stderr).toContain('not a valid Arena data-publish transaction');
  });

  it('does not mislabel a local verification failure as pending network-sync work', () => {
    const fixture = makeFixture();
    commitArenaData(fixture.repo);

    const result = runArenaPush(fixture.repo, '2026-08-11_open-window_S', {
      FAKE_NPM_FAIL_MATCH: 'data:check',
    });

    expect(result.status).not.toBe(0);
    expect(existsSync(join(
      fixture.repo, 'scripts', 'outbox', '2026-08-11_open-window_S.json',
    ))).toBe(false);
    expect(readFileSync(join(fixture.repo, 'scripts', 'publish-arena-run.log'), 'utf8'))
      .toContain('event=outbox status=not-queued');
  });

  it('returns non-zero and queues the run when the remote rejects HEAD:main', () => {
    const fixture = makeFixture();
    commitArenaData(fixture.repo);
    const hook = join(fixture.remote, 'hooks', 'pre-receive');
    writeFileSync(hook, '#!/bin/sh\necho rejected-for-test >&2\nexit 1\n');
    chmodSync(hook, 0o755);

    const result = runArenaPush(fixture.repo);

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(fixture.baseline);
    const outboxPath = join(fixture.repo, 'scripts', 'outbox', '2026-08-11_post-market_T.json');
    expect(existsSync(outboxPath)).toBe(true);
    expect(JSON.parse(readFileSync(outboxPath, 'utf8'))).toMatchObject({
      runId: '2026-08-11_post-market_T',
      expectedCommitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      transactionId: expect.stringMatching(/^test-/),
      pipelineId: 'arena-open',
    });
    const log = readFileSync(join(fixture.repo, 'scripts', 'publish-arena-run.log'), 'utf8');
    expect(log).toContain('event=pushed status=failed');
    expect(log).toContain('event=outbox status=queued');
    expect(log).not.toContain('event=verified status=ok');
  }, 30_000);

  it('treats an ls-remote SHA mismatch as failure and preserves an outbox audit record', () => {
    const fixture = makeFixture();
    const transaction = commitArenaData(fixture.repo, '{"runs":[{"verified":false}]}\n');
    const realGit = must('which', ['git'], fixture.root).stdout.trim();
    const shimDir = join(fixture.root, 'bin');
    mkdirSync(shimDir);
    const shim = join(shimDir, 'git');
    writeFileSync(
      shim,
      `#!/bin/bash\nif [ "\${1:-}" = "ls-remote" ]; then\n  printf '%040d\\trefs/heads/main\\n' 0\n  exit 0\nfi\nexec ${JSON.stringify(realGit)} "$@"\n`,
    );
    chmodSync(shim, 0o755);

    const result = runArenaPush(fixture.repo, '2026-08-11_post-market_T', {
      PATH: `${shimDir}:${process.env.PATH}`,
    });

    expect(result.status).not.toBe(0);
    expect(remoteMain(fixture.repo)).toBe(transaction);
    expect(existsSync(join(
      fixture.repo,
      'scripts',
      'outbox',
      '2026-08-11_post-market_T.json',
    ))).toBe(true);
    const pushLog = readFileSync(join(fixture.repo, 'scripts', 'push-data.log'), 'utf8');
    expect(pushLog).toContain(`event=pushed status=ok sha=${transaction}`);
    expect(pushLog).toContain('event=verified status=failed');
    const arenaLog = readFileSync(join(fixture.repo, 'scripts', 'publish-arena-run.log'), 'utf8');
    expect(arenaLog).toContain('event=pushed status=failed');
    expect(arenaLog).toContain('event=outbox status=queued');
  }, 30_000);

  it('classifies a wrapper readback outage after a verified push as retryable network failure', () => {
    const fixture = makeFixture();
    const transaction = commitArenaData(fixture.repo);
    const realGit = must('which', ['git'], fixture.root).stdout.trim();
    const shimDir = join(fixture.root, 'readback-bin');
    const counter = join(fixture.root, 'ls-remote-count');
    mkdirSync(shimDir);
    const shim = join(shimDir, 'git');
    writeFileSync(shim, `#!/bin/bash
if [ "\${1:-}" = "ls-remote" ]; then
  count=0
  [ ! -f ${JSON.stringify(counter)} ] || count="$(cat ${JSON.stringify(counter)})"
  count=$((count + 1))
  printf '%s' "$count" > ${JSON.stringify(counter)}
  [ "$count" -lt 2 ] || exit 69
fi
exec ${JSON.stringify(realGit)} "$@"
`);
    chmodSync(shim, 0o755);

    const result = runArenaPush(fixture.repo, '2026-08-11_post-market_T', {
      PATH: `${shimDir}:${process.env.PATH}`,
    });

    expect(result.status).toBe(75);
    expect(remoteMain(fixture.repo)).toBe(transaction);
    expect(existsSync(join(
      fixture.repo, 'scripts', 'outbox', '2026-08-11_post-market_T.json',
    ))).toBe(true);
    expect(readFileSync(join(fixture.repo, 'scripts', 'publish-arena-run.log'), 'utf8'))
      .toContain('event=verified status=failed reason=readback');
  }, 30_000);

  it('archives existing outbox entries only after push and remote-SHA verification succeed', () => {
    const fixture = makeFixture();
    const transaction = commitArenaData(fixture.repo);
    const outboxDir = join(fixture.repo, 'scripts', 'outbox');
    mkdirSync(outboxDir, { recursive: true });
    writeFileSync(join(outboxDir, 'older-run.json'), `${JSON.stringify({
      runId: 'older-run', expectedCommitSha: transaction,
      transactionId: `test-${transactionCounter}`, pipelineId: 'arena-open',
    })}\n`);

    const result = runArenaPush(fixture.repo);

    expect(result.status, result.stderr).toBe(0);
    expect(remoteMain(fixture.repo)).toBe(transaction);
    const outboxFiles = readdirSync(outboxDir);
    expect(outboxFiles.some((name) => name.endsWith('.json'))).toBe(false);
    expect(outboxFiles.some((name) => basename(name).startsWith('older-run.json.flushed_'))).toBe(true);
    const log = readFileSync(join(fixture.repo, 'scripts', 'publish-arena-run.log'), 'utf8');
    expect(log).toContain(`event=verified status=ok sha=${transaction}`);
    expect(log).toContain('event=outbox status=flushed count=1');
  }, 30_000);

  it('retains an outbox receipt whose expected commit is not on verified remote main', () => {
    const fixture = makeFixture();
    const transaction = commitArenaData(fixture.repo);
    const outboxDir = join(fixture.repo, 'scripts', 'outbox');
    mkdirSync(outboxDir, { recursive: true });
    writeFileSync(join(outboxDir, 'unproven-run.json'), `${JSON.stringify({
      runId: 'unproven-run', expectedCommitSha: 'f'.repeat(40),
      transactionId: 'does-not-exist', pipelineId: 'arena-open',
    })}\n`);

    const result = runArenaPush(fixture.repo);

    expect(result.status, result.stderr).toBe(0);
    expect(remoteMain(fixture.repo)).toBe(transaction);
    expect(existsSync(join(outboxDir, 'unproven-run.json'))).toBe(true);
    expect(readFileSync(join(fixture.repo, 'scripts', 'publish-arena-run.log'), 'utf8'))
      .toContain('event=outbox status=retained');
  }, 30_000);

  it('flushes a receipt by stable transaction identity after rebase rewrites its SHA', () => {
    const fixture = makeFixture();
    const oldTransaction = commitArenaData(fixture.repo);
    const oldMessage = git(fixture.repo, 'log', '-1', '--format=%B');
    const transactionId = oldMessage.match(/^Afflatus-Data-Publish:\s*(\S+)/m)[1];
    const outboxDir = join(fixture.repo, 'scripts', 'outbox');
    mkdirSync(outboxDir, { recursive: true });
    writeFileSync(join(outboxDir, 'rebased-run.json'), `${JSON.stringify({
      runId: 'rebased-run',
      expectedCommitSha: oldTransaction,
      transactionId,
      pipelineId: 'arena-open',
    })}\n`);
    advanceRemote(fixture, 'remote-only.txt', 'remote work\n');

    const result = runArenaPush(fixture.repo);

    expect(result.status, result.stderr).toBe(0);
    const rewrittenTransaction = remoteMain(fixture.repo);
    expect(rewrittenTransaction).not.toBe(oldTransaction);
    const files = readdirSync(outboxDir);
    expect(files.some((name) => name === 'rebased-run.json')).toBe(false);
    expect(files.some((name) => name.startsWith('rebased-run.json.flushed_'))).toBe(true);
    expect(readFileSync(join(fixture.repo, 'scripts', 'publish-arena-run.log'), 'utf8'))
      .toContain(`transaction_id=${transactionId}`);
  }, 30_000);
});
