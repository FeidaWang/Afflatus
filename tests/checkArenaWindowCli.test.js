import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('production Arena window gate CLI', () => {
  it('does not expose a caller-controlled clock', () => {
    const result = spawnSync(process.execPath, [
      'scripts/check-arena-window.mjs',
      '--window=open',
      '--now=2026-08-12T14:05:00.000Z',
    ], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/real wall clock/);
  });

  it('offers an explicit report-only mode without making it authoritative', () => {
    const result = spawnSync(process.execPath, [
      'scripts/check-arena-window.mjs',
      '--window=open',
      '--report-only',
    ], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveProperty('due');
  });
});
