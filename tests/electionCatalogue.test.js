import { describe, expect, it } from 'vitest';
import { ELECTION_EVENTS } from '../src/lib/electionRules.js';
import { seatCatalogue, sortSeats } from '../src/lib/electionCatalogue.js';

const seatedOffices = ELECTION_EVENTS.flatMap((event) => event.offices
  .filter((office) => office.geometry)
  .map((office) => [event.id, office.id, office.seats]));

describe('seat catalogues', () => {
  it.each(seatedOffices)('%s %s lists exactly its seats with unique ids', (eventId, officeId, seats) => {
    const catalogue = seatCatalogue(eventId, officeId);
    expect(catalogue).toHaveLength(seats);
    expect(new Set(catalogue.map((seat) => seat.seatId)).size).toBe(seats);
  });

  it('gives each 2026 Senate contest its class and term, and no term to seats off the ballot', () => {
    const onBallot = seatCatalogue('us-2026', 'senate').filter((seat) => seat.onBallot);
    expect(onBallot).toHaveLength(35);
    expect(onBallot.filter((seat) => seat.contest === 'regular').every((seat) => seat.senateClass === 2 && seat.term === '2027-2033')).toBe(true);
    expect(onBallot.filter((seat) => seat.contest === 'special').map((seat) => [seat.seatId, seat.senateClass, seat.term])).toEqual([
      ['FL-S1', 3, 'to-2029-01-03'],
      ['OH-S1', 3, 'to-2029-01-03'],
    ]);
    expect(seatCatalogue('us-2026', 'senate').filter((seat) => !seat.onBallot).every((seat) => seat.term === null)).toBe(true);
  });

  it('derives US House ids from apportionment, with at-large seats named', () => {
    const house = seatCatalogue('us-2026', 'house');
    const ids = house.map((seat) => seat.seatId);
    expect(ids).toContain('CA-52');
    expect(ids).not.toContain('CA-53');
    expect(ids).toContain('WY-AL');
    expect(new Set(house.map((seat) => seat.group)).size).toBe(50);
  });

  it('puts exactly 35 US Senate seats on the 2026 ballot, 2 of them special, and keeps all 100 visible', () => {
    const senate = seatCatalogue('us-2026', 'senate');
    const onBallot = senate.filter((seat) => seat.onBallot);
    expect(senate).toHaveLength(100);
    expect(onBallot).toHaveLength(35);
    expect(onBallot.filter((seat) => seat.contest === 'special').map((seat) => seat.group).sort()).toEqual(['FL', 'OH']);
    // No state may count the same seat twice for one term.
    expect(new Set(onBallot.map((seat) => seat.group)).size).toBe(35);
  });

  it('marks electorates with no verified list as placeholders rather than naming them from memory', () => {
    for (const [eventId, officeId] of [['nsw-2027', 'council'], ['au-2028', 'house'], ['au-2028', 'senate']]) {
      const catalogue = seatCatalogue(eventId, officeId);
      expect(catalogue.every((seat) => seat.placeholder && seat.group === null)).toBe(true);
    }
    expect(seatCatalogue('au-2028', 'house')[0].label.en).toBe('Seat 001');
  });

  it.each([['nsw-2027', 'council', 42, 21], ['au-2028', 'senate', 76, 40]])('draws all %s %s seats but puts only the ones up on the ballot', (eventId, officeId, total, up) => {
    const catalogue = seatCatalogue(eventId, officeId);
    expect(catalogue).toHaveLength(total);
    expect(catalogue.filter((seat) => seat.onBallot)).toHaveLength(up);
    expect(catalogue.filter((seat) => !seat.onBallot).every((seat) => seat.seatId.startsWith('continuing-'))).toBe(true);
    expect(new Set(catalogue.map((seat) => seat.seatId)).size).toBe(total);
  });

  it.each([['vic-2026', 'assembly'], ['nsw-2027', 'assembly']])('names %s %s from the official boundary file', (eventId, officeId) => {
    const catalogue = seatCatalogue(eventId, officeId);
    expect(catalogue.every((seat) => !seat.placeholder && seat.onBallot)).toBe(true);
    expect(catalogue.every((seat) => /^[A-Z]/.test(seat.label.en) && !/\bDistrict\b/.test(seat.label.en))).toBe(true);
    expect(catalogue.every((seat) => /^[a-z0-9-]+$/.test(seat.seatId))).toBe(true);
    expect(catalogue.map((seat) => seat.label.en)).toEqual(catalogue.map((seat) => seat.label.en).sort());
  });

  it('title-cases NSW names, which the service publishes in upper case', () => {
    const names = seatCatalogue('nsw-2027', 'assembly').map((seat) => seat.label.en);
    expect(names).toContain('The Entrance');
    expect(names.filter((name) => name === name.toUpperCase())).toEqual([]);
  });

  it('gives each of the eight Victorian regions five members', () => {
    const council = seatCatalogue('vic-2026', 'council');
    const counts = new Map();
    for (const seat of council) counts.set(seat.feature, (counts.get(seat.feature) || 0) + 1);
    expect(counts.size).toBe(8);
    expect([...counts.values()].every((count) => count === 5)).toBe(true);
  });

  it('holds no result fields', () => {
    const banned = ['winner', 'leader', 'party', 'votes', 'margin', 'candidates', 'candidate'];
    for (const [eventId, officeId] of seatedOffices) {
      for (const seat of seatCatalogue(eventId, officeId)) {
        for (const key of banned) expect(seat).not.toHaveProperty(key);
      }
    }
  });

  it('is empty for an office with no seat view yet', () => {
    expect(seatCatalogue('us-2028', 'president')).toEqual([]);
  });
});

describe('sortSeats', () => {
  const seats = seatCatalogue('us-2026', 'senate');
  const status = (seat) => (seat.onBallot ? 'a' : 'b');

  it('keeps catalogue order for equal keys and reverses on demand', () => {
    const sorted = sortSeats(seats, 'status', 'asc', status);
    const onBallot = sorted.filter((seat) => seat.onBallot);
    expect(sorted.slice(0, 35)).toEqual(onBallot);
    expect(onBallot).toEqual(seats.filter((seat) => seat.onBallot));
    expect(sortSeats(seats, 'seat', 'desc', status)[0]).toBe(seats.at(-1));
  });

  it('does not mutate the catalogue', () => {
    const before = [...seats];
    sortSeats(seats, 'group', 'desc', status);
    expect(seats).toEqual(before);
  });
});
