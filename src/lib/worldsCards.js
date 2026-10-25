// Pick-then-flip card state machine for /worlds.html. Pure functions, no DOM.
// `picks` maps seriesId → { side:'home'|'away', pickedAt, revealed } and is never mutated.

export const PICKS_KEY = 'afflatus-worlds:picks:v1';

const SIDES = ['home', 'away'];

function ms(now) {
  return now instanceof Date ? now.getTime() : Number(now);
}

function kickedOff(series, now) {
  return ms(now) >= Date.parse(series.kickoff);
}

function winner(result) {
  return result.home > result.away ? 'home' : 'away';
}

function pct(hits, judged) {
  return judged ? Math.round((hits / judged) * 100) : 0;
}

export function cardState(series, pickEntry, now) {
  if (series.result) return 'result';
  if (pickEntry?.revealed) return 'revealed';
  if (pickEntry) return 'ready';
  if (kickedOff(series, now)) return 'locked-missed';
  return 'pick';
}

export function choose(picks, series, side, now) {
  if (!SIDES.includes(side) || kickedOff(series, now) || picks[series.id]?.revealed) return picks;
  return { ...picks, [series.id]: { side, pickedAt: new Date(ms(now)).toISOString(), revealed: false } };
}

export function reveal(picks, seriesId) {
  const entry = picks[seriesId];
  if (!entry) return picks;
  return { ...picks, [seriesId]: { ...entry, revealed: true } };
}

export function agreement(series, pickEntry) {
  if (!series.pick || !pickEntry) return null;
  return pickEntry.side === series.pick.side ? 'agree' : 'disagree';
}

export function userRecord(seriesList, picks) {
  const judged = seriesList
    .filter((s) => s.result && picks[s.id])
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
    .map((s) => picks[s.id].side === winner(s.result));
  const hits = judged.filter(Boolean).length;
  let streak = 0;
  for (let i = judged.length - 1; i >= 0 && judged[i]; i -= 1) streak += 1;
  return { judged: judged.length, hits, rate: pct(hits, judged.length), streak };
}

export function fableRecord(seriesList) {
  const resolved = seriesList.filter((s) => s.pick && s.result);
  let hits = 0;
  let exact = 0;
  let brierSum = 0;
  for (const s of resolved) {
    const hit = s.pick.side === winner(s.result);
    if (hit) hits += 1;
    if (hit && s.pick.score === `${s.result.home}-${s.result.away}`) exact += 1;
    const p = s.pick.pWin[s.pick.side === 'home' ? 0 : 1];
    brierSum += (p - (hit ? 1 : 0)) ** 2;
  }
  const judged = resolved.length;
  const brier = judged ? Math.round((brierSum / judged) * 1000) / 1000 : 0;
  return { judged, hits, rate: pct(hits, judged), exact, brier };
}

export function rarity(pWinPicked) {
  if (pWinPicked >= 0.75) return 'silver';
  if (pWinPicked >= 0.6) return 'aurora';
  return 'teal';
}

export function loadPicks(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(PICKS_KEY));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function savePicks(storage, picks) {
  try {
    storage.setItem(PICKS_KEY, JSON.stringify(picks));
    return true;
  } catch {
    return false;
  }
}
