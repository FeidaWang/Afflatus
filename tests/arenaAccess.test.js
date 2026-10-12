import { describe, it, expect } from 'vitest';
import { resolveAllowlist, isSymbolAllowed, checkAdminKey } from '../src/lib/arenaAccess.js';

const universe = { symbols: [{ sym: 'NVDA' }, { sym: 'AAPL' }, { sym: 'SPY' }] };
const picks = { date: '2026-07-23', quoteAllowlist: ['WAB', 'SMCI', 'T', 'SPY'] };
const quantModel = { benchmark: 'SPY', universe: [{ sym: 'NVDA' }, { sym: 'AVGO' }] };

describe('resolveAllowlist', () => {
  it('uses the picks allowlist and nothing from the broad market universe', () => {
    const set = resolveAllowlist({ picks, universe });
    expect(set.has('WAB')).toBe(true);
    expect(set.has('NVDA')).toBe(false); // universe is no longer consulted
  });
  it('returns an empty set when picks is missing', () => {
    const set = resolveAllowlist({ picks: null, universe });
    expect(set.size).toBe(0);
  });
  it('returns an empty set when picks.quoteAllowlist is empty', () => {
    const set = resolveAllowlist({ picks: { date: '2026-07-23', quoteAllowlist: [] }, universe });
    expect(set.size).toBe(0);
  });
  it('returns an empty set when picks.quoteAllowlist is missing/malformed', () => {
    expect(resolveAllowlist({ picks: {}, universe }).size).toBe(0);
    expect(resolveAllowlist({ picks: { quoteAllowlist: 'NVDA' }, universe }).size).toBe(0);
  });
  it('does not gate on picks.date being stale — a day-old picks file still allows its symbols', () => {
    const stalePicks = { date: '2020-01-01', quoteAllowlist: ['WAB'] };
    const set = resolveAllowlist({ picks: stalePicks, universe });
    expect(set.has('WAB')).toBe(true);
  });
  it('returns an empty set when picks is unavailable (fail closed)', () => {
    const set = resolveAllowlist({ picks: null });
    expect(set.size).toBe(0);
  });
  it('gates a symbol that is not in quoteAllowlist', () => {
    const set = resolveAllowlist({ picks });
    expect(set.has('GME')).toBe(false);
    expect(set.has('NVDA')).toBe(false);
  });
  it('adds only the explicit Q-Foundry universe and benchmark', () => {
    const set = resolveAllowlist({ picks, quantModel, universe });
    expect(set.has('NVDA')).toBe(true);
    expect(set.has('AVGO')).toBe(true);
    expect(set.has('SPY')).toBe(true);
    expect(set.has('AAPL')).toBe(false);
  });
  it('ignores malformed Q-Foundry manifests', () => {
    expect(resolveAllowlist({ picks: null, quantModel: { universe: 'NVDA' } }).size).toBe(0);
  });
});

describe('isSymbolAllowed', () => {
  it('works against a Set', () => {
    const set = new Set(['NVDA']);
    expect(isSymbolAllowed('NVDA', set)).toBe(true);
    expect(isSymbolAllowed('AAPL', set)).toBe(false);
  });
  it('works against a plain array too', () => {
    expect(isSymbolAllowed('NVDA', ['NVDA'])).toBe(true);
  });
  it('returns false for a malformed allowlist rather than throwing', () => {
    expect(isSymbolAllowed('NVDA', null)).toBe(false);
    expect(isSymbolAllowed('NVDA', undefined)).toBe(false);
  });
});

describe('checkAdminKey', () => {
  const KEY = 'arena-admin-' + 'k'.repeat(32);
  const OTHER = 'arena-admin-' + 'k'.repeat(31) + 'j';
  it('accepts a matching key', () => {
    expect(checkAdminKey(KEY, KEY)).toBe(true);
  });
  it('rejects a wrong key of the same length', () => {
    expect(checkAdminKey(OTHER, KEY)).toBe(false);
  });
  it('rejects a key of a different length (no throw)', () => {
    expect(() => checkAdminKey('short', KEY)).not.toThrow();
    expect(checkAdminKey('short', KEY)).toBe(false);
  });
  it('fails closed when the configured key is shorter than 32 characters', () => {
    expect(checkAdminKey('secret123', 'secret123')).toBe(false);
  });
  it('fails closed when no key is configured server-side', () => {
    expect(checkAdminKey('anything', undefined)).toBe(false);
    expect(checkAdminKey('anything', '')).toBe(false);
  });
  it('fails closed when no key is provided by the client', () => {
    expect(checkAdminKey(undefined, KEY)).toBe(false);
    expect(checkAdminKey('', KEY)).toBe(false);
  });
  it('fails closed when both are empty (never "gate disabled")', () => {
    expect(checkAdminKey('', '')).toBe(false);
  });
});
