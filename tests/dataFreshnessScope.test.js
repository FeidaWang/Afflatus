import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { DATA_PIPELINES, dataPipelineOutputValue } from '../src/config/dataPipelines.js';

function runFreshness(...args) {
  return spawnSync(process.execPath, ['scripts/check-data-freshness.mjs', '--json', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('scoped grouped-data freshness', () => {
  it('does not treat an arbitrary same-date run as completion of a window group', () => {
    const openRunlog = DATA_PIPELINES
      .find((pipeline) => pipeline.id === 'arena-open')
      .outputs.find((output) => output.resource === 'arena-runlog');
    const onlyS = { runs: [{ date: '2026-08-10', window: 'open-window', model: 'S', status: 'done' }] };
    expect(dataPipelineOutputValue(openRunlog, onlyS)).toBe('');
    expect(dataPipelineOutputValue(openRunlog, {
      runs: [
        ...onlyS.runs,
        { date: '2026-08-10', window: 'open-window', model: 'P', status: 'done' },
      ],
    })).toBe('2026-08-10');

    const postmarketRunlog = DATA_PIPELINES
      .find((pipeline) => pipeline.id === 'arena-postmarket')
      .outputs.find((output) => output.resource === 'arena-runlog');
    expect(dataPipelineOutputValue(postmarketRunlog, {
      runs: [
        { date: '2026-08-10', window: 'post-market', model: 'S', status: 'done', valuationOnly: true },
        { date: '2026-08-10', window: 'post-market', model: 'P', status: 'done', valuationOnly: true },
        { date: '2026-08-10', window: 'post-market', model: 'T', status: 'missed' },
        { date: '2026-08-10', window: 'post-market', model: 'reviewer', status: 'done' },
      ],
    })).toBe('2026-08-10');
  });

  it('limits a profile check to pipelines the caller is allowed to repair', () => {
    const result = runFreshness(
      '--profile=postmarket-settlement',
      '--now=2026-08-08T21:00:00.000Z',
    );
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.scope).toEqual({
      profiles: ['postmarket-settlement'],
      pipelines: ['arena-postmarket'],
    });
    expect(report.pipelines.map((pipeline) => pipeline.id)).toEqual(['arena-postmarket']);
    expect(report.pipelines[0].outputs.map((output) => output.resource)).toContain('arena-runlog');
  });

  it('supports a direct pipeline scope and rejects unknown scopes', () => {
    const selected = runFreshness('--pipeline=arena-open', '--now=2026-08-08T21:00:00.000Z');
    expect(selected.status).toBe(0);
    expect(JSON.parse(selected.stdout).scope.pipelines).toEqual(['arena-open']);

    const unknown = runFreshness('--profile=not-a-profile');
    expect(unknown.status).not.toBe(0);
    expect(unknown.stderr).toContain('Unknown profile');
  });
});
