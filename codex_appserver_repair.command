#!/usr/bin/env bash
# Codex Mac app app-server repair script for error:
#   unknown feature key in config: thread_tools
#   Codex app-server is not available
# This script backs up everything it moves. It does NOT delete ~/.codex/sessions or archived_sessions.
set -u

now() { date '+%Y-%m-%d %H:%M:%S'; }
log() { printf '[%s] %s\n' "$(now)" "$*"; }

HOME_DIR="$HOME"
BACKUP="$HOME_DIR/Desktop/codex-repair-backup-$(date +%Y%m%d-%H%M%S)"
REPORT="$BACKUP/report.txt"
mkdir -p "$BACKUP"
exec > >(tee -a "$REPORT") 2>&1

log "Starting Codex app-server repair"
log "Backup folder: $BACKUP"
log "Report: $REPORT"

CODEX_HOME_DIR="${CODEX_HOME:-$HOME_DIR/.codex}"
log "Shell CODEX_HOME: ${CODEX_HOME:-<unset>}"
log "Effective CODEX_HOME_DIR: $CODEX_HOME_DIR"
log "launchd CODEX_HOME before: $(launchctl getenv CODEX_HOME 2>/dev/null || true)"

log "Quitting Codex app and related processes..."
osascript -e 'quit app "Codex"' 2>/dev/null || true
sleep 2
pkill -f "Codex.app" 2>/dev/null || true
pkill -f "com.openai.codex" 2>/dev/null || true
pkill -f "codex app-server" 2>/dev/null || true

log "Collecting versions..."
{
  echo "== Versions =="
  echo "Standalone CLI path: $(command -v codex 2>/dev/null || true)"
  codex --version 2>&1 || true
  echo "Bundled app CLI:"
  /Applications/Codex.app/Contents/Resources/codex --version 2>&1 || true
  echo "App bundle version:"
  defaults read /Applications/Codex.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null || true
  defaults read /Applications/Codex.app/Contents/Info.plist CFBundleVersion 2>/dev/null || true
} | tee "$BACKUP/versions.txt"

log "Backing up core Codex home. This may take a moment..."
if [ -d "$CODEX_HOME_DIR" ]; then
  ditto "$CODEX_HOME_DIR" "$BACKUP/dot-codex-backup" 2>/dev/null || cp -a "$CODEX_HOME_DIR" "$BACKUP/dot-codex-backup" 2>/dev/null || true
else
  log "CODEX_HOME_DIR does not exist yet: $CODEX_HOME_DIR"
fi

log "Counting sessions before repair..."
SESSION_COUNT=0
if [ -d "$CODEX_HOME_DIR/sessions" ] || [ -d "$CODEX_HOME_DIR/archived_sessions" ]; then
  SESSION_COUNT=$(find "$CODEX_HOME_DIR/sessions" "$CODEX_HOME_DIR/archived_sessions" -type f \( -name '*.jsonl' -o -name '*.json' \) 2>/dev/null | wc -l | tr -d ' ')
fi
log "Session files found: $SESSION_COUNT"

log "Searching for 'thread_tools' in likely configuration/state locations..."
SEARCH_FILE="$BACKUP/thread_tools_search_before.txt"
: > "$SEARCH_FILE"
grep -RIna "thread_tools" \
  "$CODEX_HOME_DIR" \
  "$HOME_DIR/Library/Application Support/com.openai.codex" \
  "$HOME_DIR/Library/Caches/com.openai.codex" \
  "$HOME_DIR/Library/Preferences/com.openai.codex.plist" \
  "/etc/codex" \
  "/Library/Managed Preferences" \
  2>/dev/null | tee -a "$SEARCH_FILE" || true

log "Searching project-level .codex/config.toml files under HOME, excluding Library..."
PROJECT_CONFIG_LIST="$BACKUP/project_config_files.txt"
find "$HOME_DIR" -path "$HOME_DIR/Library" -prune -o -path '*/.codex/config.toml' -type f -print 2>/dev/null | tee "$PROJECT_CONFIG_LIST" || true

log "Removing exact 'thread_tools = ...' lines from user/project config TOML files only, with .pre-thread-tools-fix backup..."
CONFIG_CANDIDATES="$BACKUP/config_candidates.txt"
: > "$CONFIG_CANDIDATES"
# User/profile configs in CODEX_HOME root only.
find "$CODEX_HOME_DIR" -maxdepth 1 -type f \( -name 'config.toml' -o -name '*.config.toml' -o -name 'managed_config.toml' \) -print 2>/dev/null >> "$CONFIG_CANDIDATES" || true
# Project configs.
cat "$PROJECT_CONFIG_LIST" >> "$CONFIG_CANDIDATES" 2>/dev/null || true
# Unique them.
sort -u "$CONFIG_CANDIDATES" -o "$CONFIG_CANDIDATES"

while IFS= read -r cfg; do
  [ -f "$cfg" ] || continue
  if grep -qi "thread_tools" "$cfg" 2>/dev/null; then
    log "Patching config: $cfg"
    cp "$cfg" "$cfg.pre-thread-tools-fix.$(date +%Y%m%d-%H%M%S).bak" 2>/dev/null || true
    cp "$cfg" "$BACKUP/$(echo "$cfg" | sed 's#/#__#g').bak" 2>/dev/null || true
    # Remove only direct feature key assignments; leave comments and other settings untouched.
    perl -0pi -e 's/^\s*thread_tools\s*=\s*[^\n]*\n//gmi' "$cfg" 2>/dev/null || true
  fi
done < "$CONFIG_CANDIDATES"

log "Checking macOS managed preferences payloads for thread_tools..."
MANAGED_PREFS="$BACKUP/managed_preferences.txt"
{
  echo "== defaults read com.openai.codex =="
  defaults read com.openai.codex 2>/dev/null || true
  echo
  echo "== managed profiles mentioning Codex/thread_tools, if any =="
  profiles show -type configuration 2>/dev/null | grep -i -A5 -B5 'com.openai.codex\|thread_tools' || true
} > "$MANAGED_PREFS" 2>&1 || true

log "Resetting launchd CODEX_HOME to default so the app uses ~/.codex unless the shell explicitly launches it otherwise..."
launchctl unsetenv CODEX_HOME 2>/dev/null || true

log "Moving Codex app UI/cache/runtime state to backup; sessions are NOT moved."
move_if_exists() {
  local src="$1"
  local dstname="$2"
  if [ -e "$src" ]; then
    log "Moving: $src"
    mv "$src" "$BACKUP/$dstname" 2>/dev/null || log "Could not move: $src"
  fi
}

move_if_exists "$HOME_DIR/Library/Caches/com.openai.codex" "Caches-com.openai.codex"
move_if_exists "$HOME_DIR/Library/Saved Application State/com.openai.codex.savedState" "SavedState-com.openai.codex.savedState"
move_if_exists "$HOME_DIR/Library/HTTPStorages/com.openai.codex" "HTTPStorages-com.openai.codex"
move_if_exists "$HOME_DIR/Library/Application Support/com.openai.codex" "ApplicationSupport-com.openai.codex"
move_if_exists "$HOME_DIR/Library/Preferences/com.openai.codex.plist" "Preferences-com.openai.codex.plist"
move_if_exists "$HOME_DIR/Library/WebKit/com.openai.codex" "WebKit-com.openai.codex"
move_if_exists "$HOME_DIR/.codex/.tmp" "dot-codex-tmp"
move_if_exists "$HOME_DIR/.cache/codex-runtimes" "codex-runtimes"

log "Searching for 'thread_tools' after local cleanup..."
SEARCH_AFTER="$BACKUP/thread_tools_search_after.txt"
: > "$SEARCH_AFTER"
grep -RIna "thread_tools" \
  "$CODEX_HOME_DIR" \
  "$HOME_DIR/Library/Application Support/com.openai.codex" \
  "$HOME_DIR/Library/Caches/com.openai.codex" \
  "$HOME_DIR/Library/Preferences/com.openai.codex.plist" \
  "/etc/codex" \
  "/Library/Managed Preferences" \
  2>/dev/null | tee -a "$SEARCH_AFTER" || true

log "Running codex doctor..."
codex doctor --json > "$BACKUP/doctor.json" 2>&1 || true

log "Opening Codex..."
open -a Codex

log "Repair script completed."
log "If Codex still shows 'unknown feature key in config: thread_tools', the value is likely from remote feature flags or managed preferences, not ordinary local config."
log "Backup/report folder: $BACKUP"
