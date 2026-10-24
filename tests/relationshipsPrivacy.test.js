import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as store from '../src/horoscope/profileStore.js';
import { clearHoroscopeStorage, parseBirthForm } from '../src/horoscope/formDetails.js';
import { createRelationshipsClient } from '../src/lib/relationships/client.js';
import { computeRelationshipReport } from '../src/lib/relationships/kernel.js';
import { DEFAULT_CONFIG, SCHEMA_VERSION } from '../src/lib/relationships/contract.js';
import { JOURNAL_KEY } from '../src/lib/dailyJournal.js';

class MemoryStorage {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
}
// Object.keys(storage) is how clearHoroscopeStorage enumerates real Storage.
const asStorage = (m) => new Proxy(m, { ownKeys: (t) => [...t.map.keys()], getOwnPropertyDescriptor: (t, k) => (t.map.has(k) ? { enumerable: true, configurable: true, value: t.map.get(k) } : undefined) });
const refusing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };

describe('profile storage (Q10)', () => {
  it('reads profiles and contacts saved by the old page in place', () => {
    const s = new MemoryStorage({
      'afflatus-horo:me': JSON.stringify({ y: 1990, m: 1, d: 1, hour: 11, gender: 'F', lat: 31.2, lon: 121.5 }),
      'afflatus-horo:book': JSON.stringify([{ name: 'TA', y: 1992, m: 6, d: 15, hour: null }, { name: '<b>x', y: 1993, m: 2, d: 3, hour: 7 }]),
    });
    expect(store.loadProfile(s)).toEqual({ y: 1990, m: 1, d: 1, hour: 11, gender: 'F', lat: 31.2, lon: 121.5 });
    expect(store.loadBook(s)).toHaveLength(2);
  });

  it('shape-checks what it reads back and drops malformed or oversized records', () => {
    const s = new MemoryStorage({
      'afflatus-horo:me': JSON.stringify({ y: 1990, m: 13, d: 1 }),
      'afflatus-horo:book': JSON.stringify([{ name: '', y: 1990, m: 1, d: 1 }, { name: 'a'.repeat(50), y: 1990, m: 1, d: 1, hour: 30 }, ...Array.from({ length: 40 }, () => ({ name: 'n', y: 1990, m: 1, d: 1, hour: null, __proto__x: 1 }))]),
    });
    expect(store.loadProfile(s)).toBeNull();
    const book = store.loadBook(s);
    expect(book.length).toBeLessThanOrEqual(store.BOOK_LIMIT);
    expect(book.every((e) => Object.keys(e).every((k) => ['name', 'y', 'm', 'd', 'hour', 'minute'].includes(k)))).toBe(true);
  });

  it('refused storage never throws, and the chart still calculates', () => {
    expect(store.saveProfile(refusing, { y: 1990, m: 1, d: 1, hour: null })).toBe(false);
    expect(store.loadProfile(refusing)).toBeNull();
    expect(store.upsertBook(refusing, 'TA', { y: 1990, m: 1, d: 1, hour: null })).toBeNull();
    expect(store.loadProfile(null)).toBeNull();
    const r = parseBirthForm({ date: '1990-01-01', hour: '7' });
    expect(() => computeRelationshipReport({ schemaVersion: SCHEMA_VERSION, requestId: 'req-priv-0001', A: r.input, B: r.input, config: DEFAULT_CONFIG, scoreModelId: 'rel-six-dim' })).not.toThrow();
  });

  it('keeps an exact minute and renames on re-save instead of duplicating', () => {
    const s = new MemoryStorage();
    store.upsertBook(s, 'A', { y: 1990, m: 1, d: 1, hour: 7, minute: 5 });
    store.upsertBook(s, 'B', { y: 1990, m: 1, d: 1, hour: 7, minute: 5 });
    expect(store.loadBook(s)).toEqual([{ name: 'B', y: 1990, m: 1, d: 1, hour: 7, minute: 5 }]);
  });

  it('forgetting the profile leaves the journal and other site keys alone; delete clears only this page', () => {
    const m = new MemoryStorage({ 'afflatus-horo:me': '{"y":1990,"m":1,"d":1,"hour":null}', [JOURNAL_KEY]: '{"version":1,"records":[]}', 'site:theme': 'dark' });
    store.forgetProfile(m);
    expect(m.getItem(JOURNAL_KEY)).not.toBeNull();
    clearHoroscopeStorage(asStorage(m));
    expect(m.getItem(JOURNAL_KEY)).toBeNull();
    expect(m.getItem('site:theme')).toBe('dark');
  });
});

// Synthetic sentinel birth: distinctive values that would be easy to spot
// in any URL, body or beacon. Never a real person.
const SENTINEL = { date: '1911-11-11', time: '11:11', zone: 'Pacific/Chatham' };
const needles = ['1911-11-11', '1911', '11:11', 'Chatham'];

describe('sentinel birth data never leaves the kernel (G3)', () => {
  const calls = [];
  const saved = {};
  beforeEach(() => {
    calls.length = 0;
    for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Image']) saved[k] = globalThis[k];
    globalThis.fetch = (...a) => { calls.push(['fetch', a]); return Promise.reject(new Error('blocked')); };
    globalThis.XMLHttpRequest = class { open(...a) { calls.push(['xhr', a]); } send(b) { calls.push(['xhr-body', b]); } };
    globalThis.WebSocket = class { constructor(u) { calls.push(['ws', u]); } };
    globalThis.EventSource = class { constructor(u) { calls.push(['sse', u]); } };
    globalThis.Image = class { set src(u) { calls.push(['img', u]); } };
    saved.beacon = globalThis.navigator?.sendBeacon;
    if (globalThis.navigator) globalThis.navigator.sendBeacon = (...a) => { calls.push(['beacon', a]); return true; };
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) if (k !== 'beacon') globalThis[k] = v;
    if (globalThis.navigator && saved.beacon) globalThis.navigator.sendBeacon = saved.beacon;
  });

  it('form parsing, kernel, client fallback and storage make no network call', async () => {
    const A = parseBirthForm({ date: SENTINEL.date, hour: 'exact', exactTime: SENTINEL.time, iana: SENTINEL.zone });
    const B = parseBirthForm({ date: '1912-12-12', hour: '' });
    const request = { schemaVersion: SCHEMA_VERSION, requestId: 'req-sentinel-01', A: A.input, B: B.input, config: DEFAULT_CONFIG, scoreModelId: 'rel-six-dim' };
    const client = createRelationshipsClient({ workerUrl: '/w.js', WorkerCtor: null, loadKernel: async () => ({ computeRelationshipReport }) });
    const report = await client.compute(request);
    store.saveProfile(new MemoryStorage(), A.birth);
    expect(calls).toEqual([]);
    // The report itself carries no raw date, time or zone (the legacy block holds derived pillars only).
    const { legacy, ...rest } = report;
    const text = JSON.stringify(rest) + JSON.stringify({ base: legacy.base, parts: legacy.parts, lenses: legacy.lenses });
    for (const n of needles) expect(text).not.toContain(n);
  });
});
