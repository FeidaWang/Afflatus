import { describe, expect, it, vi } from 'vitest';
import {
  historyCacheKey,
  isNyseSession,
  lastCompletedMarketSession,
  readHistoryCache,
  readLatestHistoryCache,
  writeHistoryCache,
} from '../src/lib/marketSession.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const candles = (date) => Array.from({ length: 21 }, (_, index) => ({
  t: index === 20 ? date : `2026-06-${String(index + 1).padStart(2, '0')}`,
  c: 100 + index,
}));

describe('NYSE market sessions', () => {
  it('uses the last completed session across close and weekend boundaries', () => {
    expect(lastCompletedMarketSession(new Date('2026-07-24T19:59:00Z'))).toBe('2026-07-23');
    expect(lastCompletedMarketSession(new Date('2026-07-24T20:01:00Z'))).toBe('2026-07-24');
    expect(lastCompletedMarketSession(new Date('2026-07-26T14:00:00Z'))).toBe('2026-07-24');
  });

  it('skips observed holidays and Good Friday', () => {
    expect(isNyseSession('2026-07-03')).toBe(false);
    expect(lastCompletedMarketSession(new Date('2026-07-06T15:00:00Z'))).toBe('2026-07-02');
    expect(isNyseSession('2026-04-03')).toBe(false);
    expect(isNyseSession('2021-12-31')).toBe(false);
  });
});

describe('Arena history session cache', () => {
  it('keys immutable history by ticker and completed market session', () => {
    const storage = new MemoryStorage();
    vi.spyOn(Date, 'now').mockReturnValue(123);
    writeHistoryCache(storage, 'nvda', '2026-07-23', candles('2026-07-23'));
    expect(historyCacheKey('NVDA', '2026-07-23')).toBe('afflatus-ta:v2:NVDA:2026-07-23');
    expect(readHistoryCache(storage, 'NVDA', '2026-07-23')).toMatchObject({
      session: '2026-07-23',
      storedAt: 123,
    });
    expect(readHistoryCache(storage, 'NVDA', '2026-07-24')).toBeNull();
    vi.restoreAllMocks();
  });

  it('finds only the latest older session for an offline fallback', () => {
    const storage = new MemoryStorage();
    writeHistoryCache(storage, 'AMD', '2026-07-22', candles('2026-07-22'));
    writeHistoryCache(storage, 'AMD', '2026-07-23', candles('2026-07-23'));
    writeHistoryCache(storage, 'NVDA', '2026-07-24', candles('2026-07-24'));
    expect(readLatestHistoryCache(storage, 'AMD', '2026-07-24')?.session).toBe('2026-07-23');
    expect(readLatestHistoryCache(storage, 'AMD', '2026-07-23')?.session).toBe('2026-07-22');
  });
});
