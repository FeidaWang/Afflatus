#!/bin/bash
# publish-arena-run.sh <runId> <audit-message> [payload-json-path result-json-path]
#
# Arena-specific wrapper around push-data.sh. Network/validation semantics stay
# in one helper; this wrapper adds an auditable expected-SHA outbox receipt on
# failure and archives receipts only after their commit is proven reachable
# from the independently verified origin/main tip.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$REPO/scripts/publish-arena-run.log"
OUTBOX_DIR="$REPO/scripts/outbox"
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

RUN_ID="${1:-}"
MSG="${2:-}"
PAYLOAD_PATH="${3:-}"
RESULT_PATH="${4:-}"
QUEUE_SHA=""

timestamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

log_event() {
  local event="$1"
  local status="$2"
  shift 2
  printf 'timestamp=%s component=publish-arena-run run_id=%s event=%s status=%s' \
    "$(timestamp)" "$RUN_ID" "$event" "$status" >> "$LOG"
  if [ "$#" -gt 0 ]; then printf ' %s' "$@" >> "$LOG"; fi
  printf '\n' >> "$LOG"
}

queue_outbox() {
  if [ -z "$QUEUE_SHA" ]; then
    log_event "outbox" "failed" "reason=no-expected-sha"
    return 1
  fi
  if node "$REPO/scripts/queue-arena-outbox.mjs" \
    "$RUN_ID" "$MSG" "$QUEUE_SHA" "$PAYLOAD_PATH" "$RESULT_PATH" >> "$LOG" 2>&1; then
    log_event "outbox" "queued" "expected_sha=$QUEUE_SHA" "target=$TARGET_REF"
    return 0
  fi
  log_event "outbox" "failed" "expected_sha=$QUEUE_SHA" "target=$TARGET_REF"
  return 1
}

if [ -z "$RUN_ID" ] || [ -z "$MSG" ]; then
  echo "Usage: publish-arena-run.sh <runId> <audit-message> [payload-json-path result-json-path]" >&2
  exit 64
fi
case "$RUN_ID" in
  *[!A-Za-z0-9._+-]*)
    echo "publish-arena-run: runId contains unsupported characters" >&2
    exit 64
    ;;
esac

cd "$REPO"
mkdir -p "$OUTBOX_DIR"

# Do not turn malformed/local non-transaction commits into outbox work. This
# is a witness only; the delegated helper repeats it before any network write.
if ! node scripts/verify-data-transaction-head.mjs public/arena-runlog.json >> "$LOG" 2>&1; then
  log_event "transaction" "failed" "target=$TARGET_REF"
  echo "publish-arena-run: HEAD is not a valid Arena data-publish transaction" >&2
  exit 1
fi
if ! QUEUE_SHA="$(git rev-parse --verify 'HEAD^{commit}' 2>>"$LOG")"; then
  log_event "committed" "failed" "target=$TARGET_REF"
  echo "publish-arena-run: HEAD is not a commit" >&2
  exit 1
fi
log_event "committed" "detected" "sha=$QUEUE_SHA" "target=$TARGET_REF"

PUSH_RESULT_PATH="$(mktemp "${TMPDIR:-/tmp}/afflatus-arena-push.XXXXXX")"
trap 'rm -f "$PUSH_RESULT_PATH"' EXIT
set +e
bash scripts/push-data.sh public/arena-runlog.json "$MSG" > "$PUSH_RESULT_PATH" 2>> "$LOG"
PUSH_STATUS=$?
set -e
if [ "$PUSH_STATUS" -ne 0 ]; then
  # A reconciliation may have rewritten HEAD; the receipt must name the exact
  # commit whose reachability a later run will prove.
  QUEUE_SHA="$(git rev-parse --verify 'HEAD^{commit}' 2>>"$LOG" || true)"
  log_event "pushed" "failed" "exit=$PUSH_STATUS" "expected_sha=$QUEUE_SHA" "target=$TARGET_REF"
  if [ "$PUSH_STATUS" -eq 75 ]; then
    queue_outbox || true
    echo "publish-arena-run: network synchronization failed; expected SHA queued" >&2
  else
    log_event "outbox" "not-queued" "reason=local-validation-or-preflight-failure"
    echo "publish-arena-run: local validation/preflight failed; no sync receipt queued" >&2
  fi
  exit "$PUSH_STATUS"
fi
DELEGATED_VERIFIED_SHA="$(tail -n 1 "$PUSH_RESULT_PATH" | tr -d '[:space:]')"
if ! [[ "$DELEGATED_VERIFIED_SHA" =~ ^[0-9a-f]{40,64}$ ]]; then
  log_event "verified" "failed" "reason=invalid-delegated-witness"
  echo "publish-arena-run: delegated helper returned no valid verified SHA" >&2
  exit 1
fi

if ! REMOTE_LINE="$(git ls-remote --exit-code "$REMOTE" "$TARGET_REF" 2>>"$LOG")"; then
  QUEUE_SHA="$DELEGATED_VERIFIED_SHA"
  log_event "verified" "failed" "reason=readback"
  queue_outbox || true
  echo "publish-arena-run: remote readback failed after delegated push" >&2
  exit 75
fi
VERIFIED_SHA="${REMOTE_LINE%%$'\t'*}"
VERIFIED_REF="${REMOTE_LINE#*$'\t'}"
# The remote may have legitimately advanced after push-data's exact readback.
# Fetch that observed object so ancestor verification never relies on a stale
# local remote-tracking graph.
if ! git cat-file -e "$VERIFIED_SHA^{commit}" 2>>"$LOG"; then
  if ! git fetch --no-tags "$REMOTE" "$TARGET_REF" >> "$LOG" 2>&1; then
    QUEUE_SHA="$DELEGATED_VERIFIED_SHA"
    log_event "verified" "failed" "reason=remote-tip-fetch"
    queue_outbox || true
    echo "publish-arena-run: could not fetch advanced remote tip for ancestry proof" >&2
    exit 75
  fi
fi
if [ "$VERIFIED_REF" != "$TARGET_REF" ] \
  || ! git merge-base --is-ancestor "$DELEGATED_VERIFIED_SHA" "$VERIFIED_SHA" 2>>"$LOG"; then
  QUEUE_SHA="$DELEGATED_VERIFIED_SHA"
  log_event "verified" "failed" "expected_ancestor=$DELEGATED_VERIFIED_SHA" "observed=$VERIFIED_SHA"
  queue_outbox || true
  echo "publish-arena-run: delegated verified transaction is not on remote main" >&2
  exit 1
fi
log_event "verified" "ok" "sha=$VERIFIED_SHA" "target=$VERIFIED_REF"

shopt -s nullglob
OUTBOX_FILES=("$OUTBOX_DIR"/*.json)
FLUSHED_COUNT=0
FLUSH_SUFFIX="$(date +%s)_$$"
for file in "${OUTBOX_FILES[@]}"; do
  RECEIPT_FIELDS="$(node -e 'const fs=require("fs");const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!/^[0-9a-f]{40,64}$/.test(x.expectedCommitSha||"")||!x.transactionId||!x.pipelineId)process.exit(2);process.stdout.write([x.expectedCommitSha,x.transactionId,x.pipelineId].join("\t"))' "$file" 2>>"$LOG" || true)"
  IFS=$'\t' read -r EXPECTED_SHA TRANSACTION_ID RECEIPT_PIPELINE <<< "$RECEIPT_FIELDS"
  PROVEN_SHA=""
  if [ -n "$EXPECTED_SHA" ] && git merge-base --is-ancestor "$EXPECTED_SHA" "$VERIFIED_SHA" 2>>"$LOG"; then
    PROVEN_SHA="$EXPECTED_SHA"
  elif [ -n "$TRANSACTION_ID" ] && [ -n "$RECEIPT_PIPELINE" ]; then
    while IFS= read -r candidate_sha; do
      [ -n "$candidate_sha" ] || continue
      CANDIDATE_MESSAGE="$(git log -1 --format=%B "$candidate_sha" 2>>"$LOG" || true)"
      if printf '%s\n' "$CANDIDATE_MESSAGE" | grep -Fqx "Afflatus-Data-Publish: $TRANSACTION_ID" \
        && printf '%s\n' "$CANDIDATE_MESSAGE" | grep -Fqx "Afflatus-Data-Pipeline: $RECEIPT_PIPELINE"; then
        PROVEN_SHA="$candidate_sha"
        break
      fi
    done < <(git rev-list "$VERIFIED_SHA" 2>>"$LOG")
  fi
  if [ -z "$PROVEN_SHA" ]; then
    log_event "outbox" "retained" "file=$(basename "$file")" "reason=expected-sha-not-on-remote"
    continue
  fi
  if ! mv "$file" "$file.flushed_$FLUSH_SUFFIX"; then
    log_event "outbox" "failed" "file=$(basename "$file")" "reason=archive-failed"
    echo "publish-arena-run: verified push succeeded but an outbox receipt could not be archived" >&2
    exit 1
  fi
  FLUSHED_COUNT=$((FLUSHED_COUNT + 1))
  log_event "outbox" "proven" "file=$(basename "$file")" "sha=$PROVEN_SHA" "transaction_id=$TRANSACTION_ID"
done
log_event "outbox" "flushed" "count=$FLUSHED_COUNT" "verified_sha=$VERIFIED_SHA"

printf '[%s] verified %s at %s\n' "$(timestamp)" "$TARGET_REF" "$VERIFIED_SHA" >> "$LOG"
