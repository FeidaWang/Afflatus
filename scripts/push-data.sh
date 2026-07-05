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

# Remove stale lock files if present
rm -f .git/HEAD.lock .git/index.lock

git add "$FILE"

if git diff --cached --quiet; then
  echo "[$(date)] No changes to $FILE, skipping commit" >> "$LOG"
  exit 0
fi

git commit -m "$MSG" >> "$LOG" 2>&1
git pull --rebase --autostash origin main >> "$LOG" 2>&1
git push origin main >> "$LOG" 2>&1

echo "[$(date)] Done pushing $FILE" >> "$LOG"
