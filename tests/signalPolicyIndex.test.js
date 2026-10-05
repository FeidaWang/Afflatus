import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterSignalRecords, nextSignalReleases, signalEvidenceAge } from '../src/lib/signalIndexModel.js';
import { validateSignalEvents } from '../src/lib/validateSignalEvents.js';

const data = JSON.parse(readFileSync('public/signal-events.json', 'utf8'));

describe('bilingual policy research collection', () => {
  it('covers every released 2026 FOMC decision and available minutes', () => {
    const decisions = data.events.filter(event => event.rate).sort((a, b) => a.date.localeCompare(b.date));
    expect(decisions.map(event => event.date)).toEqual(['2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16']);
    expect(data.events.filter(event => event.id.startsWith('FED-MINUTES-'))).toHaveLength(5);
    expect(data.overview.policyRate).toMatchObject({ lower: 3.75, upper: 4, date: '2026-09-16' });
    expect(validateSignalEvents(data)).toEqual({ ok: true, errors: [] });
  });

  it('intersects topic, month, sector and bilingual search', () => {
    const records = filterSignalRecords(data.events, { topic: 'fed', month: '2026-09', industry: 'power', query: 'Cook' });
    expect(records.map(event => event.id)).toEqual(['COOK-AI-2026-09-28']);
    expect(filterSignalRecords(data.events, { query: '额外首年' }).map(event => event.id)).toContain('IRS-DEPRECIATION-2026-01-14');
    expect(filterSignalRecords(data.events, { query: 'Cook 电力' }).map(event => event.id)).toContain('COOK-AI-2026-09-28');
    expect(filterSignalRecords(data.events, { topic: 'fiscal', month: '2026-10' })).toEqual([]);
  });

  it('returns newest records first without changing the source collection', () => {
    const copy = structuredClone(data.events).reverse();
    const initial = copy.map(event => event.id);
    const records = filterSignalRecords(copy, { query: '  FEDERAL   reserve  ' });
    expect(records[0].date).toBe('2026-10-01');
    expect(copy.map(event => event.id)).toEqual(initial);
  });

  it('expires research freshness and removes past release dates', () => {
    expect(signalEvidenceAge('2026-10-05', new Date('2026-10-12T09:00:00Z'))).toBe('reviewed');
    expect(signalEvidenceAge('2026-10-05', new Date('2026-10-14T09:00:00Z'))).toBe('stale');
    expect(signalEvidenceAge('invalid')).toBe('unknown');
    expect(nextSignalReleases(data.schedule, '2026-10-08').map(item => item.date)).toEqual(['2026-10-28', '2026-12-09']);
    expect(nextSignalReleases(data.schedule, '2027-01-01')).toEqual([]);
  });

  it('blocks a stale policy rate from being presented as the latest decision', () => {
    const candidate = structuredClone(data);
    candidate.overview.policyRate.upper = 3.75;
    expect(validateSignalEvents(candidate).errors).toContain('overview.policyRate: must match the latest recorded decision');
  });

  it('blocks future event facts, unknown status and unsupported sector tags', () => {
    const candidate = structuredClone(data);
    candidate.events[0].date = '2026-10-07';
    candidate.events[0].status = 'guaranteed';
    candidate.events[0].sectors = ['unverified'];
    const result = validateSignalEvents(candidate);
    expect(result.ok).toBe(false);
    expect(result.errors.some(error => error.includes('verified coverage period'))).toBe(true);
    expect(result.errors.some(error => error.includes('unknown policy status'))).toBe(true);
    expect(result.errors.some(error => error.includes('known industries'))).toBe(true);
  });

  it('reports malformed index data without throwing', () => {
    const candidate = structuredClone(data);
    candidate.events = {};
    candidate.schedule = [null];
    expect(validateSignalEvents(candidate).ok).toBe(false);
  });

  it('preserves provenance and separates a proposal from an implemented decision', () => {
    const framework = data.events.find(event => event.id === 'WH-AI-FRAMEWORK-2026-03-20');
    expect(framework.status).toBe('proposal');
    expect(framework.industryTransmission.en).toContain('not enacted law');
    expect(data.events.every(event => event.source.startsWith('https://') && event.name.zh && event.industryTransmission.zh)).toBe(true);
    expect(data.events.find(event => event.id === 'NFP-2026-07').source).toContain('/archives/empsit_08072026.htm');
  });
});
