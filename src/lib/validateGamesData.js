/* Pure validation for public/games-data.json's schema (U21 Phase 1,
   rfcs/2026-07-12-u21-phase1-tech-audit.md §2.7). Unlike leagues-data.json,
   games-data.json has no full per-match array — record.log is a partial
   sample (11 entries for 52 resolved matches as of 2026-07-12), so the
   aggregate counts in `record` are the primary source here, not a derived
   value. This validator checks internal consistency of what IS available:
   the log sample's own ok/exact fields, and weak bounds on the tallies
   (resolved >= log.length, correctOutcome <= resolved, exactScore <=
   correctOutcome) rather than a full recompute. */

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function pushErr(errors, msg) { errors.push(msg); }

function validateLog(log, errors) {
  if (!Array.isArray(log)) { pushErr(errors, 'record.log: must be an array'); return; }
  for (const [i, e] of log.entries()) {
    const tag = `record.log[${i}]`;
    if (!e || typeof e !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(e.id)) pushErr(errors, `${tag}.id: missing or empty`);
    if (typeof e.ok !== 'boolean') pushErr(errors, `${tag}.ok: must be boolean`);
    if (typeof e.exact !== 'boolean') pushErr(errors, `${tag}.exact: must be boolean`);
    // exact scoreline hits require the outcome to be correct first (U19
    // convention — a string coincidence with the outcome called wrong
    // doesn't count as a hit).
    if (e.exact === true && e.ok !== true) pushErr(errors, `${tag}: exact=true but ok=false — exact must imply ok`);
  }
}

function validateProbBoard(board, path, errors) {
  if (!Array.isArray(board)) { pushErr(errors, `${path}: must be an array`); return; }
  for (const [i, c] of board.entries()) {
    const tag = `${path}[${i}]`;
    if (!c || typeof c !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(c.team) && !isNonEmptyString(c.name)) pushErr(errors, `${tag}: missing team/name`);
    if (typeof c.prob !== 'number' || c.prob < 0 || c.prob > 100) pushErr(errors, `${tag}.prob: must be 0-100, got ${JSON.stringify(c.prob)}`);
  }
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateGamesData(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!isNonEmptyString(data.tournament)) errors.push('tournament: missing or empty');
  if (!isNonEmptyString(data.updated)) errors.push('updated: missing or empty');

  const r = data.record;
  if (!r || typeof r !== 'object') {
    errors.push('record: missing or not an object');
  } else {
    for (const f of ['resolved', 'correctOutcome', 'exactScore']) {
      if (typeof r[f] !== 'number' || r[f] < 0) errors.push(`record.${f}: must be a non-negative number, got ${JSON.stringify(r[f])}`);
    }
    validateLog(r.log, errors);
    if (typeof r.resolved === 'number' && Array.isArray(r.log) && r.log.length > r.resolved) {
      pushErr(errors, `record.log has ${r.log.length} entries but record.resolved says only ${r.resolved} matches are resolved`);
    }
    if (typeof r.correctOutcome === 'number' && typeof r.resolved === 'number' && r.correctOutcome > r.resolved) {
      pushErr(errors, `record.correctOutcome (${r.correctOutcome}) exceeds record.resolved (${r.resolved})`);
    }
    if (typeof r.exactScore === 'number' && typeof r.correctOutcome === 'number' && r.exactScore > r.correctOutcome) {
      pushErr(errors, `record.exactScore (${r.exactScore}) exceeds record.correctOutcome (${r.correctOutcome}) — an exact hit must also be a correct-outcome hit`);
    }
  }

  if (data.champions != null) validateProbBoard(data.champions, 'champions', errors);
  if (data.players != null) validateProbBoard(data.players, 'players', errors);

  return { ok: errors.length === 0, errors };
}
