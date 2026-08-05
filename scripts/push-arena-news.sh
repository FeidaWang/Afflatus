#!/bin/bash
# Backwards-compatible wrapper for the former dedicated Arena publisher.
# The old script pointed at a retired absolute directory; all data tasks now
# resolve this repository dynamically and share push-data.sh's concurrency lock.

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE="$(date +%Y-%m-%d)"
exec bash "$REPO/scripts/push-data.sh" public/arena-news.json "Arena pre-market briefing $DATE"
