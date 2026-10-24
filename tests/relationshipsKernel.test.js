import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, ERROR_CODES, RelationshipError, SCHEMA_VERSION, validateComputeRequest, validateReport,
} from '../src/lib/relationships/contract.js';
import { computeRelationshipReport, LEGACY_MODEL } from '../src/lib/relationships/kernel.js';
import { SCORE_MODEL_IDS } from '../src/lib/relationships/scale.js';
import { createRelationshipsClient, handleRelationshipsMessage, newRequestId, WORKER_KIND } from '../src/lib/relationships/client.js';
import { computeBazi } from '../src/lib/bazi.js';
import { synastry } from '../src/lib/horoscopeEngine.js';
import { computeSynastryAstro } from '../src/lib/horoscopeSynthesis.js';
import { crossBranchMatrix } from '../src/lib/synastryBazi.js';

// Synthetic birth data only (v2: no private AB samples in fixtures).
const birth = (localDate, time = { kind: 'unknown' }, extra = {}) => ({ localDate, calendar: 'gregorian', time, ...extra });
const exact = (hhmm) => ({ kind: 'exact', localTime: hhmm, precision: 'minute' });
const slot = (start, end, endDayOffset = 0) => ({ kind: 'range', start, end, endDayOffset });
const request = (A, B, over = {}) => ({
  schemaVersion: SCHEMA_VERSION, requestId: 'req-test-0001', A, B, config: structuredClone(DEFAULT_CONFIG), scoreModelId: SCORE_MODEL_IDS[0], ...over,
});
const codeOf = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };
const factById = (r, id) => r.facts.find((f) => f.id === id);

describe('relationships contract · runtime schema', () => {
  it('accepts a valid request and builds a versioned, cloneable report', () => {
    const r = computeRelationshipReport(request(birth('1990-01-01', exact('12:00')), birth('1992-06-15', slot('07:00', '09:00'))));
    expect(validateReport(r)).toBe(true);
    expect(r.schemaVersion).toBe('2.0.0');
    expect(r.engineVersion).toMatch(/^rel-engine-/);
    expect(r.configVersion).toBe(DEFAULT_CONFIG.configVersion);
    expect(() => structuredClone(r)).not.toThrow();
  });

  it('is deterministic: the same request gives the same report', () => {
    const req = request(birth('1985-03-21', exact('06:45')), birth('1987-11-02'));
    expect(computeRelationshipReport(req)).toEqual(computeRelationshipReport(structuredClone(req)));
  });

  it('never touches DOM, network, storage or the clock', () => {
    const saved = { fetch: globalThis.fetch, now: Date.now };
    const trap = () => { throw new Error('side effect'); };
    globalThis.fetch = trap; Date.now = trap;
    globalThis.localStorage = { getItem: trap, setItem: trap };
    globalThis.document = new Proxy({}, { get: trap });
    try {
      expect(() => computeRelationshipReport(request(birth('2001-09-09', exact('23:30')), birth('1999-12-31', exact('00:10'))))).not.toThrow();
    } finally {
      globalThis.fetch = saved.fetch; Date.now = saved.now;
      delete globalThis.localStorage; delete globalThis.document;
    }
  });

  it.each([
    ['impossible date', { A: birth('2023-02-29') }, ERROR_CODES.DATE_INVALID],
    ['out of range', { A: birth('1899-12-31') }, ERROR_CODES.DATE_OUT_OF_RANGE],
    ['lunar input', { A: { ...birth('1990-01-01'), calendar: 'chinese_lunar' } }, ERROR_CODES.CALENDAR_UNSUPPORTED],
    ['a nickname smuggled into the birth input', { A: { ...birth('1990-01-01'), name: 'x' } }, ERROR_CODES.FIELD_UNEXPECTED],
    ['bad clock time', { A: birth('1990-01-01', exact('24:00')) }, ERROR_CODES.TIME_INVALID],
    ['range ending before it starts', { A: birth('1990-01-01', slot('09:00', '07:00')) }, ERROR_CODES.RANGE_INVALID],
    ['unknown IANA zone', { A: birth('1990-01-01', exact('09:00'), { timezone: 'Mars/Olympus' }) }, ERROR_CODES.TIMEZONE_INVALID],
    ['zone and manual offset together', { A: birth('1990-01-01', exact('09:00'), { timezone: 'Asia/Tokyo', fixedOffset: { minutes: 540, dst: false } }) }, ERROR_CODES.TIMEZONE_CONFLICT],
    ['wrong schema version', { schemaVersion: '1.0.0' }, ERROR_CODES.SCHEMA_VERSION_MISMATCH],
    ['request id that looks like a birthday hash input', { requestId: '1990' }, ERROR_CODES.REQUEST_ID_INVALID],
    ['unknown score model', { scoreModelId: 'legacy-65' }, ERROR_CODES.MODEL_UNSUPPORTED],
    ['unsupported method config', { config: { ...structuredClone(DEFAULT_CONFIG), bazi: { ...DEFAULT_CONFIG.bazi, dayBoundary: '00:00' } } }, ERROR_CODES.CONFIG_UNSUPPORTED],
  ])('rejects %s with an error code', (_, over, code) => {
    const base = request(birth('1990-01-01'), birth('1991-01-01'));
    const req = { ...base, ...over, A: over.A ?? base.A };
    expect(validateComputeRequest(req, SCORE_MODEL_IDS).ok).toBe(false);
    expect(codeOf(() => computeRelationshipReport(req))).toBe(code);
  });

  it('rejects non-objects', () => {
    expect(codeOf(() => computeRelationshipReport(null))).toBe(ERROR_CODES.REQUEST_INVALID);
    expect(codeOf(() => computeRelationshipReport({ ...request(birth('1990-01-01'), birth('1991-01-01')), B: 'x' }))).toBe(ERROR_CODES.REQUEST_INVALID);
  });
});

describe('relationships kernel · module status and unknowns', () => {
  it('unknown time: hour pillar null, Ziwei unsupported, no invented ascendant, overall null', () => {
    const r = computeRelationshipReport(request(birth('1990-05-05', { kind: 'unknown' }, { place: { latitude: 31.23, longitude: 121.47, precision: 'city' } }), birth('1991-07-07', exact('10:00'))));
    expect(factById(r, 'A.bazi.pillar.hour').value).toBeNull();
    expect(factById(r, 'A.bazi.pillar.hour').limitationKeys).toContain('time_unknown');
    expect(factById(r, 'A.western.ascendant').value).toBeNull();
    expect(r.modules.ziwei.status).toBe('unsupported');
    expect(r.modules.bazi.status).toBe('partial');
    expect(r.status).toBe('partial');
    expect(r.overall.value).toBeNull();
    expect(r.facts.some((f) => f.id === 'pair.ziwei.lifePalaces')).toBe(false);
  });

  it('unknown time keeps a Moon sign only when it holds all day, else conflicted (not absent)', () => {
    let conflicted = 0;
    for (let d = 1; d <= 28; d++) {
      const r = computeRelationshipReport(request(birth(`1990-01-${String(d).padStart(2, '0')}`), birth('1992-06-15', exact('07:00'))));
      const moon = factById(r, 'A.western.Moon.sign');
      if (moon.basis === 'conflicted') { conflicted++; expect(moon.value).toBeNull(); expect(moon.limitationKeys).toContain('differs_within_time_window'); }
      else expect(Number.isInteger(moon.value)).toBe(true);
    }
    expect(conflicted).toBeGreaterThan(5); // the Moon changes sign every ~2.5 days
  });

  it('xiu tables are checked (T1299) and computed, but never scored', () => {
    const r = computeRelationshipReport(request(birth('1990-01-01', exact('12:00')), birth('1992-06-15', exact('07:00'))));
    expect(r.modules.xiu.status).toBe('ready');
    expect(factById(r, 'pair.xiu.A_to_B').basis).toBe('computed');
    expect(factById(r, 'A.xiu.natal').limitationKeys).toEqual([]);
    expect(r.rules.some((x) => x.ruleId.startsWith('xiu.') || x.familyId.startsWith('xiu'))).toBe(false);
  });

  it('a leap-month birth keeps the xiu convention marked unverified', () => {
    // 2023-03-25 falls in the leap second lunar month.
    const r = computeRelationshipReport(request(birth('2023-03-25', exact('10:00')), birth('1992-06-15', exact('07:00'))));
    expect(r.modules.xiu).toEqual({ status: 'unverified', reasonKeys: ['leap_month_site_convention'] });
    expect(factById(r, 'A.xiu.natal').basis).toBe('unverified');
    expect(factById(r, 'A.xiu.natal').limitationKeys).toContain('leap_month_site_convention');
    expect(factById(r, 'B.xiu.natal').basis).toBe('computed');
    expect(factById(r, 'pair.xiu.B_to_A').basis).toBe('unverified');
  });

  it('both exact times: bazi, western and ziwei ready', () => {
    const r = computeRelationshipReport(request(birth('1990-01-01', exact('12:00')), birth('1992-06-15', exact('07:30'))));
    expect(r.modules.bazi.status).toBe('ready');
    expect(r.modules.western.status).toBe('ready');
    expect(r.modules.ziwei.status).toBe('ready');
    expect(r.status).toBe('ready');
  });

  it('the report carries no raw birth date, place or nickname', () => {
    const r = computeRelationshipReport(request(birth('1987-06-05', exact('04:03'), { place: { latitude: 12.34, longitude: 56.78, precision: 'coordinate' } }), birth('1988-07-06')));
    const json = JSON.stringify({ ...r, legacy: undefined });
    for (const needle of ['1987-06-05', '04:03', '12.34', '56.78']) expect(json).not.toContain(needle);
  });
});

describe('relationships kernel · legacy outputs', () => {
  it('reproduces the pre-v2 page numbers under the legacy modelId', () => {
    const r = computeRelationshipReport(request(birth('1990-01-01', slot('11:00', '13:00')), birth('1992-06-15', slot('07:00', '09:00'))));
    const me = { y: 1990, m: 1, d: 1, hour: 11 }, other = { y: 1992, m: 6, d: 15, hour: 7 };
    const s = synastry(me, other);
    expect(r.legacy.modelId).toBe(LEGACY_MODEL.modelId);
    expect(r.legacy.modelId).not.toBe(r.overall.modelId);
    expect(r.legacy.base).toBe(s.base);
    expect(r.legacy.matrix.score).toBe(crossBranchMatrix(s.chartA, s.chartB).score);
    expect(r.legacy.astro.score).toBe(computeSynastryAstro({ me, other, baziBase: s.base }).score);
  });
});

describe('bazi exact minute (REL-020)', () => {
  // 2024 立春 at ~16:21 CST by this repo's solver.
  it('an exact minute settles the year across the term instant', () => {
    expect(computeBazi({ y: 2024, m: 2, d: 4, hour: 15, minute: 50 }).year.baziYear).toBe(2023);
    expect(computeBazi({ y: 2024, m: 2, d: 4, hour: 16, minute: 50 }).year.baziYear).toBe(2024);
    expect(computeBazi({ y: 2024, m: 2, d: 4, hour: 15, minute: 50 }).boundaryUnstable).toBeNull();
    expect(computeBazi({ y: 2024, m: 2, d: 4, hour: 16, minute: 25 }).boundaryUnstable?.pillar).toBe('year');
    expect(computeBazi({ y: 2024, m: 2, d: 4, hour: 15 }).boundaryUnstable?.pillar).toBe('year'); // the 15:00 slot still spans it
  });
});

class FakeWorker {
  static instances = [];
  constructor() { this.listeners = { message: [], error: [] }; FakeWorker.instances.push(this); }
  addEventListener(type, fn) { this.listeners[type].push(fn); }
  postMessage(message) { this.message = message; }
  reply(value) { for (const fn of this.listeners.message) fn({ data: { id: this.message.id, ok: true, value } }); }
  terminate() { this.terminated = true; }
}

describe('relationships client · Worker protocol', () => {
  afterEach(() => { FakeWorker.instances = []; });
  const req = request(birth('1990-01-01', exact('12:00')), birth('1992-06-15', exact('07:30')));

  it('sends a v2 compute message and returns the validated report', async () => {
    const client = createRelationshipsClient({ workerUrl: '/w.js', WorkerCtor: FakeWorker });
    const p = client.compute(req);
    const w = FakeWorker.instances[0];
    expect(w.message.kind).toBe(WORKER_KIND);
    expect(w.message.payload).toMatchObject({ type: 'compute', generation: 0 });
    w.reply(handleRelationshipsMessage(w.message.payload, computeRelationshipReport));
    await expect(p).resolves.toMatchObject({ requestId: req.requestId, schemaVersion: '2.0.0' });
  });

  it('clearing private state cancels in-flight work and a late reply cannot come back', async () => {
    const client = createRelationshipsClient({ workerUrl: '/w.js', WorkerCtor: FakeWorker });
    const p = client.compute(req);
    const w = FakeWorker.instances[0];
    expect(client.clearPrivateState()).toBe(1);
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(w.terminated).toBe(true);
    w.reply(handleRelationshipsMessage(w.message.payload, computeRelationshipReport)); // ignored: task already settled
    const p2 = client.compute(req);
    const w2 = FakeWorker.instances[1];
    w2.reply({ ...handleRelationshipsMessage(w2.message.payload, computeRelationshipReport), generation: 0 }); // stale generation
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('maps a worker error reply to a RelationshipError with fields', async () => {
    const client = createRelationshipsClient({ workerUrl: '/w.js', WorkerCtor: FakeWorker });
    const bad = { ...req, A: birth('2023-02-29') };
    const p = client.compute(bad);
    const w = FakeWorker.instances[0];
    w.reply(handleRelationshipsMessage(w.message.payload, computeRelationshipReport));
    await expect(p).rejects.toBeInstanceOf(RelationshipError);
    await expect(p).rejects.toMatchObject({ code: ERROR_CODES.DATE_INVALID, fieldKeys: ['A.localDate'] });
  });

  it('falls back to the same kernel on the main thread when Workers are unavailable', async () => {
    const client = createRelationshipsClient({ workerUrl: '/w.js', WorkerCtor: null, loadKernel: async () => ({ computeRelationshipReport }) });
    const report = await client.compute(req);
    expect(report).toEqual(computeRelationshipReport(req));
  });

  it('request ids are random, not derived from input', () => {
    const a = newRequestId(), b = newRequestId();
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toBe(b);
  });
});
