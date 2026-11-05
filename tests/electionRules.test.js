import { describe, expect, it } from 'vitest';
import {
  ELECTION_EVENTS,
  PARTIES,
  daysUntil,
  eventById,
  eventPhase,
  nextEvent,
  officeById,
  railPositions,
  statusVocabulary,
} from '../src/lib/electionRules.js';

const at = (iso) => new Date(iso);
const NOV_4 = at('2026-11-04T10:00:00+11:00');

describe('election rule packs', () => {
  it('carries the five events in date order', () => {
    expect(ELECTION_EVENTS.map((event) => event.id)).toEqual(['us-2026', 'vic-2026', 'nsw-2027', 'au-2028', 'us-2028']);
    const dates = ELECTION_EVENTS.map((event) => event.sortDate);
    expect(dates).toEqual([...dates].sort());
  });

  it.each([
    ['us-2026', 'house', 435, 218, 'fan'],
    ['us-2026', 'senate', 100, 51, 'fan'],
    ['vic-2026', 'assembly', 88, 45, 'horseshoe'],
    ['vic-2026', 'council', 40, 21, 'horseshoe'],
    ['nsw-2027', 'assembly', 93, 47, 'horseshoe'],
    ['nsw-2027', 'council', 42, 22, 'horseshoe'],
    ['au-2028', 'house', 150, 76, 'horseshoe'],
    ['au-2028', 'senate', 76, 39, 'horseshoe'],
    ['us-2028', 'president', 538, 270, null],
  ])('%s %s has %i seats, %i for majority', (eventId, officeId, seats, majority, geometry) => {
    const office = officeById(eventById(eventId), officeId);
    expect(office.seats).toBe(seats);
    expect(office.majority).toBe(majority);
    expect(office.geometry).toBe(geometry);
    expect(office.majority).toBe(Math.floor(seats / 2) + 1);
  });

  it('reverses the red and blue meaning between the US and Australia', () => {
    const color = (family, id) => PARTIES[family].find((party) => party.id === id).color;
    expect(color('us', 'rep')).toBe('#A73D3A');
    expect(color('us', 'dem')).toBe('#225DA8');
    expect(color('au', 'labor')).toBe('#C8302E');
    expect(color('au', 'coalition')).toBe('#1F4E9C');
    expect(color('au', 'greens')).toBe('#4C8A1F');
    expect(color('au', 'teal')).toBe('#0F8FA6');
    expect(color('au', 'other')).toBe('#7B4FB0');
  });

  it('keeps separate status vocabularies and names the declaring authority', () => {
    expect(statusVocabulary(eventById('us-2026')).final.en).toBe('Certified');
    expect(statusVocabulary(eventById('vic-2026')).final.en).toBe('Declared by VEC');
    expect(statusVocabulary(eventById('au-2028')).final.zh).toBe('由 AEC 正式宣布');
    expect(statusVocabulary(eventById('au-2028')).called.en).toBe('Media projection');
    expect(statusVocabulary(eventById('us-2026')).called.en).toBe('Called by provider');
  });

  it('never lists an enabled feed', () => {
    for (const event of ELECTION_EVENTS) expect(event.feed.en).toMatch(/not connected|No feed connected/);
  });
});

describe('election calendar', () => {
  it('counts 24 days from 4 November to Victoria', () => {
    expect(daysUntil(eventById('vic-2026'), NOV_4)).toBe(24);
  });

  it('uses the Melbourne calendar day, not UTC', () => {
    // 23:30 UTC on 4 Nov is already 5 Nov in Melbourne.
    expect(daysUntil(eventById('vic-2026'), at('2026-11-04T23:30:00Z'))).toBe(23);
  });

  it('has no countdown for an event with no announced date', () => {
    expect(daysUntil(eventById('au-2028'), NOV_4)).toBeNull();
    expect(eventPhase(eventById('au-2028'), NOV_4)).toBe('undated');
  });

  it('treats the US midterms as past and Victoria as next', () => {
    expect(eventPhase(eventById('us-2026'), NOV_4)).toBe('past');
    expect(nextEvent(NOV_4).id).toBe('vic-2026');
  });

  it('moves on from Victoria when its polls close at 18:00 AEDT', () => {
    expect(nextEvent(at('2026-11-28T17:59:00+11:00')).id).toBe('vic-2026');
    expect(nextEvent(at('2026-11-28T18:00:00+11:00')).id).toBe('nsw-2027');
  });

  it('moves on from NSW when its polls close on 13 March 2027, per the NSW Electoral Commission', () => {
    expect(nextEvent(at('2027-03-13T17:59:00+11:00')).id).toBe('nsw-2027');
    expect(nextEvent(at('2027-03-13T18:00:00+11:00')).id).toBe('au-2028');
  });

  it('falls through an undated event in order and ends after the last one', () => {
    expect(nextEvent(at('2027-04-01T00:00:00Z')).id).toBe('au-2028');
    expect(nextEvent(at('2028-11-09T00:00:00Z'))).toBeNull();
  });

  it('places NOW between the last past event and the next one', () => {
    const { stops, nowLeft } = railPositions(NOV_4);
    expect(stops.map((stop) => stop.left)).toEqual([10, 30, 50, 70, 90]);
    expect(nowLeft).toBe(20);
  });
});
