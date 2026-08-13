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
 * Usage: node scripts/queue-arena-outbox.mjs <runId> <commitMessage> <expectedCommitSha> [payloadPath] [resultPath]
 */
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTBOX_DIR = join(__dirname, 'outbox');
const REPO_ROOT = dirname(__dirname);

const [runId, commitMessage, expectedCommitSha, payloadPath, resultPath] = process.argv.slice(2);
if (!/^[A-Za-z0-9._+-]+$/.test(runId || '')
  || !commitMessage
  || !/^[0-9a-f]{40,64}$/.test(expectedCommitSha || '')) {
  console.error('usage: node scripts/queue-arena-outbox.mjs <runId> <commitMessage> <expectedCommitSha> [payloadPath] [resultPath]');
  process.exit(1);
}

function readJsonIfExists(p) {
  if (!p || !existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

mkdirSync(OUTBOX_DIR, { recursive: true });

let transactionId;
let pipelineId;
try {
  const message = execFileSync('git', ['log', '-1', '--format=%B', expectedCommitSha], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const transactionMatches = [...message.matchAll(/^Afflatus-Data-Publish:\s*(\S+)\s*$/gm)];
  const pipelineMatches = [...message.matchAll(/^Afflatus-Data-Pipeline:\s*(\S+)\s*$/gm)];
  if (transactionMatches.length !== 1 || pipelineMatches.length !== 1) throw new Error('missing unique transaction trailers');
  transactionId = transactionMatches[0][1];
  pipelineId = pipelineMatches[0][1];
} catch (error) {
  console.error(`[queue-arena-outbox] expected commit has no stable data transaction identity: ${error.message}`);
  process.exit(1);
}

const entry = {
  runId,
  queuedAt: new Date().toISOString(),
  commitMessage,
  expectedCommitSha,
  transactionId,
  pipelineId,
  note: 'push failed after settlement already succeeded locally — public/arena-ledger.json and arena-runlog.json are correct on disk; only the git sync to origin/main is pending.',
  payload: readJsonIfExists(payloadPath),
  result: readJsonIfExists(resultPath),
};

const outPath = join(OUTBOX_DIR, `${runId}.json`);
const tempPath = `${outPath}.${process.pid}.tmp`;
try {
  const fd = openSync(tempPath, 'wx');
  try {
    writeFileSync(fd, `${JSON.stringify(entry, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tempPath, outPath);
} finally {
  try { unlinkSync(tempPath); } catch { /* renamed or never created */ }
}
console.log(`[queue-arena-outbox] wrote ${outPath}`);
