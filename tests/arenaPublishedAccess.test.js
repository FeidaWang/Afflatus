import { describe, expect, it } from 'vitest';
import picks from '../public/arena-picks.json' with { type: 'json' };
import quantModel from '../public/arena-quant-model.json' with { type: 'json' };
import { getPublishedArenaAllowlist } from '../src/lib/arenaPublishedAccess.js';
import { JOURNAL_SYMBOLS } from '../src/features/arena-journal/journalStocks.js';

describe('getPublishedArenaAllowlist', () => {
  it('contains every symbol declared by the deployed Arena manifests', () => {
    const allowlist = getPublishedArenaAllowlist();
    for (const symbol of picks.quoteAllowlist) expect(allowlist.has(symbol)).toBe(true);
    for (const asset of quantModel.universe) expect(allowlist.has(asset.sym)).toBe(true);
    expect(allowlist.has(quantModel.benchmark)).toBe(true);
  });

  it('always allows the Arena journal company list', () => {
    const allowlist = getPublishedArenaAllowlist();
    for (const symbol of JOURNAL_SYMBOLS) expect(allowlist.has(symbol)).toBe(true);
  });

  it('does not broaden anonymous access beyond published research and journal symbols', () => {
    const allowlist = getPublishedArenaAllowlist();
    expect(allowlist.has('IBM')).toBe(false);
  });
});
