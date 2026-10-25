import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOLGG,
  TEAM_ALIASES,
  TEAM_LOGOS,
  parseChampionTable,
  parseGame,
  parseKalshiWinner,
  parseMatchlist,
  parsePlayerTable,
  parsePolymarketSeries,
  parsePolymarketWinner,
  teamCode,
} from '../scripts/lib/worlds-sources.mjs';

const FIXTURES = join(process.cwd(), 'tests', 'fixtures', 'worlds');
const read = (name) => readFileSync(join(FIXTURES, name), 'utf8');
const readJson = (name) => JSON.parse(read(name));

const CODES = ['GEN', 'HLE', 'T1', 'DK', 'BLG', 'TES', 'AL', 'IG', 'G2', 'MKOI', 'KC', 'TL', 'LYON', 'TSW', 'CFO', 'LOS'];

describe('teamCode / TEAM_ALIASES / TEAM_LOGOS', () => {
  it('maps gol.gg, Polymarket and Kalshi display names to codes', () => {
    expect(teamCode('Anyone s Legend')).toBe('AL');
    expect(teamCode("Anyone's Legend")).toBe('AL');
    expect(teamCode('Los Grandes')).toBe('LOS');
    expect(teamCode('LOS')).toBe('LOS');
    expect(teamCode('Gen.G')).toBe('GEN');
    expect(teamCode('Hanwha Life Esports')).toBe('HLE');
    expect(teamCode('Movistar KOI')).toBe('MKOI');
    expect(teamCode('  Team Secret Whales ')).toBe('TSW');
    expect(teamCode('Cloud9')).toBeNull();
    expect(teamCode(null)).toBeNull();
  });

  it('maps every code to itself and has a logo for each', () => {
    for (const code of CODES) {
      expect(TEAM_ALIASES[code]).toBe(code);
      expect(teamCode(code)).toBe(code);
      expect(TEAM_LOGOS[code]).toMatch(/^https:\/\/gol\.gg\/_img\/teams_icon\/.+\.webp$/);
    }
    expect(TEAM_LOGOS.GEN).toBe('https://gol.gg/_img/teams_icon/Gen.Glogo_profile.webp');
    expect(TEAM_LOGOS.LYON).toBe('https://gol.gg/_img/teams_icon/LYON_29logo_profile.webp');
    expect(TEAM_LOGOS.LOS).toBe('https://gol.gg/_img/teams_icon/Los_Grandeslogo_square.webp');
  });
});

describe('parseMatchlist', () => {
  const rows = parseMatchlist(read('matchlist-rows.html'));

  it('returns one entry per table row', () => {
    expect(rows).toHaveLength(20);
  });

  it('parses an unplayed Round 3 series', () => {
    expect(rows[0]).toEqual({
      gameId: '83659',
      home: 'GEN',
      away: 'LYON',
      scoreHome: null,
      scoreAway: null,
      round: 3,
      roundLabel: 'ROUND3',
      patch: '',
      date: '2026-10-25',
      played: false,
    });
  });

  it('parses a played Round 2 game with score in cell order', () => {
    const game = rows.find((row) => row.gameId === '83653');
    expect(game).toEqual({
      gameId: '83653',
      home: 'TL',
      away: 'BLG',
      scoreHome: 0,
      scoreAway: 1,
      round: 2,
      roundLabel: 'ROUND2',
      patch: '16.20',
      date: '2026-10-24',
      played: true,
    });
  });

  it('takes home/away from cells 2 and 4, not from the title order', () => {
    // title reads "IG vs TSW" but the score cells are TSW 0 - 1 IG
    const game = rows.find((row) => row.gameId === '83650');
    expect(game).toMatchObject({ home: 'TSW', away: 'IG', scoreHome: 0, scoreAway: 1 });
  });
});

describe('parseGame', () => {
  const game = parseGame(read('game-draft.html'));

  it('parses the blue side team, result, bans and picks', () => {
    expect(game.blue.team).toBe('TL');
    expect(game.blue.win).toBe(false);
    expect(game.blue.bans).toEqual(['Cassiopeia', 'Vi', 'Nocturne', 'Ziggs', 'Gnar']);
    expect(game.blue.picks).toEqual(['Ezreal', 'Jarvan IV', 'Karma', 'Locke', 'KSante']);
  });

  it('parses the red side team, result, bans and picks', () => {
    expect(game.red.team).toBe('BLG');
    expect(game.red.win).toBe(true);
    expect(game.red.bans).toHaveLength(5);
    expect(game.red.bans.slice(0, 3)).toEqual(['Renata Glasc', 'Qiyana', 'Galio']);
    expect(game.red.picks).toEqual(['Lee Sin', 'Orianna', 'Camille', 'Jhin', 'Nautilus']);
  });
});

describe('parseChampionTable', () => {
  const champs = parseChampionTable(read('champions-table.html'));

  it('parses the first row (Vi)', () => {
    expect(champs[0]).toEqual({ champ: 'Vi', picks: 2, bans: 14, presence: 100, winrate: 50, slug: 'Vi' });
  });

  it('parses every data row with a slug', () => {
    expect(champs.length).toBeGreaterThan(100);
    for (const row of champs) {
      expect(row.slug).toMatch(/^[^/\s]+$/);
      expect(Number.isFinite(row.picks)).toBe(true);
    }
  });

  it('returns [] when there is no table', () => {
    expect(parseChampionTable('<html></html>')).toEqual([]);
  });
});

describe('parsePlayerTable', () => {
  it('returns [] when there is no table', () => {
    expect(parsePlayerTable('<html></html>')).toEqual([]);
  });

  const fixture = join(FIXTURES, 'players-table.html');
  it.skipIf(!existsSync(fixture))('parses players by header name (team/role absent on the live page)', () => {
    const players = parsePlayerTable(read('players-table.html'));
    expect(players.length).toBeGreaterThan(50);
    expect(players[0]).toEqual({
      player: '369',
      teamCode: null,
      role: null,
      games: 2,
      kda: 1.6,
      kp: 39.3,
      dpm: 393,
    });
  });
});

describe('parsePolymarketSeries', () => {
  const series = parsePolymarketSeries(readJson('polymarket-events.json'));

  it('keeps only series events (title "(BOn) - Worlds")', () => {
    expect(series).toHaveLength(8);
    expect(series.map((s) => s.slug)).toContain('lol-tes-g2-2026-10-25');
  });

  it('parses a BO1 series; game 1 price equals the series price', () => {
    const tesG2 = series.find((s) => s.slug === 'lol-tes-g2-2026-10-25');
    expect(tesG2).toEqual({
      slug: 'lol-tes-g2-2026-10-25',
      home: 'TES',
      away: 'G2',
      bo: 1,
      kickoff: '2026-10-25T18:00:00.000Z',
      pWinHome: 0.475,
      pGame1Home: 0.475,
      liquidity: 572786.1949,
    });
  });

  it('parses a BO3 series with a separate Game 1 Winner market', () => {
    const genLyon = series.find((s) => s.slug === 'lol-gen-ly-2026-10-25');
    expect(genLyon).toMatchObject({
      home: 'GEN',
      away: 'LYON',
      bo: 3,
      kickoff: '2026-10-25T22:00:00.000Z',
      pWinHome: 0.905,
      pGame1Home: 0.835,
    });
  });
});

describe('parsePolymarketWinner', () => {
  it('maps known teams to Yes price and drops unknown outcomes', () => {
    const winner = parsePolymarketWinner(readJson('polymarket-winner.json'));
    expect(winner.GEN).toBe(0.375);
    expect(winner.AL).toBe(0.0135);
    expect(winner.LOS).toBe(0.0005);
    expect(Object.keys(winner).sort()).toEqual([...CODES].sort());
  });
});

describe('parseKalshiWinner', () => {
  it('returns the yes bid/ask mid for active markets only', () => {
    const winner = parseKalshiWinner(readJson('kalshi.json'));
    expect(winner.GEN).toBe(0.375);
    expect(winner.LOS).toBe(0.005);
    expect(winner.AL).toBe(0.015);
    expect(Object.keys(winner).sort()).toEqual([...CODES].sort());
  });
});

describe('GOLGG url builders', () => {
  it('builds gol.gg URLs with %20-encoded tournament names', () => {
    expect(GOLGG.matchlist('Worlds 2026 Main Event')).toBe(
      'https://gol.gg/tournament/tournament-matchlist/Worlds%202026%20Main%20Event/',
    );
    expect(GOLGG.game('83653')).toBe('https://gol.gg/game/stats/83653/page-game/');
    expect(GOLGG.champions('Worlds 2026 Play-In')).toBe(
      'https://gol.gg/champion/list/season-S16/split-ALL/tournament-Worlds%202026%20Play-In/',
    );
    expect(GOLGG.players('Worlds 2026 Main Event')).toBe(
      'https://gol.gg/players/list/season-S16/split-ALL/tournament-Worlds%202026%20Main%20Event/',
    );
    expect(GOLGG.team(2813)).toBe('https://gol.gg/teams/team-stats/2813/split-ALL/tournament-ALL/');
  });
});
