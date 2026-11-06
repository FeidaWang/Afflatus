import { describe, expect, it } from 'vitest';
import { ELECTION_EVENTS, PARTIES, officeById, eventById } from '../src/lib/electionRules.js';
import { seatCatalogue } from '../src/lib/electionCatalogue.js';
import {
  bindSeatCatalogue,
  chamberSvg,
  createChamberLayout,
  seatMark,
  tallySeats,
} from '../src/lib/chamberLayout.js';

const chambers = ELECTION_EVENTS.flatMap((event) => event.offices
  .filter((office) => office.geometry)
  .map((office) => [event.id, office.id, office.seats, office.geometry]));

const bound = (eventId, officeId) => bindSeatCatalogue(eventId, officeId, seatCatalogue(eventId, officeId));
const label = (seat, status) => `${seat.seatId} ${status}`;

// Seeded so a failure reproduces.
function shuffled(items, seed = 7) {
  const copy = [...items];
  let value = seed;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    value = (value * 1664525 + 1013904223) % 4294967296;
    const other = value % (index + 1);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

const marks = (svg) => svg.match(/data-seat="[^"]+"/g) || [];
const markFor = (svg, seatId) => svg.match(new RegExp(`<(?:circle|rect)[^>]*data-seat="${seatId}"[^>]*>`))?.[0];

describe('chamber geometry', () => {
  it('covers exactly the eight offices that have a geometry', () => {
    expect(chambers).toHaveLength(8);
    expect(createChamberLayout('us-2028', 'president')).toBeNull();
  });

  describe.each(chambers)('%s %s', (eventId, officeId, seats, geometry) => {
    const layout = createChamberLayout(eventId, officeId);
    const [minX, minY, width, height] = layout.viewBox;

    it('has the exact seat count and the geometry its rule pack names', () => {
      expect(layout.slots).toHaveLength(seats);
      expect(layout.total).toBe(seats);
      expect(layout.kind).toBe(geometry);
    });

    it('has finite coordinates, all inside the viewBox', () => {
      for (const slot of layout.slots) {
        expect(Number.isFinite(slot.x) && Number.isFinite(slot.y) && Number.isFinite(slot.radius)).toBe(true);
        expect(slot.x - slot.radius).toBeGreaterThanOrEqual(minX);
        expect(slot.y - slot.radius).toBeGreaterThanOrEqual(minY);
        expect(slot.x + slot.radius).toBeLessThanOrEqual(minX + width);
        expect(slot.y + slot.radius).toBeLessThanOrEqual(minY + height);
      }
    });

    it('has no overlapping marks', () => {
      const { slots } = layout;
      for (let a = 0; a < slots.length; a += 1) {
        for (let b = a + 1; b < slots.length; b += 1) {
          const gap = Math.hypot(slots[a].x - slots[b].x, slots[a].y - slots[b].y) - slots[a].radius - slots[b].radius;
          expect(gap).toBeGreaterThan(0);
        }
      }
    });

    it('keeps the chair clear and places it at the top centre', () => {
      const { chair } = layout;
      expect(chair.x + chair.width / 2).toBeCloseTo(minX + width / 2, 5);
      expect(chair.y).toBeLessThan(height / 8);
      for (const slot of layout.slots) {
        const inside = slot.x + slot.radius > chair.x && slot.x - slot.radius < chair.x + chair.width
          && slot.y + slot.radius > chair.y && slot.y - slot.radius < chair.y + chair.height;
        expect(inside).toBe(false);
      }
    });

    it('is deterministic', () => {
      expect(createChamberLayout(eventId, officeId)).toEqual(layout);
    });

    it('binds each seatId to one slot whatever order the catalogue arrives in', () => {
      const catalogue = seatCatalogue(eventId, officeId);
      const first = bindSeatCatalogue(eventId, officeId, catalogue);
      const again = bindSeatCatalogue(eventId, officeId, shuffled(catalogue));
      const positions = (result) => result.slots.map((slot) => [slot.seat.seatId, slot.x, slot.y]);
      expect(positions(again)).toEqual(positions(first));
      expect(new Set(first.slots.map((slot) => slot.seat.seatId)).size).toBe(seats);
    });

    it('rejects an incomplete or duplicated catalogue', () => {
      const catalogue = seatCatalogue(eventId, officeId);
      expect(() => bindSeatCatalogue(eventId, officeId, catalogue.slice(1))).toThrow(RangeError);
      expect(() => bindSeatCatalogue(eventId, officeId, [...catalogue.slice(1), catalogue[1]])).toThrow(/Duplicate/);
    });

    it('renders one mark per seat, none hidden, and keeps every total for empty and partial states', () => {
      const result = bound(eventId, officeId);
      const svg = chamberSvg(result, { label, ariaLabel: 'Seats', chairLabel: 'Chair' });
      expect(marks(svg)).toHaveLength(seats);
      expect(new Set(marks(svg)).size).toBe(seats);
      const catalogue = seatCatalogue(eventId, officeId);
      const empty = tallySeats(catalogue);
      expect(empty.total).toBe(seats);
      const party = PARTIES[eventById(eventId).family][0].id;
      const partial = Object.fromEntries(catalogue.slice(0, 5).map((seat) => [seat.seatId, { status: 'called', party }]));
      const counted = tallySeats(catalogue, partial, PARTIES[eventById(eventId).family]);
      expect(counted.total).toBe(seats);
      expect(counted.neutral + counted.off + counted.leading + counted.called + counted.final + counted.unavailable).toBe(seats);
      expect(marks(chamberSvg(result, { states: partial, parties: PARTIES[eventById(eventId).family], label, ariaLabel: 'Seats', chairLabel: 'Chair' }))).toHaveLength(seats);
    });

    it('does not move a seat when its colour changes', () => {
      const result = bound(eventId, officeId);
      const { seatId } = result.slots[0].seat;
      const parties = PARTIES[eventById(eventId).family];
      const position = (svg) => markFor(svg, seatId).match(/(?:cx|x)="[^"]+"/)[0];
      const plain = chamberSvg(result, { label, ariaLabel: 'Seats', chairLabel: 'Chair' });
      const coloured = chamberSvg(result, { states: { [seatId]: { status: 'called', party: parties[0].id } }, parties, label, ariaLabel: 'Seats', chairLabel: 'Chair' });
      expect(position(coloured)).toBe(position(plain));
      expect(marks(coloured)).toEqual(marks(plain));
    });
  });

  it('puts a party letter on every coloured mark big enough to read one, and none on a neutral mark', () => {
    const tag = (party) => party.tag.en;
    for (const [eventId, officeId] of [['vic-2026', 'assembly'], ['us-2026', 'senate']]) {
      const result = bound(eventId, officeId);
      const parties = PARTIES[eventById(eventId).family];
      const [first, second] = result.slots.filter((slot) => slot.seat.onBallot).map((slot) => slot.seat.seatId);
      const states = { [first]: { status: 'called', party: parties[0].id }, [second]: { status: 'leading', party: parties[1].id } };
      const svg = chamberSvg(result, { states, parties, label, ariaLabel: 'Seats', chairLabel: 'Chair', tag });
      const letters = [...svg.matchAll(/<text class="is-(\w+)"[^>]*>([^<]+)<\/text>/g)].map((match) => [match[1], match[2]]);
      expect(letters).toEqual(expect.arrayContaining([['called', parties[0].tag.en], ['leading', parties[1].tag.en]]));
      expect(letters).toHaveLength(2);
      expect(svg).toMatch(/<g class="el-seat-tags" aria-hidden="true"/);
      expect(chamberSvg(result, { label, ariaLabel: 'Seats', chairLabel: 'Chair', tag })).not.toMatch(/<text class="is-/);
    }
    const house = bound('us-2026', 'house');
    const states = { [house.slots[0].seat.seatId]: { status: 'called', party: 'dem' } };
    expect(chamberSvg(house, { states, parties: PARTIES.us, label, ariaLabel: 'Seats', chairLabel: 'Chair', tag })).not.toMatch(/el-seat-tags/);
  });

  it('gives every party a letter in both languages, unique within its family', () => {
    for (const parties of Object.values(PARTIES)) {
      for (const lang of ['en', 'zh']) {
        const letters = parties.map((party) => party.tag[lang]);
        expect(letters.every((letter) => [...letter].length === 1)).toBe(true);
        expect(new Set(letters).size).toBe(parties.length);
      }
    }
  });

  it('gives every chamber its own layout', () => {
    const signatures = chambers.map(([eventId, officeId]) => JSON.stringify(createChamberLayout(eventId, officeId).slots.map((slot) => [slot.x, slot.y])));
    expect(new Set(signatures).size).toBe(chambers.length);
  });

  describe.each(chambers.filter((row) => row[3] === 'fan'))('fan %s %s', (eventId, officeId) => {
    const layout = createChamberLayout(eventId, officeId);

    it('keeps a clear central aisle and at least one secondary aisle on each side', () => {
      const centre = layout.viewBox[2] / 2;
      for (const slot of layout.slots) expect(Math.abs(slot.x - centre) - slot.radius).toBeGreaterThanOrEqual(layout.aisle);
      expect(new Set(layout.slots.map((slot) => slot.section)).size).toBeGreaterThanOrEqual(4);
    });

    it('mirrors left and right, apart from the one mark an odd total cannot pair', () => {
      const centre = layout.viewBox[2] / 2;
      const left = layout.slots.filter((slot) => slot.x < centre).length;
      expect(layout.total - 2 * left).toBe(layout.total % 2);
    });

    it('curves around the rostrum with no straight benches', () => {
      for (const row of new Set(layout.slots.map((slot) => slot.row))) {
        const radii = layout.slots.filter((slot) => slot.row === row).map((slot) => Math.hypot(slot.x - layout.viewBox[2] / 2, slot.y - layout.centreY));
        expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.1);
      }
    });
  });

  describe.each(chambers.filter((row) => row[3] === 'horseshoe'))('horseshoe %s %s', (eventId, officeId) => {
    const layout = createChamberLayout(eventId, officeId);

    it('has straight benches down both sides and a curve below them', () => {
      const centre = layout.viewBox[2] / 2;
      const benches = layout.slots.filter((slot) => slot.section !== 1);
      const curve = layout.slots.filter((slot) => slot.section === 1);
      expect(curve.length).toBeGreaterThan(0);
      expect(benches.some((slot) => slot.x < centre)).toBe(true);
      expect(benches.some((slot) => slot.x > centre)).toBe(true);
      for (const row of new Set(benches.map((slot) => slot.row))) {
        const left = benches.filter((slot) => slot.row === row && slot.section === 0);
        expect(new Set(left.map((slot) => slot.x)).size).toBe(1);
      }
      expect(Math.max(...curve.map((slot) => slot.y))).toBeGreaterThan(Math.max(...benches.map((slot) => slot.y)));
    });

    it('mirrors its benches, which line up from row to row', () => {
      const centre = layout.viewBox[2] / 2;
      const bench = (section) => layout.slots.filter((slot) => slot.section === section);
      expect(bench(0).length).toBe(bench(2).length);
      const heights = (section) => [...new Set(bench(section).map((slot) => slot.y))].sort((a, b) => a - b);
      expect(heights(0)).toEqual(heights(2));
      expect(heights(0)).toHaveLength(layout.benchSeats);
      const key = (slot, x) => `${x}/${slot.y}`;
      expect(new Set(bench(0).map((slot) => key(slot, Math.round(centre - slot.x))))).toEqual(new Set(bench(2).map((slot) => key(slot, Math.round(slot.x - centre)))));
    });
  });
});

describe('US Senate 2026', () => {
  const catalogue = seatCatalogue('us-2026', 'senate');
  const parties = PARTIES.us;

  it('shows 100 marks: 35 on the ballot and 65 not, with no seat counted twice', () => {
    const tally = tallySeats(catalogue);
    expect(tally).toMatchObject({ total: 100, neutral: 35, off: 65 });
    const svg = chamberSvg(bound('us-2026', 'senate'), { label, ariaLabel: 'Seats', chairLabel: 'Chair' });
    expect(svg.match(/is-neutral/g)).toHaveLength(35);
    expect(svg.match(/is-off/g)).toHaveLength(65);
    expect(new Set(marks(svg)).size).toBe(100);
  });

  it('never gives a result to a seat that is not on the ballot', () => {
    const off = catalogue.find((seat) => !seat.onBallot);
    const states = { [off.seatId]: { status: 'called', party: 'dem' } };
    expect(seatMark(off, states[off.seatId], parties).status).toBe('off');
    expect(tallySeats(catalogue, states, parties)).toMatchObject({ total: 100, called: 0, off: 65 });
  });

  it('draws desk marks, where the House draws dots', () => {
    const senate = chamberSvg(bound('us-2026', 'senate'), { label, ariaLabel: 'Seats', chairLabel: 'Chair' });
    const house = chamberSvg(bound('us-2026', 'house'), { label, ariaLabel: 'Seats', chairLabel: 'Chair' });
    expect(markFor(senate, 'AL-S1')).toMatch(/^<rect/);
    expect(markFor(house, 'AL-01')).toMatch(/^<circle/);
  });
});

// Synthetic input. These states exist only in this file: the page always passes an empty map.
describe('seat states', () => {
  const parties = PARTIES.au;
  const seat = { seatId: 'albert-park', onBallot: true };
  const result = bound('vic-2026', 'assembly');
  const render = (state) => chamberSvg(result, { states: { 'albert-park': state }, parties, label, ariaLabel: 'Seats', chairLabel: 'Chair' });

  it('defaults to neutral, with no colour and no pattern', () => {
    const svg = chamberSvg(result, { label, ariaLabel: 'Seats', chairLabel: 'Chair' });
    expect(svg).not.toMatch(/style=|<pattern|--seat/);
    expect(svg.match(/is-neutral/g)).toHaveLength(88);
    expect(seatMark(seat, undefined, parties)).toEqual({ status: 'neutral' });
  });

  it('draws a lead as a party outline with a hatch, not a solid fill', () => {
    const svg = render({ status: 'leading', party: 'labor' });
    expect(markFor(svg, 'albert-park')).toMatch(/is-leading/);
    expect(markFor(svg, 'albert-park')).toMatch(/--seat:#C8302E/);
    expect(markFor(svg, 'albert-park')).toMatch(/--seat-fill:url\(#el-hatch-labor\)/);
    expect(svg).toMatch(/<pattern id="el-hatch-labor"/);
  });

  it('draws a call as a solid party fill with no pattern', () => {
    const svg = render({ status: 'called', party: 'greens' });
    expect(markFor(svg, 'albert-park')).toMatch(/is-called/);
    expect(markFor(svg, 'albert-park')).toMatch(/--seat:#4C8A1F/);
    expect(svg).not.toMatch(/<pattern/);
  });

  it('treats a final result as final only with a record', () => {
    expect(seatMark(seat, { status: 'final', party: 'labor', record: 'https://example.test/declared' }, parties).status).toBe('final');
    expect(seatMark(seat, { status: 'final', party: 'labor' }, parties).status).toBe('called');
    const svg = render({ status: 'final', party: 'labor', record: 'https://example.test/declared' });
    expect(markFor(svg, 'albert-park')).toMatch(/is-final/);
    expect(markFor(svg, 'albert-park')).toMatch(/data-record/);
    expect(svg).not.toContain('example.test');
  });

  it('draws an unavailable source as hollow, with no party', () => {
    const svg = render({ status: 'unavailable' });
    expect(markFor(svg, 'albert-park')).toMatch(/is-unavailable/);
    expect(markFor(svg, 'albert-park')).not.toMatch(/style=/);
  });

  it('stays neutral without a known party or status, rather than guessing', () => {
    expect(seatMark(seat, { status: 'called' }, parties).status).toBe('neutral');
    expect(seatMark(seat, { status: 'called', party: 'unknown-party' }, parties).status).toBe('neutral');
    expect(seatMark(seat, { status: 'won', party: 'labor' }, parties).status).toBe('neutral');
  });

  it('ignores states for seats outside the catalogue', () => {
    const catalogue = seatCatalogue('vic-2026', 'assembly');
    expect(tallySeats(catalogue, { 'CA-12': { status: 'called', party: 'labor' } }, parties)).toMatchObject({ total: 88, neutral: 88, called: 0 });
  });

  it('labels each mark through the supplied function with its resolved status', () => {
    const svg = render({ status: 'called', party: 'labor' });
    expect(markFor(svg, 'albert-park')).toContain('aria-label="albert-park called"');
    expect(markFor(svg, 'ashwood')).toContain('aria-label="ashwood neutral"');
  });
});

describe('rule packs and layouts agree', () => {
  it('uses the seat count from each rule pack', () => {
    for (const [eventId, officeId] of chambers.map((row) => row.slice(0, 2))) {
      expect(createChamberLayout(eventId, officeId).total).toBe(officeById(eventById(eventId), officeId).seats);
    }
  });
});
