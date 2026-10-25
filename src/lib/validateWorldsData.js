/* Pure validation for public/worlds-data.json (spec
   docs/superpowers/specs/2026-10-25-worlds-2026-odds-design.md §6). Same
   role as validateLeaguesData.js: the worlds scheduled task writes this
   file unattended, so this is the shape gate before commit+push. Besides
   shape it enforces the three contract rules the page relies on: pWin
   pairs are normalised, pick.decidedAt < kickoff (a pick published after
   kickoff is a "missed" series, not a pick), and record.* aggregates
   match what series[] itself says. */

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isInt(v) { return Number.isInteger(v); }
function isIso(v) { return typeof v === 'string' && Number.isFinite(Date.parse(v)); }
function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function pushErr(errors, msg) { errors.push(msg); }

function validatePWin(pWin, tag, errors) {
  if (!Array.isArray(pWin) || pWin.length !== 2 || !pWin.every((p) => typeof p === 'number' && p > 0 && p < 1)) {
    pushErr(errors, `${tag}: must be [home, away] each in (0,1), got ${JSON.stringify(pWin)}`);
    return;
  }
  if (Math.abs(pWin[0] + pWin[1] - 1) > 0.001) pushErr(errors, `${tag}: must sum to 1, got ${pWin[0] + pWin[1]}`);
}

function validatePick(p, kickoff, tag, errors) {
  if (!isObj(p)) { pushErr(errors, `${tag}: must be null or an object`); return; }
  if (p.side !== 'home' && p.side !== 'away') pushErr(errors, `${tag}.side: must be "home" or "away", got ${JSON.stringify(p.side)}`);
  validatePWin(p.pWin, `${tag}.pWin`, errors);
  if (typeof p.score !== 'string' || !/^\d-\d$/.test(p.score)) pushErr(errors, `${tag}.score: must match /^\\d-\\d$/, got ${JSON.stringify(p.score)}`);
  if (typeof p.pScore !== 'number' || !(p.pScore > 0 && p.pScore <= 1)) pushErr(errors, `${tag}.pScore: must be in (0,1], got ${JSON.stringify(p.pScore)}`);
  if (!Array.isArray(p.oddsImplied) || p.oddsImplied.length !== 2 || !p.oddsImplied.every((o) => typeof o === 'number' && o >= 1)) {
    pushErr(errors, `${tag}.oddsImplied: must be [home, away] each >= 1, got ${JSON.stringify(p.oddsImplied)}`);
  }
  if (typeof p.adj !== 'number' || !(Math.abs(p.adj) <= 0.05)) pushErr(errors, `${tag}.adj: must be a number with |adj| <= 0.05, got ${JSON.stringify(p.adj)}`);
  if (!isIso(p.decidedAt)) pushErr(errors, `${tag}.decidedAt: must be a parseable ISO timestamp`);
  else if (isIso(kickoff) && Date.parse(p.decidedAt) >= Date.parse(kickoff)) pushErr(errors, `${tag}.decidedAt: ${p.decidedAt} must be before kickoff ${kickoff}`);
}

function validateMarket(m, tag, errors) {
  if (!isObj(m)) { pushErr(errors, `${tag}: must be null or an object`); return; }
  validatePWin(m.pWin, `${tag}.pWin`, errors);
  if (!isNonEmptyString(m.src)) pushErr(errors, `${tag}.src: missing or empty`);
  if (typeof m.liquidity !== 'number') pushErr(errors, `${tag}.liquidity: must be a number`);
}

function validateResult(r, tag, errors) {
  if (!isObj(r)) { pushErr(errors, `${tag}: must be null or an object`); return; }
  if (!isInt(r.home)) pushErr(errors, `${tag}.home: must be an integer`);
  if (!isInt(r.away)) pushErr(errors, `${tag}.away: must be an integer`);
  if (!Array.isArray(r.games)) { pushErr(errors, `${tag}.games: must be an array`); return; }
  for (const [i, g] of r.games.entries()) {
    const gt = `${tag}.games[${i}]`;
    if (!isObj(g)) { pushErr(errors, `${gt}: not an object`); continue; }
    if (g.winner !== 'home' && g.winner !== 'away') pushErr(errors, `${gt}.winner: must be "home" or "away", got ${JSON.stringify(g.winner)}`);
    if (!isObj(g.picks)) { pushErr(errors, `${gt}.picks: must be an object`); continue; }
    if (!Array.isArray(g.picks.home)) pushErr(errors, `${gt}.picks.home: must be an array`);
    if (!Array.isArray(g.picks.away)) pushErr(errors, `${gt}.picks.away: must be an array`);
  }
}

function validateSwiss(swiss, errors) {
  if (!Array.isArray(swiss)) { pushErr(errors, 'swiss: must be an array'); return; }
  for (const [i, row] of swiss.entries()) {
    const tag = `swiss[${i}]`;
    if (!isObj(row)) { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(row.team)) pushErr(errors, `${tag}.team: missing or empty`);
    if (!isInt(row.w) || row.w < 0) pushErr(errors, `${tag}.w: must be a non-negative integer`);
    if (!isInt(row.l) || row.l < 0) pushErr(errors, `${tag}.l: must be a non-negative integer`);
    if (!['active', 'advanced', 'eliminated'].includes(row.status)) pushErr(errors, `${tag}.status: must be active|advanced|eliminated, got ${JSON.stringify(row.status)}`);
  }
}

function validateSeries(series, errors) {
  if (!Array.isArray(series)) { pushErr(errors, 'series: must be an array'); return; }
  const ids = new Set();
  for (const [i, s] of series.entries()) {
    const tag = `series[${i}]`;
    if (!isObj(s)) { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(s.id)) pushErr(errors, `${tag}.id: missing or empty`);
    else if (ids.has(s.id)) pushErr(errors, `${tag}.id: duplicate "${s.id}"`);
    else ids.add(s.id);
    if (!['swiss', 'qf', 'sf', 'final'].includes(s.stage)) pushErr(errors, `${tag}.stage: must be swiss|qf|sf|final, got ${JSON.stringify(s.stage)}`);
    if (s.stage === 'swiss' && !(isInt(s.round) && s.round >= 1 && s.round <= 5)) pushErr(errors, `${tag}.round: swiss series need an integer round 1-5, got ${JSON.stringify(s.round)}`);
    if (![1, 3, 5].includes(s.bo)) pushErr(errors, `${tag}.bo: must be 1, 3 or 5, got ${JSON.stringify(s.bo)}`);
    if (!isIso(s.kickoff)) pushErr(errors, `${tag}.kickoff: must be a parseable ISO timestamp`);
    if (!isNonEmptyString(s.home) || !isNonEmptyString(s.away)) pushErr(errors, `${tag}: home/away must be non-empty strings`);
    if (s.pick != null) validatePick(s.pick, s.kickoff, `${tag}.pick`, errors);
    if (typeof s.missed !== 'boolean') pushErr(errors, `${tag}.missed: must be a boolean`);
    if (s.market != null) validateMarket(s.market, `${tag}.market`, errors);
    if (s.result != null) validateResult(s.result, `${tag}.result`, errors);
  }
}

function validateProbBoard(board, path, nameKeys, errors) {
  if (!Array.isArray(board)) { pushErr(errors, `${path}: must be an array`); return; }
  let sum = 0;
  for (const [i, c] of board.entries()) {
    const tag = `${path}[${i}]`;
    if (!isObj(c)) { pushErr(errors, `${tag}: not an object`); continue; }
    for (const k of nameKeys) if (!isNonEmptyString(c[k])) pushErr(errors, `${tag}.${k}: missing or empty`);
    if (typeof c.prob !== 'number' || c.prob < 0 || c.prob > 100) pushErr(errors, `${tag}.prob: must be 0-100, got ${JSON.stringify(c.prob)}`);
    else sum += c.prob;
  }
  if (board.length && Math.abs(sum - 100) > 2) pushErr(errors, `${path}: probabilities sum to ${sum}, expected ~100`);
}

function validateFearless(list, errors) {
  if (!Array.isArray(list)) { pushErr(errors, 'fearless: must be an array'); return; }
  for (const [i, f] of list.entries()) {
    const tag = `fearless[${i}]`;
    if (!isObj(f)) { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(f.team)) pushErr(errors, `${tag}.team: missing or empty`);
    if (typeof f.depth !== 'number') pushErr(errors, `${tag}.depth: must be a number`);
    if (!Array.isArray(f.champs)) pushErr(errors, `${tag}.champs: must be an array`);
  }
}

function validateMeta(list, errors) {
  if (!Array.isArray(list)) { pushErr(errors, 'meta: must be an array'); return; }
  for (const [i, m] of list.entries()) {
    const tag = `meta[${i}]`;
    if (!isObj(m)) { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(m.champ)) pushErr(errors, `${tag}.champ: missing or empty`);
    for (const k of ['picks', 'bans', 'presence', 'winrate']) if (typeof m[k] !== 'number') pushErr(errors, `${tag}.${k}: must be a number`);
  }
}

function validateSources(list, errors) {
  if (!Array.isArray(list)) { pushErr(errors, 'sources: must be an array'); return; }
  for (const [i, src] of list.entries()) {
    const tag = `sources[${i}]`;
    if (!isObj(src)) { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(src.label)) pushErr(errors, `${tag}.label: missing or empty`);
    try {
      if (new URL(src.url).protocol !== 'https:') pushErr(errors, `${tag}.url: must use https`);
    } catch {
      pushErr(errors, `${tag}.url: must be a valid https URL`);
    }
    if (!isIso(src.fetchedAt)) pushErr(errors, `${tag}.fetchedAt: must be a parseable ISO timestamp`);
  }
}

function seriesIsScored(s) {
  return isObj(s) && isObj(s.pick) && isObj(s.result) && isInt(s.result.home) && isInt(s.result.away);
}

function validateRecord(record, series, errors) {
  if (!isObj(record)) { pushErr(errors, 'record: must be an object'); return; }
  if (record.brier != null && !Number.isFinite(record.brier)) pushErr(errors, `record.brier: must be a finite number, got ${JSON.stringify(record.brier)}`);
  if (!Array.isArray(series)) return;
  // Drift guard: record.* are hand-written aggregates of series[] — recompute
  // from picked+resolved series (exact requires the outcome to be right first).
  const scored = series.filter(seriesIsScored).map((s) => {
    const winner = s.result.home > s.result.away ? 'home' : 'away';
    const ok = s.pick.side === winner;
    return { ok, exact: ok && s.pick.score === `${s.result.home}-${s.result.away}` };
  });
  const n = scored.length;
  const okN = scored.filter((x) => x.ok).length;
  const exN = scored.filter((x) => x.exact).length;
  if (typeof record.resolved === 'number' && record.resolved !== n) {
    pushErr(errors, `record.resolved: says ${record.resolved}, but ${n} picked series in series[] have a result`);
  }
  if (typeof record.correctOutcome === 'number' && record.correctOutcome !== okN) {
    pushErr(errors, `record.correctOutcome: says ${record.correctOutcome}, computed ${okN} from series[]`);
  }
  if (typeof record.exactScore === 'number' && record.exactScore !== exN) {
    pushErr(errors, `record.exactScore: says ${record.exactScore}, computed ${exN} from series[]`);
  }
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateWorldsData(data) {
  const errors = [];
  if (!isObj(data)) return { ok: false, errors: ['top-level: must be an object'] };
  if (!isNonEmptyString(data.tournament)) pushErr(errors, 'tournament: missing or empty');
  if (typeof data.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) pushErr(errors, `updated: must be YYYY-MM-DD, got ${JSON.stringify(data.updated)}`);
  if (typeof data.version !== 'number') pushErr(errors, 'version: must be a number');
  if (!['live', 'archive'].includes(data.mode)) pushErr(errors, `mode: must be "live" or "archive", got ${JSON.stringify(data.mode)}`);
  if (!isIso(data.decidedAt)) pushErr(errors, 'decidedAt: must be a parseable ISO timestamp');
  if (!isObj(data.teamLogos)) pushErr(errors, 'teamLogos: must be an object');
  validateSwiss(data.swiss, errors);
  validateSeries(data.series, errors);
  validateProbBoard(data.champion, 'champion', ['team'], errors);
  validateProbBoard(data.mvp, 'mvp', ['player', 'teamCode'], errors);
  validateFearless(data.fearless, errors);
  validateMeta(data.meta, errors);
  validateRecord(data.record, data.series, errors);
  validateSources(data.sources, errors);
  return { ok: errors.length === 0, errors };
}
