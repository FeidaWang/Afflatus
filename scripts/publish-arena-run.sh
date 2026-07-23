#!/bin/bash
# publish-arena-run.sh <runId> <commit-message> [<payload-json-path> <result-json-path>]
#
# Commits + pushes public/arena-ledger.json and public/arena-runlog.json
# together after an apply-arena-run.mjs settlement (urgent.md Part 4
# §19.3.3's offline outbox). If the push fails (no network), the ledger and
# runlog writes are ALREADY correct and safe on disk — apply-arena-run.mjs
# wrote them before this script ever runs — so nothing here re-executes any
# settlement logic. This script only queues a scripts/outbox/<runId>.json
# audit record (via queue-arena-outbox.mjs) and leaves the local commit in
# place for the next scheduled run to pick up and retry pushing.
#
#   runId              e.g. "2026-07-23_open-window_S" (date_window_model,
#                      matches src/lib/arenaReconcile.js's runIdentity())
#   commit-message     e.g. "Arena Model S open-window run 2026-07-23"
#   payload-json-path  optional — this run's run-input.json (for the outbox record)
#   result-json-path   optional — apply-arena-run.mjs's summary JSON (same)
#
# Same commit-first-then-sync order as push-data.sh/push-arena-news.sh (the
# old "stash --keep-index -> rebase" pattern never actually worked).

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$REPO/scripts/publish-arena-run.log"
OUTBOX_DIR="$REPO/scripts/outbox"

RUN_ID="${1:-}"
MSG="${2:-}"
PAYLOAD_PATH="${3:-}"
RESULT_PATH="${4:-}"

if [ -z "$RUN_ID" ] || [ -z "$MSG" ]; then
  echo "Usage: publish-arena-run.sh <runId> <commit-message> [<payload-json-path> <result-json-path>]" >&2
  exit 1
fi

cd "$REPO" || exit 1
mkdir -p "$OUTBOX_DIR"

echo "[$(date)] --- publish-arena-run start: $RUN_ID ---" >> "$LOG"

# Remove stale lock files if present. `mv` not `rm` — some sandboxes block
# unlink under .git/ even when nothing holds the lock; `mv` works there and
# is harmless on a normal machine too.
for f in .git/index.lock .git/HEAD.lock .git/refs/remotes/origin/main.lock .git/REBASE_HEAD.lock .git/packed-refs.lock; do
  [ -f "$f" ] && mv "$f" "$f.bak_$(date +%s)" 2>/dev/null
done

# ---- flush any outbox backlog from a previous offline run first ----
# Outbox entries are audit records only, not work to redo: whatever they
# describe already succeeded locally. Flushing = re-attempting the git sync
# below, which covers any backlog automatically since it just commits +
# pushes whatever is currently sitting in the two files. Once push
# succeeds, clear the backlog entries so they don't pile up forever.
shopt -s nullglob
OUTBOX_FILES=("$OUTBOX_DIR"/*.json)
BACKLOG_COUNT=${#OUTBOX_FILES[@]}
if [ "$BACKLOG_COUNT" -gt 0 ]; then
  echo "[$(date)] $BACKLOG_COUNT outbox entr(y/ies) pending from earlier offline run(s) — this push will flush them" >> "$LOG"
fi

# ---- commit + push this run's ledger/runlog together ----
git add public/arena-ledger.json public/arena-runlog.json 2>>"$LOG"

if git diff --cached --quiet; then
  echo "[$(date)] no staged changes for $RUN_ID (likely an idempotent no-op run)" >> "$LOG"
else
  git commit -m "$MSG" >> "$LOG" 2>&1
fi

PUSH_OK=0
if git pull --rebase --autostash origin main >> "$LOG" 2>&1 && git push origin main >> "$LOG" 2>&1; then
  PUSH_OK=1
fi

if [ "$PUSH_OK" -eq 1 ]; then
  echo "[$(date)] push succeeded for $RUN_ID" >> "$LOG"
  if [ "$BACKLOG_COUNT" -gt 0 ]; then
    for f in "${OUTBOX_FILES[@]}"; do mv "$f" "$f.flushed_$(date +%s)" 2>/dev/null || rm -f "$f" 2>/dev/null; done
    echo "[$(date)] cleared $BACKLOG_COUNT outbox entr(y/ies) — confirmed synced" >> "$LOG"
  fi
else
  echo "[$(date)] push FAILED for $RUN_ID — ledger/runlog are committed locally and safe; queuing an outbox audit record" >> "$LOG"
  node "$REPO/scripts/queue-arena-outbox.mjs" "$RUN_ID" "$MSG" "$PAYLOAD_PATH" "$RESULT_PATH" >> "$LOG" 2>&1
fi

echo "[$(date)] --- publish-arena-run done: $RUN_ID (push_ok=$PUSH_OK) ---" >> "$LOG"
exit 0
