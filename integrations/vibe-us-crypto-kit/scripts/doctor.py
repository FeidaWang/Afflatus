#!/usr/bin/env python3
"""Offline environment report. No installation, provider calls, or secret output."""
import importlib.util
import json
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[1]
print(json.dumps({
    "python": sys.version.split()[0], "python_ok": sys.version_info >= (3, 11),
    "git": bool(shutil.which("git")), "node": bool(shutil.which("node")),
    "python_modules": {m: importlib.util.find_spec(m) is not None for m in ("fastapi", "pydantic", "uvicorn", "httpx", "pytest")},
    "upstream_present": (root / "vendor/vibe-trading/.git").exists(),
    "mode": "offline; no production changes",
}, indent=2))
