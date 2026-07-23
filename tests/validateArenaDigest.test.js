import { describe, it, expect } from 'vitest';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';

function book(model, overrides = {}) {
  return { model, pnlPct: 0.4, tradesCount: 1, note_en: 'ok', note_zh: '正常', ...overrides };
}

function base(overrides = {}) {
  return {
    date: '2026-07-23', generatedAt: '2026-07-23T21:00:00Z',
    books: [book('S'), book('P'), book('T')],
    tomorrowPicksCount: 5,
    delayed: [],
    ...overrides,
  };
}

describe('validateArenaDigest — valid input', () => {
  it('accepts a well-formed digest', () => {
    expect(validateArenaDigest(base())).toEqual({ ok: true, errors: [] });
  });
});

describe('validateArenaDigest — top-level', () => {
  it('rejects non-object input', () => {
    expect(validateArenaDigest(null).ok).toBe(false);
  });
  it('requires exactly one book per model', () => {
    expect(validateArenaDigest(base({ books: [book('S'), book('P')] })).ok).toBe(false);
  });
  it('requires tomorrowPicksCount to be a non-negative integer', () => {
    expect(validateArenaDigest(base({ tomorrowPicksCount: -1 })).ok).toBe(false);
    expect(validateArenaDigest(base({ tomorrowPicksCount: 1.5 })).ok).toBe(false);
  });
  it('requires delayed to be an array', () => {
    expect(validateArenaDigest(base({ delayed: null })).ok).toBe(false);
  });
  it('accepts a well-formed delayed entry', () => {
    const delayed = [{ date: '2026-07-22', window: 'post-market', model: 'T', note_en: 'queued offline', note_zh: '离线排队' }];
    expect(validateArenaDigest(base({ delayed })).ok).toBe(true);
  });
  it('rejects a delayed entry with a bad window or missing notes', () => {
    expect(validateArenaDigest(base({ delayed: [{ date: '2026-07-22', window: 'bogus', model: 'T', note_en: 'x' }] })).ok).toBe(false);
    expect(validateArenaDigest(base({ delayed: [{ date: '2026-07-22', window: 'post-market', model: 'T' }] })).ok).toBe(false);
  });
});

describe('validateArenaDigest — per-book fields', () => {
  it('rejects an unrecognized model', () => {
    const r = validateArenaDigest(base({ books: [book('A'), book('P'), book('T')] }));
    expect(r.ok).toBe(false);
  });
  it('requires bilingual notes', () => {
    const r = validateArenaDigest(base({ books: [book('S', { note_zh: '' }), book('P'), book('T')] }));
    expect(r.ok).toBe(false);
  });
});
