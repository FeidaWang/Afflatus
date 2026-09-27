// tests/sectorsFrontierSnapshot0927.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateSnapshot } from '../src/sectors/frontier/frontier-core.mjs';

const snap = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const obs = (m, k) => snap.observations.find((o) => o.model_id === m && o.metric_id === k)?.value;

describe('frontier snapshot 2026-09-27', () => {
  it('passes the existing schema validator', () => expect(validateSnapshot(snap)).toEqual([]));
  it('has 15 models and one observation per model × metric', () => {
    expect(snap.models).toHaveLength(15);
    expect(snap.observations).toHaveLength(15 * snap.metrics.length);
  });
  it('adds Opus 5.5 and replaces Grok 4.6 with Grok 4.7', () => {
    expect(obs('opus55-max', 'intelligence')).toBeGreaterThanOrEqual(50);
    expect(snap.models.some((m) => m.id === 'grok-xhigh')).toBe(false);
    expect(snap.models.find((m) => m.id === 'grok47-xhigh').name).toBe('Grok 4.7');
  });
  it('keeps the 2026-09-23 file untouched as history', () => {
    const old = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-23.json', 'utf8'));
    expect(old.snapshot_id).toBe('frontier-selected-2026-09-23');
  });
});
