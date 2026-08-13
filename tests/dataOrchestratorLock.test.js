import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

const script = resolve('scripts/data-orchestrator-lock.mjs');

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'afflatus-orchestrator-lock-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

describe('data orchestrator run lock', () => {
  it('releases only with the matching owner token', () => {
    const root = repo();
    const acquired = run(root, 'acquire', '--pid=2147483647');
    expect(acquired.status).toBe(0);
    const token = JSON.parse(acquired.stdout).owner.token;
    expect(run(root, 'release', '--token=wrong').status).toBe(75);
    expect(run(root, 'status').stdout).toContain('"locked": true');
    expect(run(root, 'release', `--token=${token}`).status).toBe(0);
    expect(run(root, 'status').stdout).toContain('"locked": false');
  });

  it('fails closed for every pre-existing lock, including an expired owner', () => {
    const root = repo();
    const acquired = run(root, 'acquire');
    expect(run(root, 'acquire').status).toBe(75);
    const status = JSON.parse(run(root, 'status').stdout);
    writeFileSync(status.lockPath, JSON.stringify({
      ...JSON.parse(acquired.stdout).owner,
      pid: 2_147_483_647,
      expiresAt: '2000-01-01T00:00:00.000Z',
    }));
    expect(run(root, 'acquire', '--pid=2147483647').status).toBe(75);
    expect(run(root, 'status').stdout).toContain('"locked": true');
  });

  it('never steals an expired lock from a process that is still alive', () => {
    const root = repo();
    const acquired = run(root, 'acquire', `--pid=${process.pid}`);
    const status = JSON.parse(run(root, 'status').stdout);
    writeFileSync(status.lockPath, JSON.stringify({
      ...JSON.parse(acquired.stdout).owner,
      expiresAt: '2000-01-01T00:00:00.000Z',
    }));
    expect(run(root, 'acquire', '--pid=2147483647').status).toBe(75);
  });

  it('fails closed for an ownerless official lock instead of deleting it', () => {
    const root = repo();
    const status = JSON.parse(run(root, 'status').stdout);
    writeFileSync(status.lockPath, '');
    expect(run(root, 'acquire', '--pid=2147483647').status).toBe(75);
    expect(run(root, 'status').stdout).toContain('"locked": true');
  });

  it('does not expose a renew operation that could overwrite a newer owner', () => {
    const root = repo();
    const acquired = run(root, 'acquire');
    const token = JSON.parse(acquired.stdout).owner.token;
    const renewed = run(root, 'renew', `--token=${token}`);
    expect(renewed.status).toBe(64);
    expect(renewed.stderr).toContain('acquire|release|status');
    expect(JSON.parse(run(root, 'status').stdout).owner.token).toBe(token);
  });
});
