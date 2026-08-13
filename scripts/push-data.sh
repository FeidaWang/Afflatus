#!/bin/bash
# push-data.sh <declared-output> <audit-message>
#
# Network-only publisher for a data:publish transaction already committed at
# HEAD. It verifies the commit boundary, reconciles only with origin/main,
# reruns the complete verification suite after every reconciliation, and
# independently reads back the exact remote SHA. One remote race is retried.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$REPO/scripts/push-data.log"
REMOTE="origin"
TARGET_REF="refs/heads/main"
export GIT_TERMINAL_PROMPT=0
export GCM_INTERACTIVE=Never
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=2}"
export GIT_CONFIG_COUNT="${GIT_CONFIG_COUNT:-2}"
export GIT_CONFIG_KEY_0="${GIT_CONFIG_KEY_0:-http.lowSpeedLimit}"
export GIT_CONFIG_VALUE_0="${GIT_CONFIG_VALUE_0:-1024}"
export GIT_CONFIG_KEY_1="${GIT_CONFIG_KEY_1:-http.lowSpeedTime}"
export GIT_CONFIG_VALUE_1="${GIT_CONFIG_VALUE_1:-30}"

FILE="${1:-}"
MSG="${2:-}"
PIPELINE_ID=""
RANGE_PIPELINE_IDS=""
PUSH_SHA=""
REBASE_ACTIVE=0

timestamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

log_event() {
  local event="$1"
  local status="$2"
  shift 2
  printf 'timestamp=%s component=push-data event=%s status=%s' "$(timestamp)" "$event" "$status" >> "$LOG"
  if [ "$#" -gt 0 ]; then printf ' %s' "$@" >> "$LOG"; fi
  printf '\n' >> "$LOG"
}

fail_stage() {
  local code="$1"
  local event="$2"
  local message="$3"
  log_event "$event" "failed" "target=$TARGET_REF"
  printf '[%s] ERROR: %s\n' "$(timestamp)" "$message" >> "$LOG"
  printf 'push-data: %s\n' "$message" >&2
  exit "$code"
}

assert_clean() {
  if ! git diff --quiet -- \
    || ! git diff --cached --quiet --; then
    fail_stage 1 "preflight" "tracked worktree or index is dirty; refusing network synchronization"
  fi
}

cleanup_on_signal() {
  local code="$1"
  if [ "$REBASE_ACTIVE" -eq 1 ]; then
    git rebase --abort >> "$LOG" 2>&1 || true
    REBASE_ACTIVE=0
  fi
  exit "$code"
}

cleanup_on_exit() {
  local code=$?
  if [ "$REBASE_ACTIVE" -eq 1 ]; then
    git rebase --abort >> "$LOG" 2>&1 || true
    REBASE_ACTIVE=0
  fi
  exit "$code"
}

verify_unpublished_range() {
  local remote_sha="$1"
  local revisions revision observed
  if git merge-base --is-ancestor HEAD "$remote_sha"; then
    return 0
  fi
  if ! revisions="$(git rev-list --reverse "$remote_sha..HEAD" 2>>"$LOG")"; then
    fail_stage 1 "transaction-range" "could not enumerate unpublished commits"
  fi
  if [ -z "$revisions" ]; then
    fail_stage 1 "transaction-range" "HEAD is not reachable from remote and has no unpublished transaction"
  fi
  while IFS= read -r revision; do
    [ -n "$revision" ] || continue
    if ! observed="$(node scripts/verify-data-transaction-head.mjs "" "$revision" 2>>"$LOG")"; then
      fail_stage 1 "transaction-range" "unpublished commit $revision is not a valid complete data transaction"
    fi
    if ! printf '%s\n' "$RANGE_PIPELINE_IDS" | grep -Fqx "$observed"; then
      RANGE_PIPELINE_IDS="${RANGE_PIPELINE_IDS}${RANGE_PIPELINE_IDS:+$'\n'}${observed}"
    fi
    log_event "transaction-range" "ok" "sha=$revision" "pipeline=$observed"
  done <<< "$revisions"
}

verify_transaction_head() {
  local observed
  if ! observed="$(node scripts/verify-data-transaction-head.mjs "$FILE" 2>>"$LOG")"; then
    fail_stage 1 "transaction" "HEAD is not a valid declared data-publish transaction"
  fi
  if [ -z "$PIPELINE_ID" ]; then
    PIPELINE_ID="$observed"
  elif [ "$observed" != "$PIPELINE_ID" ]; then
    fail_stage 1 "transaction" "reconciliation changed the transaction pipeline identity"
  fi
}

run_full_verification() {
  local scoped_pipeline
  log_event "validation" "started" "pipeline=$PIPELINE_ID"
  if ! npm run data:check >> "$LOG" 2>&1; then
    fail_stage 1 "data-check" "npm run data:check failed after reconciliation"
  fi
  if [ -z "$RANGE_PIPELINE_IDS" ]; then RANGE_PIPELINE_IDS="$PIPELINE_ID"; fi
  while IFS= read -r scoped_pipeline; do
    [ -n "$scoped_pipeline" ] || continue
    if ! npm run data:freshness:strict -- --pipeline="$scoped_pipeline" >> "$LOG" 2>&1; then
      fail_stage 1 "freshness-strict" "scoped strict freshness failed for $scoped_pipeline after reconciliation"
    fi
  done <<< "$RANGE_PIPELINE_IDS"
  if ! npm test >> "$LOG" 2>&1; then
    fail_stage 1 "test" "npm test failed after reconciliation"
  fi
  if ! npm run build >> "$LOG" 2>&1; then
    fail_stage 1 "build" "npm run build failed after reconciliation"
  fi
  assert_clean
  log_event "validation" "ok" "pipeline=$PIPELINE_ID"
}

reconcile_and_validate() {
  local before_sha remote_sha mode post_pipeline
  if ! git fetch --no-tags "$REMOTE" "$TARGET_REF" >> "$LOG" 2>&1; then
    fail_stage 75 "fetch" "failed to fetch $REMOTE/$TARGET_REF"
  fi
  if ! remote_sha="$(git rev-parse --verify 'FETCH_HEAD^{commit}' 2>>"$LOG")"; then
    fail_stage 75 "fetch" "the fetched main ref is not a commit"
  fi
  if ! before_sha="$(git rev-parse --verify 'HEAD^{commit}' 2>>"$LOG")"; then
    fail_stage 1 "committed" "HEAD is not a commit during reconciliation"
  fi
  RANGE_PIPELINE_IDS=""

  if git merge-base --is-ancestor "$remote_sha" "$before_sha"; then
    mode="up-to-date"
  elif git merge-base --is-ancestor "$before_sha" "$remote_sha"; then
    if ! git merge --ff-only "$remote_sha" >> "$LOG" 2>&1; then
      fail_stage 75 "reconciled" "fast-forward to $REMOTE/$TARGET_REF failed"
    fi
    mode="fast-forwarded"
  else
    REBASE_ACTIVE=1
    if ! git rebase "$remote_sha" >> "$LOG" 2>&1; then
      git rebase --abort >> "$LOG" 2>&1 || true
      REBASE_ACTIVE=0
      fail_stage 75 "reconciled" "rebase onto $REMOTE/$TARGET_REF conflicted"
    fi
    REBASE_ACTIVE=0
    mode="rebased"
  fi
  log_event "reconciled" "$mode" "remote_sha=$remote_sha"
  assert_clean

  # A rebase rewrites the transaction commit, so prove the new HEAD has the
  # same configured identity and path boundary. A fast-forward means remote
  # already contains the witnessed transaction; its tip may be a later commit.
  if [ "$mode" != "fast-forwarded" ]; then
    if ! post_pipeline="$(node scripts/verify-data-transaction-head.mjs "$FILE" 2>>"$LOG")"; then
      fail_stage 1 "transaction" "reconciled HEAD is not a valid data-publish transaction"
    fi
    if [ "$post_pipeline" != "$PIPELINE_ID" ]; then
      fail_stage 1 "transaction" "reconciliation changed the transaction pipeline identity"
    fi
    verify_unpublished_range "$remote_sha"
  else
    RANGE_PIPELINE_IDS="$PIPELINE_ID"
  fi
  run_full_verification
}

if [ -z "$FILE" ] || [ -z "$MSG" ]; then
  echo "Usage: push-data.sh <declared-output> <audit-message>" >&2
  exit 64
fi

cd "$REPO"

if [ ! -f "$FILE" ]; then
  fail_stage 1 "preflight" "$FILE does not exist"
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>>"$LOG"; then
  fail_stage 1 "preflight" "$REPO is not a Git worktree"
fi
if ! GIT_DIR="$(git rev-parse --absolute-git-dir 2>>"$LOG")"; then
  fail_stage 1 "preflight" "could not resolve the Git directory"
fi
if [ -e "$GIT_DIR/MERGE_HEAD" ] || [ -e "$GIT_DIR/CHERRY_PICK_HEAD" ] \
  || [ -d "$GIT_DIR/rebase-merge" ] || [ -d "$GIT_DIR/rebase-apply" ]; then
  fail_stage 1 "preflight" "an unfinished Git operation is active"
fi
if ! git ls-files --error-unmatch -- "$FILE" >/dev/null 2>>"$LOG"; then
  fail_stage 1 "preflight" "$FILE is not tracked"
fi
if ! CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD 2>>"$LOG")" \
  || [ "$CURRENT_BRANCH" != "main" ]; then
  fail_stage 1 "preflight" "data publication must run on the dedicated main branch"
fi
if ! UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>>"$LOG")" \
  || [ "$UPSTREAM" != "origin/main" ]; then
  fail_stage 1 "preflight" "main must track origin/main"
fi
assert_clean
verify_transaction_head

if ! INITIAL_SHA="$(git rev-parse --verify 'HEAD^{commit}' 2>>"$LOG")"; then
  fail_stage 1 "committed" "HEAD is not a transaction commit"
fi
log_event "committed" "detected" "sha=$INITIAL_SHA" "pipeline=$PIPELINE_ID" "target=$TARGET_REF"

trap 'cleanup_on_signal 130' INT
trap 'cleanup_on_signal 143' TERM
trap 'cleanup_on_exit' EXIT

for ATTEMPT in 1 2; do
  reconcile_and_validate
  if ! PUSH_SHA="$(git rev-parse --verify 'HEAD^{commit}' 2>>"$LOG")"; then
    fail_stage 1 "committed" "reconciled HEAD is not a commit"
  fi
  log_event "committed" "ready" "sha=$PUSH_SHA" "attempt=$ATTEMPT" "target=$TARGET_REF"

  if ! git push "$REMOTE" "HEAD:$TARGET_REF" >> "$LOG" 2>&1; then
    if [ "$ATTEMPT" -eq 1 ]; then
      log_event "pushed" "retrying" "sha=$PUSH_SHA" "reason=remote-race-or-rejection"
      continue
    fi
    fail_stage 75 "pushed" "push of HEAD to $REMOTE/$TARGET_REF failed after one retry"
  fi
  log_event "pushed" "ok" "sha=$PUSH_SHA" "attempt=$ATTEMPT" "target=$TARGET_REF"

  if ! REMOTE_LINE="$(git ls-remote --exit-code "$REMOTE" "$TARGET_REF" 2>>"$LOG")"; then
    fail_stage 75 "verified" "could not read back $REMOTE/$TARGET_REF"
  fi
  VERIFIED_SHA="${REMOTE_LINE%%$'\t'*}"
  VERIFIED_REF="${REMOTE_LINE#*$'\t'}"
  if [ "$VERIFIED_REF" = "$TARGET_REF" ] && [ "$VERIFIED_SHA" = "$PUSH_SHA" ]; then
    log_event "verified" "ok" "sha=$VERIFIED_SHA" "attempt=$ATTEMPT" "target=$VERIFIED_REF"
    printf '[%s] verified %s at %s\n' "$(timestamp)" "$TARGET_REF" "$VERIFIED_SHA" >> "$LOG"
    printf '%s\n' "$VERIFIED_SHA"
    exit 0
  fi
  if [ "$ATTEMPT" -eq 1 ]; then
    log_event "verified" "retrying" "expected=$PUSH_SHA" "observed=$VERIFIED_SHA"
    continue
  fi
  fail_stage 75 "verified" "remote SHA does not match HEAD after one retry"
done

fail_stage 1 "verified" "unreachable network publication state"
