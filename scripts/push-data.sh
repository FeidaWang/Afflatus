#!/bin/bash
# push-data.sh <file> <commit-message>
# Pushes a data JSON transaction commit independently of other changes. Used
# by scheduled data-pipeline tasks after `data:publish` has validated, renamed,
# build-smoked and committed the complete output group.
# (arena-ledger/leagues/sectors/signal/predlog, etc.) via:
#   bash scripts/push-data.sh public/<file>.json "<commit message>"
#
# Commit creation deliberately stays in the atomic publisher; this helper is
# network synchronization only.

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

if ! git diff --quiet -- "$FILE" || ! git diff --cached --quiet -- "$FILE"; then
  echo "[$(date)] ERROR: $FILE is dirty; refusing to bypass data:publish" >> "$LOG"
  exit 1
fi

git pull --rebase --autostash origin main >> "$LOG" 2>&1
git push origin main >> "$LOG" 2>&1

echo "[$(date)] Done pushing $FILE" >> "$LOG"
