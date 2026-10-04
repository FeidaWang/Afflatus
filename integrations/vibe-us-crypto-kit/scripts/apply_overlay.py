#!/usr/bin/env python3
"""Non-destructive local copy. Does not modify routes/config, commit, push, or deploy."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil

KIT = Path(__file__).resolve().parents[1]


def plan(target: Path) -> list[tuple[Path, Path]]:
    if not (target / "package.json").is_file(): raise RuntimeError("Target is not a JS project")
    result = []
    for source in sorted((KIT / "overlay").rglob("*")):
        if not source.is_file() or source.is_symlink(): continue
        if "__pycache__" in source.parts: continue
        relative = source.relative_to(KIT / "overlay")
        destination = target / relative
        if destination.exists() or destination.is_symlink(): raise RuntimeError(f"Refusing to overwrite {relative}")
        # Reject symlinked parents, including an existing services/ or src/ link.
        for parent in destination.parents:
            if parent == target: break
            if parent.is_symlink(): raise RuntimeError(f"Symlinked destination parent: {parent}")
        result.append((source, destination))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--apply", action="store_true", help="Without this flag, print a dry run only")
    args = parser.parse_args()
    target = args.target.expanduser().resolve()
    copies = plan(target)
    receipt = target / ".vibe-overlay-receipt.json"
    if receipt.exists() or receipt.is_symlink(): raise RuntimeError("Previous receipt exists; inspect before applying")
    print("APPLY" if args.apply else "DRY RUN")
    for _source, destination in copies: print(destination.relative_to(target))
    if not args.apply: return
    records = []
    for source, destination in copies:
        destination.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive create protects against concurrent overwrite.
        with destination.open("xb") as out: out.write(source.read_bytes())
        records.append({"path": destination.relative_to(target).as_posix(), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()})
        receipt.write_text(json.dumps({"files": records}, indent=2), encoding="utf-8")
    print("Only new files added. Page mounting and deployment remain deliberate Codex tasks.")


if __name__ == "__main__": main()
