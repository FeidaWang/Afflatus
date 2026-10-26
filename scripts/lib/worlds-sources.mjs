// Fetch + parse helpers for the Worlds 2026 data pipeline.
// Sources: gol.gg (server-rendered HTML), Polymarket Gamma (JSON), Kalshi (JSON).
// No third-party dependencies: the gol.gg pages are parsed with regex/string ops.

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Teams

export const TEAM_ALIASES = {
  GEN: 'GEN', 'Gen.G': 'GEN',
  HLE: 'HLE', 'Hanwha Life Esports': 'HLE',
  T1: 'T1',
  DK: 'DK', 'Dplus KIA': 'DK',
  BLG: 'BLG', 'Bilibili Gaming': 'BLG',
  TES: 'TES', 'Top Esports': 'TES',
  AL: 'AL', 'Anyone s Legend': 'AL', "Anyone's Legend": 'AL',
  IG: 'IG', 'Invictus Gaming': 'IG',
  G2: 'G2', 'G2 Esports': 'G2',
  MKOI: 'MKOI', 'Movistar KOI': 'MKOI',
  KC: 'KC', 'Karmine Corp': 'KC',
  TL: 'TL', 'Team Liquid': 'TL',
  LYON: 'LYON',
  TSW: 'TSW', 'Team Secret Whales': 'TSW',
  CFO: 'CFO', 'CTBC Flying Oyster': 'CFO',
  LOS: 'LOS', 'Los Grandes': 'LOS',
};

const normalizeName = (name) => name.replace(/\s+/g, ' ').trim().toLowerCase();
const ALIAS_INDEX = new Map(Object.entries(TEAM_ALIASES).map(([name, code]) => [normalizeName(name), code]));

export function teamCode(name) {
  if (typeof name !== 'string') return null;
  return ALIAS_INDEX.get(normalizeName(name)) ?? null;
}

const LOGO_BASE = 'https://gol.gg/_img/teams_icon/';
export const TEAM_LOGOS = {
  GEN: `${LOGO_BASE}Gen.Glogo_profile.webp`,
  HLE: `${LOGO_BASE}Hanwha_Life_Esportslogo_profile.webp`,
  T1: `${LOGO_BASE}T1logo_profile.webp`,
  DK: `${LOGO_BASE}Dplus_KIAlogo_profile.webp`,
  BLG: `${LOGO_BASE}Bilibili_Gaminglogo_profile.webp`,
  TES: `${LOGO_BASE}Top_Esportslogo_profile.webp`,
  AL: `${LOGO_BASE}Anyones_Legendlogo_profile.webp`,
  IG: `${LOGO_BASE}Invictus_Gaminglogo_profile.webp`,
  G2: `${LOGO_BASE}G2_Esportslogo_profile.webp`,
  MKOI: `${LOGO_BASE}Movistar_KOIlogo_square.webp`,
  KC: `${LOGO_BASE}Karmine_Corplogo_profile.webp`,
  TL: `${LOGO_BASE}Team_Liquidlogo_profile.webp`,
  LYON: `${LOGO_BASE}LYON_29logo_profile.webp`,
  TSW: `${LOGO_BASE}Team_Secret_Whaleslogo_profile.webp`,
  CFO: `${LOGO_BASE}CTBC_Flying_Oysterlogo_square.webp`,
  LOS: `${LOGO_BASE}Los_Grandeslogo_square.webp`,
};

// ---------------------------------------------------------------------------
// HTML helpers

function text(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const matchAll = (html, re) => Array.from(html.matchAll(re), (m) => m[1]);
const tableRows = (html) => matchAll(html, /<tr\b[^>]*>([\s\S]*?)<\/tr>/g);
const rowCells = (row) => matchAll(row, /<td\b[^>]*>([\s\S]*?)<\/td>/g);
const championAlts = (html) => matchAll(html, /champion_icon_medium[^>]*\balt=['"]([^'"]+)['"]/g);

function number(value) {
  const n = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Returns { headers: [lowercased th text], rows: [[cell html]] } for the first
// <table> whose header row contains `requiredHeader`, or null.
function statsTable(html, requiredHeader) {
  for (const match of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)) {
    const table = match[1];
    const headers = matchAll(table, /<th\b[^>]*>([\s\S]*?)<\/th>/g).map((h) => text(h).toLowerCase());
    if (!headers.includes(requiredHeader.toLowerCase())) continue;
    const rows = tableRows(table).map(rowCells).filter((cells) => cells.length === headers.length);
    return { headers, rows };
  }
  return null;
}

// ---------------------------------------------------------------------------
// gol.gg parsers

export function parseMatchlist(html) {
  const out = [];
  for (const row of tableRows(html)) {
    const cells = rowCells(row);
    if (cells.length !== 7) continue;
    const gameId = /game\/stats\/(\d+)\//.exec(cells[0])?.[1];
    if (!gameId) continue;
    const score = /(\d+)\s*-\s*(\d+)/.exec(text(cells[2]));
    const round = /ROUND\s*(\d+)/i.exec(text(cells[4]));
    out.push({
      gameId,
      home: teamCode(text(cells[1])),
      away: teamCode(text(cells[3])),
      scoreHome: score ? Number(score[1]) : null,
      scoreAway: score ? Number(score[2]) : null,
      round: round ? Number(round[1]) : null,
      roundLabel: text(cells[4]),
      patch: text(cells[5]),
      date: text(cells[6]),
      played: Boolean(score),
    });
  }
  return out;
}

function parseGameSide(block) {
  const header = text(block.slice(0, block.indexOf('</div>')));
  const [, name, result] = /^(.*?)\s*-\s*(WIN|LOSS)\s*$/i.exec(header) ?? [null, header, ''];
  const bansAt = block.search(/>\s*Bans\s*</);
  const picksAt = block.search(/>\s*Picks\b/);
  return {
    team: teamCode(name) ?? name,
    win: result.toUpperCase() === 'WIN',
    bans: bansAt >= 0 ? championAlts(block.slice(bansAt, picksAt >= 0 ? picksAt : undefined)).slice(0, 5) : [],
    picks: picksAt >= 0 ? championAlts(block.slice(picksAt)).slice(0, 5) : [],
  };
}

export function parseGame(html) {
  const blueMarker = html.indexOf('col-12 blue-line-header');
  const redMarker = html.indexOf('col-12 red-line-header');
  if (blueMarker < 0 || redMarker < 0) throw new Error('parseGame: blue/red side headers not found');
  const blueAt = html.lastIndexOf('<div', blueMarker);
  const redAt = html.lastIndexOf('<div', redMarker);
  return {
    blue: parseGameSide(html.slice(blueAt, redAt)),
    red: parseGameSide(html.slice(redAt)),
  };
}

/** Both rosters in gol.gg role order (top, jng, mid, adc, sup): the player
 *  stat tables follow the draft blocks, blue side first. */
export function parseGamePlayers(html) {
  const names = [...html.matchAll(/<a[^>]+href=['"][^'"]*players\/player-stats\/[^'"]*['"][^>]*>([^<]+)<\/a>/g)]
    .map((match) => match[1].trim());
  const unique = [...new Set(names)];
  return { blue: unique.slice(0, 5), red: unique.slice(5, 10) };
}

export function parseChampionTable(html) {
  const table = statsTable(html, 'Champion');
  if (!table) return [];
  const col = (name) => table.headers.indexOf(name.toLowerCase());
  const [iChamp, iPicks, iBans, iPrio, iWinrate] = ['Champion', 'Picks', 'Bans', 'PrioScore', 'Winrate'].map(col);
  return table.rows.map((cells) => ({
    champ: text(cells[iChamp]),
    picks: number(text(cells[iPicks])),
    bans: number(text(cells[iBans])),
    presence: number(text(cells[iPrio])),
    winrate: number(text(cells[iWinrate])),
    slug: /champions_icon\/(.+?)\.png/.exec(cells[iChamp])?.[1] ?? null,
  }));
}

const ROLE_ALIASES = {
  top: 'top',
  jungle: 'jng', jng: 'jng', jgl: 'jng', jun: 'jng',
  mid: 'mid', middle: 'mid',
  adc: 'adc', bot: 'adc', bottom: 'adc',
  support: 'sup', sup: 'sup', supp: 'sup',
};

export function parsePlayerTable(html) {
  const table = statsTable(html, 'Player');
  if (!table) return [];
  const col = (...names) => table.headers.findIndex((h) => names.includes(h));
  const iPlayer = col('player');
  const iTeam = col('team');
  const iRole = col('role', 'position');
  const iGames = col('games');
  const iKda = col('kda');
  const iKp = col('kp%', 'kp');
  const iDpm = col('dpm');
  const iGd15 = col('gd@15');
  const cell = (cells, i) => (i >= 0 ? text(cells[i]) : null);
  return table.rows.map((cells) => ({
    player: cell(cells, iPlayer),
    teamCode: iTeam >= 0 ? teamCode(cell(cells, iTeam)) : null,
    role: iRole >= 0 ? ROLE_ALIASES[cell(cells, iRole).toLowerCase()] ?? null : null,
    games: iGames >= 0 ? number(cell(cells, iGames)) : null,
    kda: iKda >= 0 ? number(cell(cells, iKda)) : null,
    kp: iKp >= 0 ? number(cell(cells, iKp)) : null,
    dpm: iDpm >= 0 ? number(cell(cells, iDpm)) : null,
    gd15: iGd15 >= 0 ? number(cell(cells, iGd15)) : null,
  }));
}

const TACTIC_COLUMNS = { 'gd@15': 'GD@15', 'fb%': 'FB%', 'ft%': 'FT%', 'dra%': 'DRA%', vgpg: 'VGPG', 'nash%': 'NASH%' };

// gol.gg tournament team list → [{ team, values: { [TACTIC_KEY]: { raw, display } } }].
// The live page has one more <th> (WC%) than each row has cells, so rows are
// read positionally instead of through statsTable's equal-length filter.
export function parseTeamTable(html) {
  const match = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)].find((m) => /GD@15/.test(m[1]));
  if (!match) return [];
  const headers = matchAll(match[1], /<th\b[^>]*>([\s\S]*?)<\/th>/g).map((h) => text(h).toLowerCase());
  const table = { headers, rows: tableRows(match[1]).map(rowCells).filter((cells) => cells.length >= headers.indexOf('gd@15') + 1) };
  const iName = table.headers.indexOf('name');
  return table.rows.map((cells) => ({
    team: teamCode(text(cells[iName])),
    values: Object.fromEntries(Object.entries(TACTIC_COLUMNS)
      .filter(([header]) => table.headers.includes(header))
      .map(([header, key]) => {
        const display = text(cells[table.headers.indexOf(header)]);
        return [key, { raw: number(display), display }];
      })),
  })).filter((row) => row.team);
}

// ---------------------------------------------------------------------------
// Polymarket

const parseJsonList = (value) => (typeof value === 'string' ? JSON.parse(value) : value ?? []);

// Price of the outcome whose name maps to `code`, or null.
function outcomePrice(market, code) {
  const outcomes = parseJsonList(market.outcomes);
  const prices = parseJsonList(market.outcomePrices);
  const i = outcomes.findIndex((name) => teamCode(name) === code || name === code);
  return i >= 0 ? number(prices[i]) : null;
}

// '2026-10-26 18:00:00+00' → '2026-10-26T18:00:00.000Z'
function toIsoUtc(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const SERIES_TITLE = /\(BO(\d)\)\s*-\s*Worlds/;

export function parsePolymarketSeries(events) {
  const out = [];
  for (const event of events ?? []) {
    const title = event?.title ?? '';
    const bo = SERIES_TITLE.exec(title);
    if (!bo) continue;
    const markets = event.markets ?? [];
    const winner = markets.find((m) => m.question === title);
    if (!winner) continue;
    const outcomes = parseJsonList(winner.outcomes);
    const home = teamCode(outcomes[0]);
    const away = teamCode(outcomes[1]);
    const game1 = markets.find((m) => /Game 1 Winner/i.test(m.question ?? ''));
    const pWinHome = outcomePrice(winner, home);
    out.push({
      slug: event.slug,
      home,
      away,
      bo: Number(bo[1]),
      kickoff: toIsoUtc(winner.gameStartTime ?? event.startTime),
      pWinHome,
      pGame1Home: game1 ? outcomePrice(game1, home) : pWinHome,
      liquidity: number(winner.liquidityNum ?? winner.liquidity ?? event.liquidity),
    });
  }
  return out;
}

export function parsePolymarketWinner(events) {
  const list = Array.isArray(events) ? events : [events];
  const out = {};
  for (const event of list) {
    for (const market of event?.markets ?? []) {
      const name = market.groupItemTitle ?? /^Will (.+?) win /.exec(market.question ?? '')?.[1];
      const code = teamCode(name);
      if (!code) continue;
      const price = outcomePrice(market, 'Yes');
      if (price !== null) out[code] = price;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Kalshi

export function parseKalshiWinner(json) {
  const out = {};
  for (const market of json?.markets ?? []) {
    if (market.status !== 'active') continue;
    const code = teamCode(market.yes_sub_title);
    if (!code) continue;
    const bid = number(market.yes_bid_dollars ?? market.yes_bid / 100);
    const ask = number(market.yes_ask_dollars ?? market.yes_ask / 100);
    if (bid === null || ask === null) continue;
    out[code] = Math.round(((bid + ask) / 2) * 10_000) / 10_000;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fetch

async function fetchWithRetry(url, headers, read) {
  let lastError;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, ...headers },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await read(response);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`fetch failed for ${url}: ${lastError?.message ?? lastError}`, { cause: lastError });
}

export function fetchText(url) {
  return fetchWithRetry(url, {}, (response) => response.text());
}

export function fetchJsonUrl(url) {
  return fetchWithRetry(url, { Accept: 'application/json' }, (response) => response.json());
}

// ---------------------------------------------------------------------------
// gol.gg URL builders

export const GOLGG = {
  matchlist: (tournament) => `https://gol.gg/tournament/tournament-matchlist/${encodeURIComponent(tournament)}/`,
  game: (id) => `https://gol.gg/game/stats/${id}/page-game/`,
  champions: (tournament) =>
    `https://gol.gg/champion/list/season-S16/split-ALL/tournament-${encodeURIComponent(tournament)}/`,
  players: (tournament) =>
    `https://gol.gg/players/list/season-S16/split-ALL/tournament-${encodeURIComponent(tournament)}/`,
  team: (id) => `https://gol.gg/teams/team-stats/${id}/split-ALL/tournament-ALL/`,
  teams: (tournament) =>
    `https://gol.gg/teams/list/season-S16/split-ALL/tournament-${encodeURIComponent(tournament)}/`,
};

// ---------------------------------------------------------------------------
// Riot Data Dragon

export { championKey } from '../../src/lib/worldsChampionKey.js';

export const DDRAGON = {
  versions: 'https://ddragon.leagueoflegends.com/api/versions.json',
  champions: (version) => `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
};

// champion.json → Map of display name and id → Data Dragon id.
export function championKeyMap(json) {
  const map = new Map();
  for (const c of Object.values(json?.data || {})) {
    map.set(c.name, c.id);
    map.set(c.id, c.id);
  }
  return map;
}
