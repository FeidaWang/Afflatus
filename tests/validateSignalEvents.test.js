import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateSignalEvents } from '../src/lib/validateSignalEvents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadRealFixture() {
  const raw = readFileSync(path.join(__dirname, '..', 'public', 'signal-events.json'), 'utf8');
  return JSON.parse(raw);
}

function validPillar(id) {
  return {
    id, key: 'inflation_data',
    name_en: 'x', name_zh: 'x', status_en: 'x', status_zh: 'x', tone: 'green',
    read_en: 'x', read_zh: 'x', asOf: '2026-07-01',
  };
}

function validHawkDove() {
  return {
    score: 1, label_en: 'x', label_zh: 'x', rationale_en: 'x', rationale_zh: 'x',
    method_en: 'x', method_zh: 'x', asOf: '2026-07-01',
  };
}

function minimalValidDoc() {
  return {
    updated: '2026-07-04', version: 2, as_of: '2026-07-04',
    hawkDoveCompass: validHawkDove(),
    pillarSummary: { en: 'x', zh: 'x' },
    pillars: [1, 2, 3, 4, 5].map(validPillar),
    events: [],
  };
}

describe('validateSignalEvents', () => {
  it('accepts the real shipped signal-events.json (V6 fixture)', () => {
    const { ok, errors } = validateSignalEvents(loadRealFixture());
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('accepts a minimal well-formed doc with zero events', () => {
    const { ok } = validateSignalEvents(minimalValidDoc());
    expect(ok).toBe(true);
  });

  it('rejects the v1 bare-array top-level shape', () => {
    const { ok, errors } = validateSignalEvents([{ id: 'x' }]);
    expect(ok).toBe(false);
    expect(errors[0]).toMatch(/must be an object/);
  });

  it('rejects a hawkDoveCompass.score out of [-2, 2] range', () => {
    const doc = minimalValidDoc();
    doc.hawkDoveCompass.score = 3.5;
    const { ok, errors } = validateSignalEvents(doc);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('hawkDoveCompass.score'))).toBe(true);
  });

  it('rejects wrong pillar count (must be exactly 5)', () => {
    const doc = minimalValidDoc();
    doc.pillars.pop();
    const { ok, errors } = validateSignalEvents(doc);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('pillars'))).toBe(true);
  });

  it('rejects duplicate pillar ids', () => {
    const doc = minimalValidDoc();
    doc.pillars[4].id = doc.pillars[0].id;
    const { ok, errors } = validateSignalEvents(doc);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('unique'))).toBe(true);
  });

  it('rejects an invalid pillar tone', () => {
    const doc = minimalValidDoc();
    doc.pillars[0].tone = 'purple';
    const { ok, errors } = validateSignalEvents(doc);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('tone'))).toBe(true);
  });

  it('rejects duplicate event ids', () => {
    const doc = minimalValidDoc();
    const event = {
      id: 'INCIDENT-2026-DUP', date: '2026-07-04', pillar: 1, hawkDove: 0,
      name: { en: 'x', zh: 'x' },
    };
    doc.events = [event, { ...event }];
    const { ok, errors } = validateSignalEvents(doc);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('duplicate id'))).toBe(true);
  });

  it('rejects an event with hawkDove out of range', () => {
    const doc = minimalValidDoc();
    doc.events = [{
      id: 'INCIDENT-2026-X', date: '2026-07-04', pillar: 1, hawkDove: 9,
      name: { en: 'x', zh: 'x' },
    }];
    const { ok, errors } = validateSignalEvents(doc);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('hawkDove'))).toBe(true);
  });

  it('allows event.hawkDove and event.pillar to be null (legacy events like INCIDENT-2026-NFP-06)', () => {
    const doc = minimalValidDoc();
    doc.events = [{
      id: 'INCIDENT-2026-NFP-06', date: '2026-07-02', pillar: 1, hawkDove: null,
      name: { en: 'x', zh: 'x' },
    }];
    const { ok } = validateSignalEvents(doc);
    expect(ok).toBe(true);
  });

  it('rejects a missing bilingual field on an event sub-object', () => {
    const doc = minimalValidDoc();
    doc.events = [{
      id: 'INCIDENT-2026-Y', date: '2026-07-04', pillar: 1, hawkDove: 0,
      name: { en: 'x', zh: 'x' },
      before: { en: 'x' }, // missing zh
    }];
    const { ok, errors } = validateSignalEvents(doc);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('before.zh'))).toBe(true);
  });

  it('rejects version !== 2', () => {
    const doc = minimalValidDoc();
    doc.version = 1;
    const { ok, errors } = validateSignalEvents(doc);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('version'))).toBe(true);
  });
});
