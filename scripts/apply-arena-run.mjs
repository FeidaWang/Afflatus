#!/usr/bin/env node
/* apply-arena-run.mjs — deterministic settlement CLI for Arena Autopilot.
 *
 * The scheduled task (Analyst S/P/T at their window, weekly review) is the
 * "LLM proposes" half: it gathers a market digest (quotes via /api/quote,
 * news via WebSearch) and reasons out a JSON order proposal following
 * prompts/arena-autopilot.md. It must NOT touch arena-ledger.json directly
 * — instead it writes its proposal to a JSON file and runs this script,
 * which is the "code settles" half: it calls the already-tested
 * src/lib/arenaRun.js -> src/lib/arenaRules.js pipeline to validate, fill,
 * mark-to-market, sweep stop-losses, and check circuit-breaker/season-reset,
 * then writes ledger + runlog candidates outside the repository. The grouped
 * data publisher is the only component allowed to validate/commit them.
 *
 * Part 4 (urgent.md §19.3.1, 2026-07-23): now also idempotent. Every run
 * carries a `window` (one of src/lib/arenaReconcile.js's WINDOWS) and is
 * identified by (etDateStr, window, book) — the same run identity
 * arena-runlog.json enforces uniqueness on. If that identity already has a
 * terminal `done` or `missed` entry in arena-runlog.json, this script fails
 * closed instead of rewriting history. A current-window `queued` identity may
 * advance to `done` exactly once. On success
 * it appends/updates the runlog entry itself, so the calling task commits
 * BOTH public/arena-ledger.json and public/arena-runlog.json together.
 *
 * Usage: node scripts/apply-arena-run.mjs <run-input.json> --output=<tmpdir>
 *        [--base-url=https://feida.au]
 *
 * run-input.json shape:
 * {
 *   "book": "S" | "P" | "T",
 *   "window": "open-window",               // one of arenaReconcile.WINDOWS
 *   "etDateStr": "2026-07-06",             // US/Eastern trading-day date
 *   "proposedOrders": [ { "proposalId":"arena:..." } ],
 *   "reviewZh": "...", "reviewEn": "...",  // optional natural-language reflection
 *   "benchPct": { "spyPct": 0.4, "smhPct": 0.9 },  // optional
 *   "newPromptVersionOnReset": "A-v2",     // optional, only used if season reset fires
 *   "valuationOnly": false,                 // true only for current-session
 *                                            // S/P post-market mark-to-market
 *   "note": "..."                           // optional, stored in the runlog entry
 * }
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { runArenaLedger } from '../src/lib/arenaRun.js';
import { bindPremarketOrders } from '../src/lib/arenaDecisionProvenance.js';
import {
  assessArenaExecutionInvocation,
  collectArenaExecutionSymbols,
  consumedArenaProposalIdsFromLedger,
  fetchArenaExecutionQuotes,
} from '../src/lib/arenaExecution.js';
import { WINDOWS, upsertRunlogEntry } from '../src/lib/arenaReconcile.js';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaPicks } from '../src/lib/validateArenaPicks.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const LEDGER_PATH = join(REPO, 'public', 'arena-ledger.json');
const UNIVERSE_PATH = join(REPO, 'public', 'arena-universe.json');
const RUNLOG_PATH = join(REPO, 'public', 'arena-runlog.json');
const PICKS_PATH = join(REPO, 'public', 'arena-picks.json');

function fail(msg) {
  console.error(`[apply-arena-run] ERROR: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
let inputPath = null;
let outputValue = null;
let baseUrl = 'https://feida.au';
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--output' || arg === '--base-url') {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`${arg} requires a value`);
    if (arg === '--output') outputValue = value;
    else baseUrl = value;
    index += 1;
  } else if (arg.startsWith('--output=')) outputValue = arg.slice('--output='.length);
  else if (arg.startsWith('--base-url=')) baseUrl = arg.slice('--base-url='.length);
  else if (arg.startsWith('--')) fail(`unknown option ${arg}`);
  else if (!inputPath) inputPath = arg;
  else fail(`unexpected positional argument ${arg}`);
}
if (!inputPath || !outputValue) {
  fail('usage: node scripts/apply-arena-run.mjs <run-input.json> --output=<tmpdir> [--base-url=https://feida.au]');
}
if (baseUrl !== 'https://feida.au' && baseUrl !== 'https://feida.au/') {
  fail('--base-url must be the trusted production origin https://feida.au; tests inject fetch into the pure quote module');
}
const outputDirectory = resolve(outputValue);
const outputRelative = relative(REPO, outputDirectory);
if (!outputRelative.startsWith('..')) fail('--output must be outside the repository');

let input;
try {
  input = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (e) {
  fail(`could not read/parse ${inputPath}: ${e.message}`);
}

const {
  book, window, etDateStr, proposedOrders, reviewZh, reviewEn,
  benchPct, newPromptVersionOnReset, note, late, catchup, valuationOnly = false,
  decisionMissed = false,
} = input;
if (proposedOrders != null && !Array.isArray(proposedOrders)) fail('run-input.json "proposedOrders" must be an array');
if (Object.hasOwn(input, 'nowIso')) fail('run-input.json "nowIso" is forbidden; execution always uses the real wall clock');
if (Object.hasOwn(input, 'priceMap')) fail('run-input.json "priceMap" is forbidden; execution fetches production quote receipts itself');
if (late || catchup) fail('apply-arena-run is live-window only; recovery/catch-up cannot execute through this CLI');
if (valuationOnly && (proposedOrders || []).length) fail('valuationOnly requires an empty proposedOrders array');
if (decisionMissed && !(valuationOnly && (
  (book === 'T' && window === 'post-market')
  || (['S', 'P'].includes(book) && ['open-window', 'late-window'].includes(window))
))) {
  fail('decisionMissed requires a zero-order T post-market or S/P open/late valuation');
}
if (!book || !etDateStr) fail('run-input.json must include "book" and "etDateStr"');
if (!window || !WINDOWS.includes(window)) fail(`run-input.json "window" must be one of ${WINDOWS.join('/')}, got ${JSON.stringify(window)}`);

const candidateLedgerPath = outputDirectory ? join(outputDirectory, basename(LEDGER_PATH)) : null;
const candidateRunlogPath = outputDirectory ? join(outputDirectory, basename(RUNLOG_PATH)) : null;
const hasCandidateLedger = Boolean(candidateLedgerPath && existsSync(candidateLedgerPath));
const hasCandidateRunlog = Boolean(candidateRunlogPath && existsSync(candidateRunlogPath));
if (hasCandidateLedger !== hasCandidateRunlog) {
  fail('candidate directory must contain both arena-ledger.json and arena-runlog.json, or neither');
}
const baselineLedgerPath = hasCandidateLedger ? candidateLedgerPath : LEDGER_PATH;
const baselineRunlogPath = hasCandidateRunlog ? candidateRunlogPath : RUNLOG_PATH;
const runlogFull = existsSync(baselineRunlogPath) ? JSON.parse(readFileSync(baselineRunlogPath, 'utf8')) : { runs: [] };
const wallNow = new Date();
let executionClock;
try {
  executionClock = assessArenaExecutionInvocation({
    book, window, etDateStr, runlog: runlogFull, wallNow, valuationOnly: Boolean(valuationOnly), decisionMissed: Boolean(decisionMissed),
  });
} catch (error) {
  fail(error.message);
}

const ledgerFull = JSON.parse(readFileSync(baselineLedgerPath, 'utf8'));
const universeFull = JSON.parse(readFileSync(UNIVERSE_PATH, 'utf8'));
const universe = universeFull.symbols.map((s) => s.sym);
let picksSnapshot = null;
if (!valuationOnly || decisionMissed) {
  try { picksSnapshot = JSON.parse(readFileSync(PICKS_PATH, 'utf8')); } catch (error) { fail(`could not read/parse ${PICKS_PATH}: ${error.message}`); }
  const picksValidation = validateArenaPicks(picksSnapshot);
  if (!picksValidation.ok) fail(`arena-picks.json: ${picksValidation.errors.join('; ')}`);
  if (!decisionMissed && picksSnapshot.date !== etDateStr) fail('arena-picks.json does not contain a decision snapshot for the current execution session');
  if (decisionMissed && picksSnapshot.date === etDateStr
      && picksSnapshot.decisionStatus === 'sealed' && picksSnapshot.executable === true) {
    fail('decisionMissed cannot overwrite an existing sealed current-session decision');
  }
}

let symbols;
try {
  symbols = collectArenaExecutionSymbols(ledgerFull, picksSnapshot, book, proposedOrders || []);
} catch (error) {
  fail(error.message);
}
let priceMap;
let quoteReceipts;
try {
  ({ priceMap, receipts: quoteReceipts } = await fetchArenaExecutionQuotes({
    symbols, window, baseUrl, timeoutMs: 12_000,
  }));
} catch (error) {
  fail(error.message);
}

// A request beginning at the final second of a window must not settle after
// that window closes. Re-read the real clock after every quote has arrived and
// use this later timestamp for both the second gate and all trade records.
try {
  executionClock = assessArenaExecutionInvocation({
    book, window, etDateStr, runlog: runlogFull, wallNow: new Date(), valuationOnly: Boolean(valuationOnly), decisionMissed: Boolean(decisionMissed),
  });
} catch (error) {
  fail(`execution window closed while fetching quotes: ${error.message}`);
}
const nowIso = executionClock.nowIso;

let executionOrders = [];
let skippedProposals = [];
if ((proposedOrders || []).length) {
  try {
    const bound = bindPremarketOrders({
      snapshot: picksSnapshot,
      book,
      sessionDate: etDateStr,
      window,
      nowIso,
      priceMap,
      proposedOrders,
      // A prior quote-threshold skip is not a fill and may be retried in a
      // second signed window. Only immutable ledger trades consume a proposal.
      consumedProposalIds: consumedArenaProposalIdsFromLedger(ledgerFull),
    });
    executionOrders = bound.orders;
    skippedProposals = bound.skipped.map((skip) => ({
      ...skip,
      ...(quoteReceipts[skip.sym] ? { executionQuote: quoteReceipts[skip.sym] } : {}),
    }));
  } catch (error) {
    fail(`sealed proposal verification failed: ${error.message}`);
  }
}

let result;
try {
  result = runArenaLedger(ledgerFull, book, {
    etDateStr, nowIso, priceMap, proposedOrders: executionOrders,
    universe, reviewZh, reviewEn, benchPct, newPromptVersionOnReset,
    quoteReceipts, requireExecutionQuoteReceipt: true, valuationOnly: Boolean(valuationOnly),
    executionWindow: window,
  });
} catch (e) {
  fail(`runArenaLedger threw: ${e.message}`);
}

const executionSkips = result.summary.executionSkipped.map(({ order, reason }) => ({
  proposalId: order.proposalId, sym: order.sym, reason,
  ...(order.executionQuote ? { executionQuote: order.executionQuote } : {}),
}));
skippedProposals = [...skippedProposals, ...executionSkips];
const runlogEntry = {
  date: etDateStr, window, model: book, status: decisionMissed ? 'missed' : 'done',
  ordersProposed: (proposedOrders || []).length,
  ordersFilled: result.summary.filled.length,
  ordersSkipped: skippedProposals.length,
  proposalIds: (proposedOrders || []).map((order) => order.proposalId).filter(Boolean),
  skippedProposals,
  quoteReceipts,
  note: note || (valuationOnly
    ? 'current-session post-market valuation via fresh production quote receipts; zero orders and zero retroactive risk exits.'
    : `settled via apply-arena-run.mjs — ${result.summary.filled.length} filled, ${skippedProposals.length} entry-threshold skips, ${result.summary.rejected.length} risk rejections.`),
  ...(valuationOnly ? { valuationOnly: true } : {}),
  ...(decisionMissed ? { decisionMissed: true } : {}),
};
const nextRunlog = upsertRunlogEntry(runlogFull, runlogEntry);
function prepareSettlement() {
  const ledgerValidation = validateArenaLedger(result.ledger);
  if (!ledgerValidation.ok) throw new Error(`arena-ledger.json: ${ledgerValidation.errors.join('; ')}`);
  const runlogValidation = validateArenaRunlog(nextRunlog);
  if (!runlogValidation.ok) throw new Error(`arena-runlog.json: ${runlogValidation.errors.join('; ')}`);
  return [
    { path: LEDGER_PATH, data: result.ledger },
    { path: RUNLOG_PATH, data: nextRunlog },
  ];
}

try {
  const prepared = prepareSettlement();
  mkdirSync(outputDirectory, { recursive: true });
  for (const entry of prepared) {
    writeFileSync(join(outputDirectory, basename(entry.path)), `${JSON.stringify(entry.data, null, 2)}\n`);
  }
} catch (error) {
  fail(`${error.phase || 'publish'}: ${error.message}`);
}

const summary = { ...result.summary, skippedProposals, candidateOnly: true, outputDirectory };
console.log(JSON.stringify(summary, null, 2));
console.log(`[apply-arena-run] wrote candidates to ${outputDirectory} — day ${result.summary.day}, ` +
  `${result.summary.filled.length} filled, ${result.summary.rejected.length} rejected, ` +
  `riskLockdown=${result.summary.riskLockdown}, seasonReset=${result.summary.seasonReset}`);
