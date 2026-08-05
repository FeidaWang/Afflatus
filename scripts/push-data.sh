#!/bin/bash
# push-data.sh <file> <commit-message>
# Generic version of push-arena-news.sh: commits and pushes a single data JSON
# file independently of other changes. Used by scheduled data-pipeline tasks
# (arena-ledger/leagues/sectors/signal/predlog, etc.) via:
#   bash scripts/push-data.sh public/<file>.json "<commit message>"
#
# Same commit-first-then-sync order as push-arena-news.sh: the old
# "stash --keep-index -> rebase" pattern never actually worked (rebase
# refuses to run with staged changes) — see push-arena-news.sh history.

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$REPO/scripts/push-data.log"

FILE="${1:-}"
MSG="${2:-}"

if [ -z "$FILE" ] || [ -z "$MSG" ]; then
  echo "Usage: push-data.sh <file> <commit-message>" >&2
  exit 1
fi

cd "$REPO" || exit 1

if [ ! -f "$FILE" ]; then
  echo "[$(date)] ERROR: $FILE does not exist, aborting" >> "$LOG"
  exit 1
fi

echo "[$(date)] Starting push for $FILE" >> "$LOG"

# Serialize every data publisher with a project-owned lock. Never move or
# delete Git's own lock files: their presence can indicate a live operation.
PIPELINE_LOCK="$REPO/.git/afflatus-data-pipeline.lock"
if ! mkdir "$PIPELINE_LOCK" 2>/dev/null; then
  echo "[$(date)] ERROR: another data publisher is active; skipping this run" >> "$LOG"
  exit 75
fi
trap 'rmdir "$PIPELINE_LOCK" 2>/dev/null || true' EXIT INT TERM

git add "$FILE"

if git diff --cached --quiet; then
  echo "[$(date)] No changes to $FILE, skipping commit" >> "$LOG"
  exit 0
fi

git commit -m "$MSG" >> "$LOG" 2>&1
git pull --rebase --autostash origin main >> "$LOG" 2>&1
git push origin main >> "$LOG" 2>&1

echo "[$(date)] Done pushing $FILE" >> "$LOG"
