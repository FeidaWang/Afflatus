import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seatCatalogue } from '../src/lib/electionCatalogue.js';
import { ELECTION_EVENTS } from '../src/lib/electionRules.js';
import {
  GEOGRAPHY_VERSION,
  areaBox,
  areaSummary,
  bindFeatures,
  featureMark,
  findSeat,
  geographyAreas,
  geographyFor,
  geographyGap,
  mapSvg,
  primarySeat,
  seatFeature,
  zoomViewBox,
} from '../src/lib/electionGeography.js';

const DIR = join(process.cwd(), 'public/assets/elections/maps', GEOGRAPHY_VERSION);
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));
const load = (mapId) => JSON.parse(readFileSync(join(DIR, `${mapId}.json`), 'utf8'));

const MAPPED = [
  ['us-2026', 'house', 'us-house', 435, 435],
  ['us-2026', 'senate', 'us-senate', 50, 100],
  ['vic-2026', 'assembly', 'vic-assembly', 88, 88],
  ['vic-2026', 'council', 'vic-council', 8, 40],
  ['nsw-2027', 'assembly', 'nsw-assembly', 93, 93],
];
const seatedOffices = ELECTION_EVENTS.flatMap((event) => event.offices.filter((office) => office.geometry).map((office) => [event.id, office.id]));

describe.each(MAPPED)('%s %s map', (eventId, officeId, mapId, featureCount, seatCount) => {
  const map = load(mapId);
  const seats = seatCatalogue(eventId, officeId);
  const binding = bindFeatures(map.features, seats);

  it('is the map the office declares', () => {
    expect(geographyFor(eventId, officeId).map).toBe(mapId);
    expect(map.version).toBe(GEOGRAPHY_VERSION);
  });

  it('binds every feature and every seat exactly once', () => {
    expect(map.features).toHaveLength(featureCount);
    expect(seats).toHaveLength(seatCount);
    expect(binding.missing).toEqual([]);
    expect(binding.unknown).toEqual([]);
    expect(binding.duplicates).toEqual([]);
    expect(binding.bound).toHaveLength(featureCount);
    expect(binding.bound.flatMap((item) => item.seats)).toHaveLength(seatCount);
  });

  it('has real geometry inside its viewBox', () => {
    const [x, y, width, height] = map.viewBox;
    for (const feature of map.features) {
      expect(feature.d).toMatch(/^M-?\d/);
      expect(feature.d).toMatch(/z$/);
      expect(feature.b[0]).toBeGreaterThanOrEqual(x);
      expect(feature.b[1]).toBeGreaterThanOrEqual(y);
      expect(feature.b[2]).toBeLessThanOrEqual(x + width);
      expect(feature.b[3]).toBeLessThanOrEqual(y + height);
      expect(feature.b[2]).toBeGreaterThan(feature.b[0]);
      expect(feature.b[3]).toBeGreaterThan(feature.b[1]);
    }
  });

  it('matches its manifest entry and stays within the size target', () => {
    const entry = manifest.maps[mapId];
    const text = readFileSync(join(DIR, `${mapId}.json`), 'utf8');
    expect(createHash('sha256').update(text).digest('hex')).toBe(entry.sha256);
    expect(entry.features).toBe(featureCount);
    expect(entry.gzipBytes).toBeLessThan(200 * 1024);
  });

  it('draws one mark per feature with one primary seat and no status colour', () => {
    const svg = mapSvg(map, binding, { label: (seat) => seat.seatId, ariaLabel: 'Map', insetLabel: (code) => code });
    expect(svg.match(/<path class="el-feature/g)).toHaveLength(featureCount);
    expect(svg).not.toContain('style=');
    expect(svg).not.toMatch(/is-(leading|called|final|unavailable)/);
    expect(svg).toContain('data-roving');
  });

  it('every zoom area resolves to a box inside the map', () => {
    for (const area of geographyAreas(eventId, officeId)) {
      const box = areaBox(map, binding, area.id);
      expect(box, area.id).not.toBeNull();
      const view = zoomViewBox(box, map.viewBox);
      expect(view[2] / view[3]).toBeCloseTo(map.viewBox[2] / map.viewBox[3], 1);
      expect(view[0]).toBeGreaterThanOrEqual(map.viewBox[0] - 1);
      expect(view[1]).toBeGreaterThanOrEqual(map.viewBox[1] - 1);
    }
  });
});

describe('versioned manifest', () => {
  it('records provenance for every source', () => {
    for (const source of manifest.sources) {
      expect(source.licence, source.id).toBeTruthy();
      expect(source.boundaryVersion, source.id).toBeTruthy();
      expect(source.electionValidity, source.id).toBeTruthy();
      expect(source.files.length, source.id).toBeGreaterThan(0);
      for (const file of source.files) {
        expect(file.url).toMatch(/^https:\/\//);
        expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(Date.parse(file.fetchedAt)).not.toBeNaN();
      }
    }
  });

  it('takes 49 states from the 120th Congress files and Missouri from its plan in effect', () => {
    const cd120 = manifest.sources.find((source) => source.id === 'census-cd120-2026').files;
    expect(cd120).toHaveLength(49);
    expect(cd120.some((file) => file.url.includes('_29_'))).toBe(false);
    const missouri = manifest.sources.find((source) => source.id === 'census-mo-cd119').files;
    expect(missouri.map((file) => file.url)).toEqual(['https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_29_cd119.zip']);
  });

  it('lists every office without a map as a gap, with no asset behind it', () => {
    for (const [eventId, officeId] of seatedOffices) {
      if (geographyFor(eventId, officeId)) continue;
      expect(geographyGap(eventId, officeId)?.en, `${eventId}/${officeId}`).toMatch(/^No map/);
      expect(manifest.gaps.some((gap) => gap.event === eventId && gap.office === officeId)).toBe(true);
    }
    expect(existsSync(join(DIR, 'au-house.json'))).toBe(false);
    expect(geographyFor('au-2028', 'house')).toBeNull();
    expect(geographyFor('nsw-2027', 'council')).toBeNull();
  });
});

describe('bindFeatures', () => {
  const seats = [
    { seatId: 'A-1', feature: 'A', onBallot: true },
    { seatId: 'A-2', feature: 'A', onBallot: false },
    { seatId: 'B', onBallot: true },
    { seatId: 'C', onBallot: true },
  ];
  const features = (...ids) => ids.map((id) => ({ id, d: 'M0 0l1 0 0 1z', b: [0, 0, 1, 1], c: [0, 0] }));

  it('reports seats with no feature rather than drawing a substitute', () => {
    const { bound, missing } = bindFeatures(features('A', 'B'), seats);
    expect(bound.map((item) => item.feature.id)).toEqual(['A', 'B']);
    expect(missing.map((seat) => seat.seatId)).toEqual(['C']);
  });

  it('never draws a feature twice or a feature with no seat', () => {
    const { bound, duplicates, unknown } = bindFeatures(features('A', 'A', 'B', 'C', 'Z'), seats);
    expect(duplicates).toEqual(['A']);
    expect(unknown).toEqual(['Z']);
    expect(bound).toHaveLength(3);
  });

  it('finds a feature from any seat it holds', () => {
    const binding = bindFeatures(features('A', 'B', 'C'), seats);
    expect(seatFeature(binding, 'A-2').id).toBe('A');
    expect(seatFeature(binding, 'nope')).toBeNull();
  });
});

describe('status on a feature', () => {
  const parties = [{ id: 'dem', color: '#225DA8' }];
  const contest = { seatId: 'FL-S1', onBallot: true };
  const other = { seatId: 'FL-S2', onBallot: false };

  it('selects the contest in a state, not the seat that is not up', () => {
    expect(primarySeat([other, contest])).toBe(contest);
    expect(primarySeat([other])).toBe(other);
  });

  it('shows a state with no contest as not on ballot, even if a state map says otherwise', () => {
    expect(featureMark([other], { 'FL-S2': { status: 'called', party: 'dem' } }, parties).status).toBe('off');
  });

  it('never colours a feature that holds several contests', () => {
    const region = [{ seatId: 'r-1', onBallot: true }, { seatId: 'r-2', onBallot: true }];
    expect(featureMark(region, { 'r-1': { status: 'called', party: 'dem' }, 'r-2': { status: 'called', party: 'dem' } }, parties)).toEqual({ status: 'neutral' });
  });

  it('needs evidence: a party without a known status stays neutral, and only synthetic input gets colour', () => {
    expect(featureMark([contest], {}, parties).status).toBe('neutral');
    expect(featureMark([contest], { 'FL-S1': { status: 'called', party: 'nobody' } }, parties).status).toBe('neutral');
    expect(featureMark([contest], { 'FL-S1': { status: 'final', party: 'dem' } }, parties).status).toBe('called');
    expect(featureMark([contest], { 'FL-S1': { status: 'unavailable' } }, parties).status).toBe('unavailable');
  });

  it('encodes a lead with a hatch and a call with a solid colour', () => {
    const map = { id: 'x', viewBox: [0, 0, 100, 100], features: [{ id: 'FL', d: 'M0 0l1 0 0 1z', b: [0, 0, 1, 1], c: [0, 0] }] };
    const seats = [{ ...contest, feature: 'FL' }, { ...other, feature: 'FL' }];
    const binding = bindFeatures(map.features, seats);
    const render = (state) => mapSvg(map, binding, { states: { 'FL-S1': state }, parties, label: () => 'FL', ariaLabel: 'Map', insetLabel: () => '' });
    expect(render({ status: 'leading', party: 'dem' })).toContain('url(#el-map-hatch-dem)');
    expect(render({ status: 'called', party: 'dem' })).toMatch(/is-called/);
    expect(render({ status: 'called', party: 'dem' })).not.toContain('<pattern');
  });
});

describe('area and zoom', () => {
  it('counts an area without naming a winner', () => {
    const house = seatCatalogue('us-2026', 'house');
    expect(areaSummary(house, 'NY')).toEqual({ seats: 26, contests: 26 });
    const senate = seatCatalogue('us-2026', 'senate');
    expect(areaSummary(senate, 'FL')).toEqual({ seats: 2, contests: 1 });
    expect(areaSummary(senate, 'CA')).toEqual({ seats: 2, contests: 0 });
    expect(Object.keys(areaSummary(house, 'NY')).sort()).toEqual(['contests', 'seats']);
  });

  it('offers states in the US, regions in Victoria and a named viewport in NSW', () => {
    expect(geographyAreas('us-2026', 'house')).toHaveLength(50);
    expect(geographyAreas('vic-2026', 'assembly')).toHaveLength(8);
    expect(geographyAreas('nsw-2027', 'assembly').map((area) => area.id)).toEqual(['sydney']);
    expect(geographyAreas('au-2028', 'house')).toEqual([]);
  });

  it('never zooms out past the map or closer than the minimum', () => {
    const base = [0, 0, 1000, 500];
    expect(zoomViewBox([-100, -100, 2000, 2000], base)).toEqual(base);
    expect(zoomViewBox([500, 250, 501, 251], base)[2]).toBe(40);
  });
});

describe('findSeat', () => {
  const house = seatCatalogue('us-2026', 'house');
  const senate = seatCatalogue('us-2026', 'senate');
  const victoria = seatCatalogue('vic-2026', 'assembly');

  it('matches an id regardless of case and punctuation', () => {
    expect(findSeat(house, 'ny 12').seatId).toBe('NY-12');
    expect(findSeat(house, 'wy-al').seatId).toBe('WY-AL');
  });

  it('reaches a state race from its code, choosing the contest', () => {
    expect(findSeat(senate, 'FL').seatId).toBe('FL-S1');
  });

  it('resolves a name and refuses an ambiguous or unknown one', () => {
    expect(findSeat(victoria, 'Albert Park').seatId).toBe('albert-park');
    expect(findSeat(house, 'CA')).toBeNull();
    expect(findSeat(house, 'nowhere')).toBeNull();
    expect(findSeat(house, '   ')).toBeNull();
  });
});
