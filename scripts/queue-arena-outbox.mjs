#!/usr/bin/env node
/* queue-arena-outbox.mjs — writes one scripts/outbox/<runId>.json entry
 * (urgent.md Part 4 §19.3.3). Called by publish-arena-run.sh ONLY when a
 * git push has failed (no network) after apply-arena-run.mjs already
 * settled successfully and wrote public/arena-ledger.json + arena-runlog.json
 * to disk. Those writes are NOT re-done here and are already safe — this
 * script exists purely so there is an auditable record of "a run happened
 * and is waiting to sync", separate from the ledger file itself, in case
 * the workdir gets clobbered before the next successful push. The next
 * scheduled task's publish step (§19.3.3) re-attempts committing/pushing
 * whatever is currently on disk and clears this entry once that succeeds
 * — it never re-executes the settlement logic (that already happened and
 * is idempotency-protected via apply-arena-run.mjs's own runlog check).
 *
 * Usage: node scripts/queue-arena-outbox.mjs <runId> <commitMessage> [payloadPath] [resultPath]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTBOX_DIR = join(__dirname, 'outbox');

const [runId, commitMessage, payloadPath, resultPath] = process.argv.slice(2);
if (!runId || !commitMessage) {
  console.error('usage: node scripts/queue-arena-outbox.mjs <runId> <commitMessage> [payloadPath] [resultPath]');
  process.exit(1);
}

function readJsonIfExists(p) {
  if (!p || !existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

mkdirSync(OUTBOX_DIR, { recursive: true });

const entry = {
  runId,
  queuedAt: new Date().toISOString(),
  commitMessage,
  note: 'push failed after settlement already succeeded locally — public/arena-ledger.json and arena-runlog.json are correct on disk; only the git sync to origin/main is pending.',
  payload: readJsonIfExists(payloadPath),
  result: readJsonIfExists(resultPath),
};

const outPath = join(OUTBOX_DIR, `${runId}.json`);
writeFileSync(outPath, `${JSON.stringify(entry, null, 2)}\n`);
console.log(`[queue-arena-outbox] wrote ${outPath}`);
