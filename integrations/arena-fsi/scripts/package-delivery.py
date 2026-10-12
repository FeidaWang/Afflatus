#!/usr/bin/env python3
"""Build a deterministic source handoff ZIP with a verified SHA-256 manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = args.output.resolve()
    if output.is_relative_to(root):
        parser.error("Write the ZIP outside the source kit to prevent recursive packaging.")
    roots = {
        "api", "config", "docs", "fixtures", "licenses", "patches", "scripts",
        "server", "src", "tests", "ui", "validation",
    }
    top_files = {
        ".env.example", ".gitignore", "CODEX_START.md", "NOTICE.md", "README.md",
        "package.json", "package-lock.json", "vite.config.mjs",
    }
    denied_parts = {"node_modules", "dist", ".git", ".vercel", ".arena-data", "__pycache__"}
    required = {
        "CODEX_START.md", "package-lock.json", "scripts/install-host.mjs",
        "scripts/release-host.mjs", "validation/verification-report.md",
        "validation/patch-verification.json", "validation/installer-replay.json",
        "patches/afflatus-arena-fsi.patch",
    }
    secret_patterns = [
        re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        re.compile(rb"\bAKIA[A-Z0-9]{16}\b"),
        re.compile(rb"\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}\b"),
    ]
    payloads: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if relative.parts[0] not in roots and relative.as_posix() not in top_files:
            continue
        if denied_parts.intersection(relative.parts) or path.is_dir():
            continue
        if path.is_symlink():
            raise RuntimeError(f"Refusing symlink: {relative}")
        if path.name.startswith(".env") and relative.as_posix() != ".env.example":
            raise RuntimeError(f"Refusing environment file: {relative}")
        if path.suffix in {".sqlite", ".db", ".pyc"} or path.name.endswith(("-wal", "-shm")):
            raise RuntimeError(f"Refusing runtime state: {relative}")
        data = path.read_bytes()
        if any(pattern.search(data) for pattern in secret_patterns):
            raise RuntimeError(f"Potential credential material requires review: {relative}")
        payloads[relative.as_posix()] = data
    missing = sorted(required.difference(payloads))
    if missing:
        raise RuntimeError(f"Missing handoff components: {missing}")
    manifest = "".join(
        f"{hashlib.sha256(data).hexdigest()}  {name}\n"
        for name, data in sorted(payloads.items())
    ).encode()
    payloads["SHA256SUMS"] = manifest
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(payloads.items()):
            info = zipfile.ZipInfo(f"arena-fsi-upgrade/{name}", date_time=(2026, 10, 12, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity check failed")
        for line in manifest.decode().splitlines():
            expected, name = line.split("  ", 1)
            actual = hashlib.sha256(archive.read(f"arena-fsi-upgrade/{name}")).hexdigest()
            if actual != expected:
                raise RuntimeError(f"Archived checksum mismatch: {name}")
    print(json.dumps({
        "archive": str(output), "files": len(payloads), "bytes": output.stat().st_size,
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "zipCrcValid": True, "allManifestDigestsValid": True,
    }, indent=2))


if __name__ == "__main__":
    main()
