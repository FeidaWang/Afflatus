import {
  matchesMvp,
  pickCorrect,
  pickExact,
  pickedTeam,
} from '../leaguesPick.js';

export function createMsiArchive(data) {
  const scored = (data.series || [])
    .filter((series) => series.result)
    .map((series) => ({
      source: series,
      ok: pickCorrect(series),
      exact: pickExact(series),
      conf: series.conf,
    }));
  const grandFinal = (data.series || []).find((series) => series.id === 'msi-grand-final');
  const actualChampion = grandFinal?.result
    ? (grandFinal.result.home > grandFinal.result.away ? grandFinal.home : grandFinal.away)
    : null;

  return {
    id: 'msi',
    data,
    scored,
    actualChampion,
    actualMvp: data.finalsMvp || null,
    pickedTeam,
    matchesMvp,
  };
}

export function createWorldCupArchive(data) {
  return {
    id: 'wc',
    data,
    scored: (data.matches || []).map((match) => ({
      source: match,
      ok: Boolean(match.ok),
      exact: Boolean(match.exact),
      conf: match.conf,
    })),
    headline: {
      total: data.record?.resolved || 0,
      successes: data.record?.correctOutcome || 0,
      exact: data.record?.exactScore || 0,
    },
    actualChampion: data.champions?.[0]?.team || null,
    actualMvp: data.goldenBall || null,
  };
}

export function normalizePersonName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[·•|/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
