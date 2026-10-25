#!/usr/bin/env node
/**
 * build-worlds-candidate.mjs --output=<dir> [--baseline=public/worlds-data.json]
 *                            [--offline-fixtures=<dir> [--now=<ISO>]]
 *
 * Candidate generator for the `worlds-daily` pipeline (spec §5/§7). Fetches
 * gol.gg (schedule, game drafts, champion/player stats), Polymarket and
 * Kalshi, settles finished series, computes every number with
 * src/lib/worldsModel.js and writes:
 *   <dir>/worlds-data.json        validator-clean, explanation fields empty
 *   <dir>/worlds-run-payload.json every fact the model session may cite
 *   <dir>/raw/*                   the fetched sources, replayable offline
 * Never locks, commits or touches public/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  GOLGG, TEAM_LOGOS, teamCode,
  fetchJsonUrl, fetchText,
  parseChampionTable, parseGame, parseGamePlayers, parseKalshiWinner, parseMatchlist,
  parsePlayerTable, parsePolymarketSeries, parsePolymarketWinner,
} from './lib/worlds-sources.mjs';
import {
  TEAM_SEED_ELO, blendGameProb, buildRecord, eloExpected, enumerateSeries,
  fearlessDelta, gameProbFromSeries, impliedOdds, mvpBoard, mvpWeights,
  simulateChampion, updateElo,
} from '../src/lib/worldsModel.js';
import { validateWorldsData } from '../src/lib/validateWorldsData.js';
import { zonedDate } from '../src/lib/dataFreshness.js';

const MAIN = 'Worlds 2026 Main Event';
const PLAY_IN = 'Worlds 2026 Play-In';
const TEAM_PAGE_IDS = {
  AL: 2848, BLG: 2849, CFO: 2880, DK: 2802, G2: 2897, GEN: 2804, HLE: 2805, IG: 2850,
  KC: 2899, LOS: 2895, LYON: 2954, MKOI: 2900, T1: 2809, TL: 2813, TSW: 2887, TES: 2852,
};
const POLYMARKET_SERIES = 'https://gamma-api.polymarket.com/events?tag_slug=league-of-legends&active=true&closed=false&limit=100&order=startDate&ascending=false';
const POLYMARKET_WINNER = 'https://gamma-api.polymarket.com/events?slug=worlds-2026-winner';
const KALSHI_WINNER = 'https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=KXLOL-WORLDS26&limit=100';
const MIN_LIQUIDITY = 5000;
const SINCE = '2026-10-25';

const option = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const outputDir = option('output');
if (!outputDir) {
  console.error('usage: build-worlds-candidate.mjs --output=<dir> [--baseline=<path>] [--offline-fixtures=<dir> [--now=<ISO>]]');
  process.exit(64);
}
const fixturesDir = option('offline-fixtures');
if (option('now') && !fixturesDir) {
  console.error('--now is only accepted together with --offline-fixtures');
  process.exit(64);
}
const now = option('now') ? new Date(option('now')) : new Date();
if (Number.isNaN(now.getTime())) throw new TypeError('invalid --now');
const baselinePath = option('baseline') || 'public/worlds-data.json';
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null;
const notes = [];
const sources = [];
mkdirSync(join(outputDir, 'raw'), { recursive: true });

/* ---------- source access: live (with raw copies) or offline fixtures ---------- */
const SOURCE_LABELS = {
  'matchlist-main.html': 'gol.gg · Worlds 2026 Main Event schedule',
  'matchlist-playin.html': 'gol.gg · Worlds 2026 Play-In schedule',
  'champions.html': 'gol.gg · champion statistics',
  'players.html': 'gol.gg · player statistics',
  'polymarket.json': 'Polymarket · series markets',
  'polymarket-winner.json': 'Polymarket · Worlds 2026 winner',
  'kalshi.json': 'Kalshi · KXLOL-WORLDS26',
};
const sourceLabel = (name) => SOURCE_LABELS[name]
  || (name.startsWith('game-') ? `gol.gg · game ${name.slice(5, -5)} draft` : name.startsWith('team-') ? `gol.gg · team ${name.slice(5, -5)} season pool` : name);

async function source(name, url, kind) {
  const rawPath = join(fixturesDir || join(outputDir, 'raw'), name);
  if (fixturesDir) {
    if (!existsSync(rawPath)) return null;
    const text = readFileSync(rawPath, 'utf8');
    sources.push({ label: sourceLabel(name), url, fetchedAt: now.toISOString() });
    return kind === 'json' ? JSON.parse(text) : text;
  }
  try {
    const value = kind === 'json' ? await fetchJsonUrl(url) : await fetchText(url);
    writeFileSync(rawPath, kind === 'json' ? JSON.stringify(value) : value);
    sources.push({ label: sourceLabel(name), url, fetchedAt: new Date().toISOString() });
    return value;
  } catch (error) {
    notes.push(`fetch failed: ${name} (${error.message})`);
    return null;
  }
}

/* ---------- schedule → series ---------- */
function stageOf(roundLabel) {
  const label = String(roundLabel || '');
  const swiss = label.match(/round\s*(\d)/i);
  if (swiss) return { stage: 'swiss', round: Number(swiss[1]) };
  if (/quarter|\bqf\b/i.test(label)) return { stage: 'qf' };
  if (/semi|\bsf\b/i.test(label)) return { stage: 'sf' };
  if (/final/i.test(label)) return { stage: 'final' };
  return null;
}

function groupSeries(rows) {
  const groups = new Map();
  for (const row of rows) {
    const where = stageOf(row.roundLabel ?? row.round);
    if (!where || !row.home || !row.away) { notes.push(`skipped schedule row ${JSON.stringify(row.round)} ${row.home}-${row.away}`); continue; }
    const key = `${where.stage}${where.round || ''}|${[row.home, row.away].sort().join('-')}`;
    if (!groups.has(key)) groups.set(key, { ...where, home: row.home, away: row.away, date: row.date, patch: row.patch, rows: [] });
    const group = groups.get(key);
    group.rows.push(row);
    if (row.date < group.date) group.date = row.date;
    if (!group.patch && row.patch) group.patch = row.patch;
  }
  return [...groups.values()];
}

function entryRecords(groups) {
  // Swiss records entering each round, derived from earlier rounds' series.
  const byRound = new Map();
  for (const group of groups.filter((g) => g.stage === 'swiss')) {
    if (!byRound.has(group.round)) byRound.set(group.round, []);
    byRound.get(group.round).push(group);
  }
  const record = Object.fromEntries(Object.keys(TEAM_SEED_ELO).map((code) => [code, { w: 0, l: 0 }]));
  for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
    for (const group of byRound.get(round)) {
      group.entering = { home: { ...record[group.home] }, away: { ...record[group.away] } };
      group.bo = group.entering.home.w === 2 || group.entering.home.l === 2 ? 3 : 1;
      group.result = settle(group);
      if (group.result) {
        const winner = group.result.home > group.result.away ? group.home : group.away;
        const loser = winner === group.home ? group.away : group.home;
        record[winner] = { w: record[winner].w + 1, l: record[winner].l };
        record[loser] = { w: record[loser].w, l: record[loser].l + 1 };
      }
    }
  }
  for (const group of groups.filter((g) => g.stage !== 'swiss')) {
    group.bo = 5;
    group.result = settle(group);
  }
  return record;
}

function settle(group) {
  const played = group.rows.filter((row) => row.played);
  const wins = { home: 0, away: 0 };
  for (const row of played) {
    const homeScore = row.home === group.home ? row.scoreHome : row.scoreAway;
    const awayScore = row.home === group.home ? row.scoreAway : row.scoreHome;
    if (homeScore > awayScore) wins.home += 1; else wins.away += 1;
  }
  const target = Math.ceil(group.bo / 2);
  if (wins.home < target && wins.away < target) return null;
  return { home: wins.home, away: wins.away, games: [] };
}

function seriesId(group, knockoutIndex) {
  const prefix = group.stage === 'swiss' ? `r${group.round}` : group.stage === 'final' ? 'f' : `${group.stage}${knockoutIndex}`;
  return `${prefix}-${group.home}-${group.away}`.toLowerCase();
}

function estimatedKickoff(group) {
  // 12:00 CT for most rounds, 15:00 CT for round 4, 16:00 CT knockouts (CDT until 11-01).
  const date = group.date;
  const cdt = date < '2026-11-01';
  const hour = group.stage !== 'swiss' ? 16 : group.round === 4 ? 15 : 12;
  return `${date}T${String(hour + (cdt ? 5 : 6)).padStart(2, '0')}:00:00.000Z`;
}

/* ---------- main ---------- */
const mainHtml = await source('matchlist-main.html', GOLGG.matchlist(MAIN), 'text');
if (!mainHtml) { console.error('[build-worlds-candidate] the gol.gg schedule is required'); process.exit(1); }
const playInHtml = await source('matchlist-playin.html', GOLGG.matchlist(PLAY_IN), 'text');
const mainRows = parseMatchlist(mainHtml);
const playInRows = playInHtml ? parseMatchlist(playInHtml) : [];
const groups = groupSeries(mainRows);
const recordAfterSwiss = entryRecords(groups);

// Markets (fetched before scheduling so Polymarket can add series gol.gg has
// not listed yet — the next match day's pairings appear there first).
const polyEvents = await source('polymarket.json', POLYMARKET_SERIES, 'json');
const polySeries = polyEvents ? parsePolymarketSeries(polyEvents) : [];
const polyWinnerEvents = await source('polymarket-winner.json', POLYMARKET_WINNER, 'json');
const polyWinner = polyWinnerEvents ? parsePolymarketWinner(polyWinnerEvents) : {};
const kalshiJson = await source('kalshi.json', KALSHI_WINNER, 'json');
const kalshiWinner = kalshiJson ? parseKalshiWinner(kalshiJson) : {};

const pairKey = (a, b) => [a, b].sort().join('-');
for (const market of polySeries) {
  if (!market.home || !market.away || Date.parse(market.kickoff) < now.getTime() - 86_400_000) continue;
  const listed = groups.some((g) => pairKey(g.home, g.away) === pairKey(market.home, market.away) && (!g.result || g.date >= market.kickoff.slice(0, 10)));
  if (listed) continue;
  const home = recordAfterSwiss[market.home];
  const away = recordAfterSwiss[market.away];
  if (!home || !away || home.w >= 3 || home.l >= 3 || away.w >= 3 || away.l >= 3) { notes.push(`polymarket series ${market.slug} skipped (not an active swiss pairing)`); continue; }
  groups.push({
    stage: 'swiss', round: home.w + home.l + 1, home: market.home, away: market.away,
    date: market.kickoff.slice(0, 10), patch: '', rows: [], games: [], result: null, bo: market.bo,
    entering: { home: { ...home }, away: { ...away } },
  });
}
groups.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

// Game drafts: fetch only games the baseline has not already recorded.
const knownGames = new Map();
for (const series of baseline?.series || []) {
  for (const game of series.result?.games || []) if (game.gameId) knownGames.set(game.gameId, game);
}
for (const group of groups) {
  group.games = group.games || [];
  for (const row of group.rows.filter((r) => r.played && r.gameId)) {
    let game = knownGames.get(row.gameId);
    if (!game) {
      const html = await source(`game-${row.gameId}.html`, GOLGG.game(row.gameId), 'text');
      const draft = html ? parseGame(html) : null;
      const roster = html ? parseGamePlayers(html) : { blue: [], red: [] };
      const sideFor = (teamName) => (teamCode(teamName) === group.home ? 'home' : 'away');
      const homeScore = row.home === group.home ? row.scoreHome : row.scoreAway;
      game = {
        gameId: row.gameId,
        winner: homeScore > (row.home === group.home ? row.scoreAway : row.scoreHome) ? 'home' : 'away',
        picks: { home: [], away: [] },
      };
      if (draft) {
        for (const [colour, side] of [['blue', draft.blue], ['red', draft.red]]) {
          game.picks[sideFor(side.team)] = side.picks;
          game.players = { ...(game.players || {}), [sideFor(side.team)]: roster[colour] };
        }
      } else notes.push(`draft unavailable for game ${row.gameId}`);
    }
    group.games.push(game);
  }
  if (group.result) group.result.games = group.games;
}

// Swiss table.
const swissRecord = Object.fromEntries(Object.keys(TEAM_SEED_ELO).map((code) => [code, { w: 0, l: 0 }]));
for (const group of groups.filter((g) => g.stage === 'swiss' && g.result)) {
  const winner = group.result.home > group.result.away ? group.home : group.away;
  const loser = winner === group.home ? group.away : group.home;
  swissRecord[winner].w += 1;
  swissRecord[loser].l += 1;
}
const swiss = Object.entries(swissRecord).map(([team, { w, l }]) => ({
  team, w, l, status: w >= 3 ? 'advanced' : l >= 3 ? 'eliminated' : 'active',
})).sort((a, b) => b.w - a.w || a.l - b.l || a.team.localeCompare(b.team));

// Elo: Play-In first, then Main Event, oldest game first.
const chronological = (rows) => [...rows].reverse().filter((row) => row.played && row.home && row.away);
const eloGames = [...chronological(playInRows), ...chronological(mainRows)].map((row) => ({
  winner: row.scoreHome > row.scoreAway ? row.home : row.away,
  loser: row.scoreHome > row.scoreAway ? row.away : row.home,
}));
const ratings = updateElo({ ...TEAM_SEED_ELO }, eloGames, 40);

// Fearless depth: tournament-unique champions + half the season pool (cap 40).
const tournamentPool = Object.fromEntries(Object.keys(TEAM_SEED_ELO).map((code) => [code, new Set()]));
for (const group of groups) {
  for (const game of group.games) {
    for (const champ of game.picks.home) tournamentPool[group.home].add(champ);
    for (const champ of game.picks.away) tournamentPool[group.away].add(champ);
  }
}
const seasonUnique = {};
for (const [code, id] of Object.entries(TEAM_PAGE_IDS)) {
  const html = await source(`team-${id}.html`, GOLGG.team(id), 'text');
  seasonUnique[code] = html ? new Set([...html.matchAll(/champions_icon\/([^'"./]+)\.png/g)].map((m) => m[1])).size : 0;
}
const depthOf = (code) => tournamentPool[code].size + 0.5 * Math.min(seasonUnique[code] || 0, 40);

// Series entries.
const baselineById = new Map((baseline?.series || []).map((series) => [series.id, series]));
const knockoutCounters = {};
const series = groups.map((group) => {
  if (group.stage !== 'swiss') knockoutCounters[group.stage] = (knockoutCounters[group.stage] || 0) + 1;
  const id = seriesId(group, knockoutCounters[group.stage]);
  const previous = baselineById.get(id);
  const market = polySeries.find((m) => pairKey(m.home, m.away) === pairKey(group.home, group.away)
    && (group.result ? true : m.kickoff.slice(0, 10) >= group.date));
  const kickoff = previous?.kickoff && (previous.result || !market) ? previous.kickoff : market?.kickoff || estimatedKickoff(group);
  const started = Date.parse(kickoff) <= now.getTime();
  const depth = [depthOf(group.home), depthOf(group.away)];
  const marketEntry = market && market.liquidity >= MIN_LIQUIDITY
    ? { pWin: (market.home === group.home ? [market.pWinHome, 1 - market.pWinHome] : [1 - market.pWinHome, market.pWinHome]).map((p) => Math.round(p * 1000) / 1000), src: 'polymarket', liquidity: Math.round(market.liquidity) }
    : null;
  const delta = group.bo > 1 ? fearlessDelta(depth[0], depth[1]) : 0;
  let pick = null;
  let missed = false;
  if (group.result || started) {
    pick = previous?.pick || null;
    missed = !pick;
  } else {
    const pElo = eloExpected(ratings[group.home], ratings[group.away]);
    const pMarket = marketEntry ? gameProbFromSeries(marketEntry.pWin[0], group.bo) : null;
    const outcome = enumerateSeries(blendGameProb({ pMarket, pElo }), group.bo, delta);
    pick = {
      side: outcome.pWin[0] >= 0.5 ? 'home' : 'away',
      pWin: outcome.pWin.map((p) => Math.round(p * 1000) / 1000),
      score: outcome.best.score,
      pScore: Math.round(outcome.best.p * 1000) / 1000,
      oddsImplied: impliedOdds(outcome.pWin),
      adj: 0,
      decidedAt: now.toISOString(),
    };
    pick.pWin[1] = Math.round((1 - pick.pWin[0]) * 1000) / 1000;
  }
  return {
    id, stage: group.stage, ...(group.stage === 'swiss' ? { round: group.round } : {}), bo: group.bo,
    kickoff, ...(market?.kickoff || previous?.kickoff ? {} : { kickoffEstimated: true }),
    home: group.home, away: group.away,
    pick, missed, market: marketEntry,
    fearless: { consumed: [...new Set(group.games.flatMap((g) => [...g.picks.home, ...g.picks.away]))], depth, delta },
    result: group.result,
    reason_en: previous?.reason_en || '', reason_zh: previous?.reason_zh || '',
    factors_en: previous?.factors_en || [], factors_zh: previous?.factors_zh || [],
  };
});

// Champion odds.
const scheduled = series.filter((s) => !s.result && s.pick).map((s) => ({ home: s.home, away: s.away, bo: s.bo, pWinHome: s.pick.pWin[0] }));
const championSim = simulateChampion({ teams: swiss.map((t) => ({ code: t.team, w: t.w, l: t.l, status: t.status })), ratings, scheduled, runs: 10000, seed: 20261025 });
const marketRaw = Object.fromEntries(swiss.map(({ team }) => {
  const quotes = [polyWinner[team], kalshiWinner[team]].filter((v) => Number.isFinite(v));
  return [team, quotes.length ? quotes.reduce((a, b) => a + b, 0) / quotes.length : null];
}));
const marketSum = Object.values(marketRaw).reduce((sum, v) => sum + (v || 0), 0);
const champion = swiss.map(({ team }) => ({
  team,
  prob: championSim[team] ?? 0,
  market: marketSum > 0 && marketRaw[team] != null ? Math.round((marketRaw[team] / marketSum) * 1000) / 10 : null,
  reason_en: baseline?.champion?.find((c) => c.team === team)?.reason_en || '',
  reason_zh: baseline?.champion?.find((c) => c.team === team)?.reason_zh || '',
})).sort((a, b) => b.prob - a.prob || (b.market ?? 0) - (a.market ?? 0));

// MVP shortlist.
const playersHtml = await source('players.html', GOLGG.players(MAIN), 'text');
const ROLES = ['top', 'jng', 'mid', 'adc', 'sup'];
const rosterOf = new Map();
for (const group of groups) {
  for (const game of group.games) {
    for (const side of ['home', 'away']) {
      (game.players?.[side] || []).forEach((name, index) => rosterOf.set(name, { teamCode: group[side], role: ROLES[index] }));
    }
  }
}
const players = (playersHtml ? parsePlayerTable(playersHtml) : [])
  .map((player) => ({ ...player, ...(rosterOf.get(player.player) || {}) }))
  .filter((player) => player.teamCode && player.role);
if (!players.length) notes.push('player statistics or rosters unavailable; mvp list empty');
const mvp = players.length ? mvpBoard(championSim, mvpWeights(players)).map((entry) => ({
  ...entry, market: null,
  basis_en: baseline?.mvp?.find((m) => m.player === entry.player)?.basis_en || '',
  basis_zh: baseline?.mvp?.find((m) => m.player === entry.player)?.basis_zh || '',
})) : [];

// Meta + Fearless pools.
const champsHtml = await source('champions.html', GOLGG.champions(MAIN), 'text');
const championTable = champsHtml ? parseChampionTable(champsHtml) : [];
const slugOf = new Map(championTable.map((row) => [row.champ, row.slug]));
const meta = [...championTable].sort((a, b) => b.presence - a.presence || b.picks - a.picks).slice(0, 12)
  .map(({ champ, picks, bans, presence, winrate }) => ({ champ, picks, bans, presence, winrate }));
const fearless = swiss.map(({ team }) => ({
  team,
  depth: Math.round(depthOf(team) * 10) / 10,
  champs: [...tournamentPool[team]].map((name) => ({ name, slug: slugOf.get(name) || name.replace(/[^A-Za-z]/g, '') })),
  note_en: baseline?.fearless?.find((f) => f.team === team)?.note_en || '',
  note_zh: baseline?.fearless?.find((f) => f.team === team)?.note_zh || '',
}));

const data = {
  tournament: 'Worlds 2026',
  updated: zonedDate(now, 'America/Chicago'),
  version: (baseline?.version || 0) + 1,
  mode: series.some((s) => s.stage === 'final' && s.result) ? 'archive' : 'live',
  patch: '26.20',
  decidedAt: now.toISOString(),
  note_en: baseline?.note_en || 'Fable pre-match calls for Worlds 2026, sealed before each kickoff. Numbers come from code (Elo + prediction-market blend + Fearless Draft depth); the model only adds bounded adjustments and explanations. Entertainment only, not betting advice.',
  note_zh: baseline?.note_zh || 'Fable 对 Worlds 2026 每场系列赛的赛前研判，开赛前封存。数字由代码计算（Elo + 预测市场融合 + 无畏征召英雄池深度），模型只做有界修正与解释。仅供娱乐，不构成博彩建议。',
  archiveSource: { label_en: 'gol.gg Worlds 2026 schedule', label_zh: 'gol.gg Worlds 2026 赛程', url: GOLGG.matchlist(MAIN) },
  teamLogos: TEAM_LOGOS,
  swiss,
  series,
  champion,
  mvp,
  fearless,
  meta,
  record: buildRecord(series, SINCE),
  sources,
  notes,
};

const validation = validateWorldsData(data);
if (!validation.ok) {
  console.error('[build-worlds-candidate] candidate failed validation:');
  for (const error of validation.errors) console.error(`  - ${error}`);
  process.exit(1);
}

const payload = {
  as_of: now.toISOString(),
  mode: data.mode,
  series: series.filter((s) => !s.result).map((s) => ({
    id: s.id, home: s.home, away: s.away, bo: s.bo, round: s.round ?? null, stage: s.stage, kickoff: s.kickoff,
    started: Date.parse(s.kickoff) <= now.getTime(),
    model: s.pick ? { pWin: s.pick.pWin, score: s.pick.score, pScore: s.pick.pScore } : null,
    market: s.market,
    fearless: { depth: s.fearless.depth, consumedThisSeries: s.fearless.consumed },
    swissRecord: { home: `${swissRecord[s.home].w}-${swissRecord[s.home].l}`, away: `${swissRecord[s.away].w}-${swissRecord[s.away].l}` },
  })),
  swiss,
  completed_since_baseline: series.filter((s) => s.result && !baselineById.get(s.id)?.result).map((s) => ({ id: s.id, home: s.home, away: s.away, result: s.result })),
  champion: champion.map(({ team, prob, market }) => ({ team, prob, market })),
  mvp: mvp.map(({ player, teamCode: code, prob }) => ({ player, teamCode: code, prob })),
  fearless: fearless.map(({ team, depth, champs }) => ({ team, depth, champs })),
  meta_top12: meta,
  record: data.record,
  news: [],
  notes,
  rules: 'prompts/leagues-worlds.md',
};

writeFileSync(join(outputDir, 'worlds-data.json'), `${JSON.stringify(data, null, 2)}\n`);
writeFileSync(join(outputDir, 'worlds-run-payload.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[build-worlds-candidate] wrote ${resolve(outputDir)}: ${series.length} series, ${series.filter((s) => s.pick && !s.result).length} open picks, ${notes.length} notes`);
