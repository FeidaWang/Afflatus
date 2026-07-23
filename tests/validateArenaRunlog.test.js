import { describe, it, expect } from 'vitest';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';

function run(overrides = {}) {
  return {
    date: '2026-07-23', window: 'open-window', model: 'S', status: 'done',
    ordersProposed: 1, ordersFilled: 1, note: 'ok',
    ...overrides,
  };
}

describe('validateArenaRunlog — valid input', () => {
  it('accepts a well-formed runlog', () => {
    expect(validateArenaRunlog({ runs: [run()] })).toEqual({ ok: true, errors: [] });
  });
  it('accepts an empty runs array', () => {
    expect(validateArenaRunlog({ runs: [] })).toEqual({ ok: true, errors: [] });
  });
});

describe('validateArenaRunlog — top-level', () => {
  it('rejects non-object input and a missing runs array', () => {
    expect(validateArenaRunlog(null).ok).toBe(false);
    expect(validateArenaRunlog({}).ok).toBe(false);
  });
});

describe('validateArenaRunlog — per-run fields', () => {
  it('rejects an unrecognized window', () => {
    expect(validateArenaRunlog({ runs: [run({ window: 'lunch' })] }).ok).toBe(false);
  });
  it('rejects an unrecognized model', () => {
    expect(validateArenaRunlog({ runs: [run({ model: 'A' })] }).ok).toBe(false); // Season 1 books don't run through the Part 4 log
  });
  it('rejects an unrecognized status', () => {
    expect(validateArenaRunlog({ runs: [run({ status: 'skipped' })] }).ok).toBe(false);
  });
  it('accepts gatherer/reviewer pseudo-models', () => {
    expect(validateArenaRunlog({ runs: [run({ window: 'pre-market-gather', model: 'gatherer' })] }).ok).toBe(true);
    expect(validateArenaRunlog({ runs: [run({ window: 'post-market', model: 'reviewer' })] }).ok).toBe(true);
  });
});

describe('validateArenaRunlog — run identity uniqueness (SS19.3.1)', () => {
  it('rejects a duplicate (date, window, model) triple', () => {
    const r = validateArenaRunlog({ runs: [run(), run()] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });
  it('allows the same date/window across different models', () => {
    const r = validateArenaRunlog({ runs: [run({ model: 'S' }), run({ model: 'P' })] });
    expect(r.ok).toBe(true);
  });
});
