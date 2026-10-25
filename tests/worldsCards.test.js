import { describe, it, expect } from 'vitest';
import {
  PICKS_KEY,
  cardState,
  choose,
  reveal,
  agreement,
  userRecord,
  fableRecord,
  rarity,
  loadPicks,
  savePicks,
} from '../src/lib/worldsCards.js';

const KICKOFF = '2026-10-26T18:00:00Z';
const BEFORE = Date.parse('2026-10-26T12:00:00Z');
const AFTER = Date.parse('2026-10-26T18:00:00Z');

function series(overrides = {}) {
  return {
    id: 'r3-gen-lyon',
    stage: 'swiss',
    round: 3,
    bo: 1,
    kickoff: KICKOFF,
    home: 'GEN',
    away: 'LYON',
    pick: { side: 'home', pWin: [0.8, 0.2], score: '1-0', pScore: 0.8, oddsImplied: [1.25, 5], adj: 0, decidedAt: '2026-10-26T00:00:00Z' },
    missed: false,
    market: null,
    result: null,
    ...overrides,
  };
}

describe('worldsCards', () => {
  it('exports the storage key', () => {
    expect(PICKS_KEY).toBe('afflatus-worlds:picks:v1');
  });

  describe('cardState', () => {
    it('is pick before kickoff with no entry', () => {
      expect(cardState(series(), undefined, BEFORE)).toBe('pick');
      expect(cardState(series(), undefined, new Date(BEFORE))).toBe('pick');
    });
    it('is ready with an unrevealed entry and revealed after reveal', () => {
      expect(cardState(series(), { side: 'home', pickedAt: 'x', revealed: false }, BEFORE)).toBe('ready');
      expect(cardState(series(), { side: 'home', pickedAt: 'x', revealed: true }, BEFORE)).toBe('revealed');
    });
    it('locks as missed after kickoff with no entry', () => {
      expect(cardState(series(), undefined, AFTER)).toBe('locked-missed');
    });
    it('keeps ready/revealed after kickoff when an entry exists', () => {
      expect(cardState(series(), { side: 'home', revealed: false }, AFTER)).toBe('ready');
      expect(cardState(series(), { side: 'home', revealed: true }, AFTER)).toBe('revealed');
    });
    it('result wins over everything', () => {
      const s = series({ result: { home: 1, away: 0, games: [] } });
      expect(cardState(s, undefined, AFTER)).toBe('result');
      expect(cardState(s, { side: 'home', revealed: true }, AFTER)).toBe('result');
    });
  });

  describe('choose / reveal', () => {
    it('adds an entry before kickoff without mutating input', () => {
      const picks = {};
      const next = choose(picks, series(), 'away', BEFORE);
      expect(next).not.toBe(picks);
      expect(picks).toEqual({});
      expect(next['r3-gen-lyon']).toEqual({ side: 'away', pickedAt: new Date(BEFORE).toISOString(), revealed: false });
    });
    it('accepts a Date for now', () => {
      const next = choose({}, series(), 'home', new Date(BEFORE));
      expect(next['r3-gen-lyon'].pickedAt).toBe(new Date(BEFORE).toISOString());
    });
    it('allows re-choosing before reveal', () => {
      const a = choose({}, series(), 'home', BEFORE);
      const b = choose(a, series(), 'away', BEFORE + 1000);
      expect(b['r3-gen-lyon'].side).toBe('away');
      expect(a['r3-gen-lyon'].side).toBe('home');
    });
    it('is a no-op at or after kickoff', () => {
      const picks = {};
      expect(choose(picks, series(), 'home', AFTER)).toBe(picks);
      expect(choose(picks, series(), 'home', AFTER + 1)).toBe(picks);
    });
    it('is a no-op for an invalid side', () => {
      const picks = {};
      expect(choose(picks, series(), 'draw', BEFORE)).toBe(picks);
    });
    it('is a no-op once revealed', () => {
      const picks = reveal(choose({}, series(), 'home', BEFORE), 'r3-gen-lyon');
      expect(choose(picks, series(), 'away', BEFORE)).toBe(picks);
    });
    it('choose then reveal → revealed state', () => {
      const picks = reveal(choose({}, series(), 'home', BEFORE), 'r3-gen-lyon');
      expect(picks['r3-gen-lyon'].revealed).toBe(true);
      expect(cardState(series(), picks['r3-gen-lyon'], BEFORE)).toBe('revealed');
    });
    it('reveal without an entry returns the same map', () => {
      const picks = {};
      expect(reveal(picks, 'r3-gen-lyon')).toBe(picks);
    });
    it('reveal does not mutate the input map', () => {
      const picks = choose({}, series(), 'home', BEFORE);
      const next = reveal(picks, 'r3-gen-lyon');
      expect(next).not.toBe(picks);
      expect(picks['r3-gen-lyon'].revealed).toBe(false);
    });
  });

  describe('agreement', () => {
    it('compares user side with Fable side', () => {
      expect(agreement(series(), { side: 'home' })).toBe('agree');
      expect(agreement(series(), { side: 'away' })).toBe('disagree');
    });
    it('is null without a pick or without an entry', () => {
      expect(agreement(series({ pick: null }), { side: 'home' })).toBeNull();
      expect(agreement(series(), undefined)).toBeNull();
    });
  });

  describe('userRecord', () => {
    const list = [
      series({ id: 'a', kickoff: '2026-10-20T18:00:00Z', result: { home: 1, away: 0, games: [] } }),
      series({ id: 'b', kickoff: '2026-10-21T18:00:00Z', result: { home: 0, away: 1, games: [] } }),
      series({ id: 'c', kickoff: '2026-10-22T18:00:00Z', result: { home: 1, away: 0, games: [] } }),
      series({ id: 'd', kickoff: '2026-10-23T18:00:00Z', result: { home: 2, away: 1, games: [] } }),
      series({ id: 'e', kickoff: '2026-10-24T18:00:00Z', result: null }),
    ];
    it('is empty without picks', () => {
      expect(userRecord(list, {})).toEqual({ judged: 0, hits: 0, rate: 0, streak: 0 });
    });
    it('counts judged, hits, rate and streak regardless of reveal', () => {
      const picks = {
        a: { side: 'home', revealed: true },
        b: { side: 'home', revealed: false },
        c: { side: 'home', revealed: true },
        d: { side: 'home', revealed: false },
        e: { side: 'home', revealed: true },
      };
      expect(userRecord(list, picks)).toEqual({ judged: 4, hits: 3, rate: 75, streak: 2 });
    });
    it('streak resets on the most recent miss', () => {
      const picks = {
        a: { side: 'home' },
        b: { side: 'away' },
        c: { side: 'home' },
        d: { side: 'away' },
      };
      expect(userRecord(list, picks)).toEqual({ judged: 4, hits: 3, rate: 75, streak: 0 });
    });
    it('orders by kickoff, not array order', () => {
      const reversed = [...list].reverse();
      const picks = { a: { side: 'away' }, b: { side: 'away' }, c: { side: 'home' }, d: { side: 'home' } };
      expect(userRecord(reversed, picks).streak).toBe(3);
    });
  });

  describe('fableRecord', () => {
    it('is zero for nothing resolved', () => {
      expect(fableRecord([series()])).toEqual({ judged: 0, hits: 0, rate: 0, exact: 0, brier: 0 });
    });
    it('computes hits, exact and brier', () => {
      const list = [
        series({ id: 'a', result: { home: 1, away: 0, games: [] } }), // hit, exact (1-0), brier (0.8-1)^2 = 0.04
        series({ id: 'b', pick: { side: 'away', pWin: [0.4, 0.6], score: '0-1' }, result: { home: 1, away: 0, games: [] } }), // miss, brier 0.36
        series({ id: 'c', pick: { side: 'home', pWin: [0.7, 0.3], score: '2-0' }, result: { home: 2, away: 1, games: [] } }), // hit, not exact, brier 0.09
        series({ id: 'd', pick: null, result: { home: 1, away: 0, games: [] } }),
        series({ id: 'e', result: null }),
      ];
      expect(fableRecord(list)).toEqual({ judged: 3, hits: 2, rate: 67, exact: 1, brier: 0.163 });
    });
  });

  describe('rarity', () => {
    it('maps confidence to tiers', () => {
      expect(rarity(0.75)).toBe('silver');
      expect(rarity(0.9)).toBe('silver');
      expect(rarity(0.6)).toBe('aurora');
      expect(rarity(0.74)).toBe('aurora');
      expect(rarity(0.59)).toBe('teal');
    });
  });

  describe('loadPicks / savePicks', () => {
    function mem(initial) {
      const store = new Map(Object.entries(initial || {}));
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, v),
        store,
      };
    }
    it('returns {} without storage', () => {
      expect(loadPicks(null)).toEqual({});
      expect(loadPicks(undefined)).toEqual({});
    });
    it('returns {} when getItem throws', () => {
      expect(loadPicks({ getItem() { throw new Error('denied'); } })).toEqual({});
    });
    it('returns {} for invalid JSON or non-object', () => {
      expect(loadPicks(mem({ [PICKS_KEY]: '{nope' }))).toEqual({});
      expect(loadPicks(mem({ [PICKS_KEY]: '[1,2]' }))).toEqual({});
      expect(loadPicks(mem({ [PICKS_KEY]: 'null' }))).toEqual({});
      expect(loadPicks(mem({ [PICKS_KEY]: '"str"' }))).toEqual({});
    });
    it('round-trips picks through storage', () => {
      const s = mem();
      const picks = { 'r3-gen-lyon': { side: 'home', pickedAt: 'x', revealed: true } };
      expect(savePicks(s, picks)).toBe(true);
      expect(s.store.get(PICKS_KEY)).toBe(JSON.stringify(picks));
      expect(loadPicks(s)).toEqual(picks);
    });
    it('savePicks swallows errors and returns false', () => {
      expect(savePicks({ setItem() { throw new Error('quota'); } }, {})).toBe(false);
      expect(savePicks(null, {})).toBe(false);
    });
  });
});
