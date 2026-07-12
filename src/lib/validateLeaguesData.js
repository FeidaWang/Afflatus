/* Pure validation for public/leagues-data.json's schema (U21 Phase 1,
   rfcs/2026-07-12-u21-phase1-tech-audit.md §2.7). Same purpose as
   validateSectorsData.js / validateSignalEvents.js: the leagues-msi-daily
   scheduled task hand-writes this file unattended and nobody reviews the
   diff before it commits+pushes — this is the syntax/shape gate.

   §2.3 finding this validator specifically guards against: record.log /
   record.resolved etc. are hand-maintained aggregates of the series[]
   array and were observed to drift (13 series resolved, only 8 log
   entries) — this validator checks the two stay consistent so the drift
   is caught here instead of surfacing as a wrong number on stats.html. */

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function pushErr(errors, msg) { errors.push(msg); }

function seriesIsResolved(s) {
  return s && s.result && typeof s.result.home === 'number' && typeof s.result.away === 'number';
}

function validateSeries(series, errors) {
  if (!Array.isArray(series)) { pushErr(errors, 'series: must be an array'); return; }
  const ids = new Set();
  for (const [i, s] of series.entries()) {
    const tag = `series[${i}]`;
    if (!s || typeof s !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(s.id)) pushErr(errors, `${tag}.id: missing or empty`);
    else if (ids.has(s.id)) pushErr(errors, `${tag}.id: duplicate "${s.id}"`);
    else ids.add(s.id);
    if (!isNonEmptyString(s.home) || !isNonEmptyString(s.away)) pushErr(errors, `${tag}: home/away must be non-empty strings`);
    if (s.opus !== 'home' && s.opus !== 'away') pushErr(errors, `${tag}.opus: must be "home" or "away", got ${JSON.stringify(s.opus)}`);
    if (typeof s.conf !== 'number' || s.conf < 0.5 || s.conf > 1) pushErr(errors, `${tag}.conf: must be a number in [0.5,1], got ${JSON.stringify(s.conf)}`);
    if (s.result != null && !seriesIsResolved(s)) pushErr(errors, `${tag}.result: present but home/away are not both numbers`);
  }
}

function validateProbBoard(board, path, errors, expectSum) {
  if (!Array.isArray(board)) { pushErr(errors, `${path}: must be an array`); return; }
  let sum = 0;
  for (const [i, c] of board.entries()) {
    const tag = `${path}[${i}]`;
    if (!c || typeof c !== 'object') { pushErr(errors, `${tag}: not an object`); continue; }
    if (!isNonEmptyString(c.team)) pushErr(errors, `${tag}.team: missing or empty`);
    if (typeof c.prob !== 'number' || c.prob < 0 || c.prob > 100) pushErr(errors, `${tag}.prob: must be 0-100, got ${JSON.stringify(c.prob)}`);
    else sum += c.prob;
  }
  if (expectSum && board.length && Math.abs(sum - 100) > 2) pushErr(errors, `${path}: probabilities sum to ${sum}, expected ~100`);
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateLeaguesData(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!isNonEmptyString(data.tournament)) errors.push('tournament: missing or empty');
  if (!isNonEmptyString(data.updated)) errors.push('updated: missing or empty');
  validateSeries(data.series, errors);
  if (data.champion != null) validateProbBoard(data.champion, 'champion', errors, true);
  if (data.mvp != null) validateProbBoard(data.mvp, 'mvp', errors, false);

  // §2.3 aggregate-drift guard: record.resolved/correctOutcome/exactScore
  // must match what series[] itself says, computed the same way stats.html
  // computes it (exact requires the outcome to be correct first — U19 fix).
  if (data.record && Array.isArray(data.series)) {
    const resolved = data.series.filter(seriesIsResolved);
    const scored = resolved.map((s) => {
      const actualHome = s.result.home > s.result.away;
      const ok = actualHome === (s.opus === 'home');
      const exact = ok && s.opusScore === `${s.result.home}-${s.result.away}`;
      return { ok, exact };
    });
    const n = scored.length;
    const okN = scored.filter((x) => x.ok).length;
    const exN = scored.filter((x) => x.exact).length;
    if (typeof data.record.resolved === 'number' && data.record.resolved !== n) {
      pushErr(errors, `record.resolved: says ${data.record.resolved}, but ${n} series in series[] actually have a result`);
    }
    if (typeof data.record.correctOutcome === 'number' && data.record.correctOutcome !== okN) {
      pushErr(errors, `record.correctOutcome: says ${data.record.correctOutcome}, computed ${okN} from series[]`);
    }
    if (typeof data.record.exactScore === 'number' && data.record.exactScore !== exN) {
      pushErr(errors, `record.exactScore: says ${data.record.exactScore}, computed ${exN} from series[]`);
    }
  }

  return { ok: errors.length === 0, errors };
}
