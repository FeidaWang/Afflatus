import { describe, it, expect } from 'vitest';
import { pickedTeam, pickCorrect, pickExact, matchesMvp } from '../src/lib/leaguesPick.js';

describe('leaguesPick (U21 Phase 1 §2.2/§2.4)', () => {
  it('pickedTeam resolves home/away pick to the actual team name', () => {
    expect(pickedTeam({ opus: 'home', home: 'BLG', away: 'HLE' })).toBe('BLG');
    expect(pickedTeam({ opus: 'away', home: 'BLG', away: 'HLE' })).toBe('HLE');
  });

  it('pickCorrect matches the U18/U19-established outcome logic', () => {
    expect(pickCorrect({ opus: 'home', result: { home: 3, away: 0 } })).toBe(true);
    expect(pickCorrect({ opus: 'away', result: { home: 3, away: 0 } })).toBe(false);
    expect(pickCorrect({ opus: 'home', result: null })).toBe(null);
  });

  it('pickExact reproduces the U19 fix: a string coincidence with the wrong winner does not count', () => {
    // The real msi-lb-r2-g2 case: picked away side "3-1", actual home 3-1 —
    // string equal but the pick was the WRONG team, so not exact (or ok).
    const s = { opus: 'away', opusScore: '3-1', result: { home: 3, away: 1 } };
    expect(pickCorrect(s)).toBe(false);
    expect(pickExact(s)).toBe(false);
  });

  it('pickExact is true only when both the winner and the scoreline are correct', () => {
    const s = { opus: 'home', opusScore: '3-0', result: { home: 3, away: 0 } };
    expect(pickCorrect(s)).toBe(true);
    expect(pickExact(s)).toBe(true);
  });

  it('matchesMvp does exact-ish string matching tolerant of separator/whitespace drift', () => {
    expect(matchesMvp({ team: 'Knight · BLG' }, 'Knight · BLG')).toBe(true);
    expect(matchesMvp({ team: 'Knight · BLG' }, 'Knight  ·  BLG')).toBe(true); // extra whitespace
    expect(matchesMvp({ team: 'Knight · BLG' }, 'Knight / BLG')).toBe(true); // different separator
    expect(matchesMvp({ team: 'Knight · BLG' }, 'Gumayusi · HLE')).toBe(false);
  });

  it('matchesMvp accepts a structured { player, team } finalsMvp value', () => {
    expect(matchesMvp({ team: 'Knight · BLG' }, { player: 'Knight', team: 'BLG' })).toBe(true);
    expect(matchesMvp({ team: 'Gumayusi · HLE' }, { player: 'Knight', team: 'BLG' })).toBe(false);
  });
});
