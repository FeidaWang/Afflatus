#!/usr/bin/env python3
"""Fetch exactly one reviewed source revision. Never installs or executes it."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

KIT = Path(__file__).resolve().parents[1]


def git(*args: str, cwd: Path | None = None) -> str:
    result = subprocess.run(
        ["git", "-c", "core.hooksPath=/dev/null", *args], cwd=cwd,
        check=True, text=True, capture_output=True, timeout=180,
    )
    return result.stdout.strip()


def verify_checkout(path: Path, lock: dict) -> None:
    actual = git("rev-parse", "HEAD", cwd=path)
    if actual != lock["commit"]:
        raise RuntimeError(f"COMMIT_MISMATCH: expected {lock['commit']}, got {actual}")
    if git("status", "--porcelain", "--untracked-files=all", cwd=path):
        raise RuntimeError("DIRTY_UPSTREAM: use a clean checkout; no credentials or local edits")
    for name, expected in lock["sentinel_blobs"].items():
        file = path / name
        if not file.is_file() or file.is_symlink():
            raise RuntimeError(f"SOURCE_LAYOUT_MISMATCH: {name}")
        actual_blob = git("hash-object", "--no-filters", str(file), cwd=path)
        if actual_blob != expected:
            raise RuntimeError(f"SOURCE_BLOB_MISMATCH: {name}: {actual_blob} != {expected}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", type=Path, default=KIT / "vendor/vibe-trading")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    lock = json.loads((KIT / "manifests/upstream-lock.json").read_text())
    if not re.fullmatch(r"[0-9a-f]{40}", lock["commit"]):
        raise RuntimeError("Invalid pinned commit")
    destination = args.dest.expanduser().resolve()
    if not destination.exists():
        if args.verify_only:
            raise RuntimeError("Upstream checkout is missing")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.mkdir()
        git("init", str(destination))
        git("remote", "add", "origin", lock["repository"], cwd=destination)
        # Do not fall back to main if this SHA is unavailable.
        git("fetch", "--depth=1", "origin", lock["commit"], cwd=destination)
        git("checkout", "--detach", "FETCH_HEAD", cwd=destination)
    verify_checkout(destination, lock)
    print(f"Verified clean upstream: {destination}\nCommit: {lock['commit']}")
    print("No dependencies installed. No repo code executed. Next: scripts/inventory_upstream.py")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f"STOP: {exc}", file=sys.stderr)
        raise SystemExit(1)
