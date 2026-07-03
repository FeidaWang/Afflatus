#!/bin/bash
# push-arena-news.sh
# Commits and pushes arena-news.json (public/ + dist/) independently of other changes.
# Run via cron: e.g. "30 22 * * 1-5 /path/to/push-arena-news.sh"

REPO="$HOME/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in"
FILE="public/arena-news.json"
FILE2="dist/arena-news.json"
LOG="$REPO/scripts/push-arena-news.log"

cd "$REPO" || exit 1

echo "[$(date)] Starting arena-news push" >> "$LOG"

# Remove stale lock files if present
rm -f .git/HEAD.lock .git/index.lock

# Keep dist/ copy for local preview parity only — dist/ is gitignored, so it
# is deliberately NOT staged (the old `git add $FILE2` was a silent no-op).
cp "$FILE" "$FILE2" 2>/dev/null

git add "$FILE"

# Commit FIRST (clean index), THEN sync with remote, THEN push.
# The old order (stash --keep-index -> rebase) never actually worked: rebase
# refuses to run with staged changes, so every run logged "cannot rebase" and
# only succeeded because local main happened to never be behind origin. If
# remote were ever ahead, the push would have been rejected and the briefing
# silently dropped. --autostash transparently handles any other uncommitted
# local changes across the rebase.
if git diff --cached --quiet; then
  echo "[$(date)] No changes to arena-news.json, skipping commit" >> "$LOG"
else
  DATE=$(date +%Y-%m-%d)
  git commit -m "Arena pre-market briefing $DATE" >> "$LOG" 2>&1
  git pull --rebase --autostash origin main >> "$LOG" 2>&1
  git push origin main >> "$LOG" 2>&1
  echo "[$(date)] Push complete" >> "$LOG"
fi

echo "[$(date)] Done" >> "$LOG"
