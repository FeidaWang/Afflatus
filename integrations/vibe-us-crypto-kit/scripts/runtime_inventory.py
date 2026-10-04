#!/usr/bin/env python3
"""Enumerate the fixed source in a fresh home with no secrets or network.

Import-only audit: does not serve the upstream API, start lifespans, execute
tools, install MCP configuration, or run instructions in upstream documents.
"""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import inspect
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import traceback

from bootstrap_upstream import KIT, verify_checkout


def enumerate_source(upstream: Path) -> dict:
    sys.path.insert(0, str(upstream / "agent"))

    def denied(*_args, **_kwargs):
        raise PermissionError("INVENTORY_NETWORK_DISABLED")

    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    socket.create_connection = denied
    report = {"isolation": "fresh home; no credentials; socket connect denied; no lifespan/tool execution"}
    with contextlib.redirect_stdout(sys.stderr):
        from src.tools import build_registry, _discover_subclasses
        registry = build_registry(include_shell_tools=False, interactive=False)
        report["local_tools"] = registry.get_definitions()
        report["import_failures"] = registry.import_failures
        report["registration_failures"] = registry.registration_failures
        report["discovered_classes"] = [{
            "name": cls.name,
            "file": str(Path(inspect.getfile(cls)).relative_to(upstream)),
            "registered": registry.get(cls.name) is not None,
        } for cls in _discover_subclasses()]
        try:
            import mcp_server
            async def mcp_tools():
                tools = await mcp_server.mcp.list_tools()
                return [{"name": tool.name, "parameters": tool.parameters} for tool in tools]
            report["mcp_tools"] = asyncio.run(mcp_tools())
        except Exception:
            report["mcp_error"] = traceback.format_exc()
        try:
            import api_server
            report["api_routes"] = [{"path": r.path, "methods": sorted(r.methods or []),
                                     "name": r.name} for r in api_server.app.routes if hasattr(r, "methods")]
            report["openapi"] = api_server.app.openapi()
        except Exception:
            report["api_error"] = traceback.format_exc()
    from src.agent.skills import SkillsLoader
    report["skills"] = [{"path": (s.dir_path / 'SKILL.md').relative_to(upstream).as_posix(),
                         "name": s.name, "description": s.description,
                         "category": s.category, "metadata": s.metadata,
                         "kind": "method_template_not_data_connector"}
                        for s in SkillsLoader(user_skills_dir=Path(os.environ['HOME']) / 'empty-skills').skills]
    report["frontend_files"] = [p.relative_to(upstream).as_posix()
                                for p in sorted((upstream / "frontend/src").rglob("*"))
                                if p.is_file() and p.suffix in {".ts", ".tsx", ".js", ".jsx"}]
    import re
    report["frontend_routes"] = re.findall(r'path:\s*"([^"]+)"', (upstream / 'frontend/src/router.tsx').read_text())
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream", type=Path, default=KIT / "vendor/vibe-trading")
    parser.add_argument("--out", type=Path, default=KIT / "extracted/runtime.json")
    parser.add_argument("--child", action="store_true")
    args = parser.parse_args()
    upstream = args.upstream.resolve()
    if args.child:
        print(json.dumps(enumerate_source(upstream), ensure_ascii=False, indent=2))
        return
    verify_checkout(upstream, json.loads((KIT / "manifests/upstream-lock.json").read_text()))
    with tempfile.TemporaryDirectory(prefix="afflatus-vibe-inventory-") as home:
        env = {k: os.environ[k] for k in ("PATH", "SYSTEMROOT", "SSL_CERT_FILE", "SSL_CERT_DIR") if k in os.environ}
        env.update(HOME=home, USERPROFILE=home, VIBE_TRADING_HOME=home,
                   PYTHONDONTWRITEBYTECODE="1", PYTHONNOUSERSITE="1")
        run = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--child", "--upstream", str(upstream)],
                             env=env, cwd=home, capture_output=True, text=True, timeout=120)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.with_suffix(".stderr.log").write_text(run.stderr)
    if run.returncode:
        args.out.write_text(json.dumps({"status": "BLOCKED", "exit_code": run.returncode,
                                       "stderr_file": args.out.with_suffix('.stderr.log').name}, indent=2))
        raise SystemExit(run.returncode)
    report = json.loads(run.stdout)
    policy = json.loads((KIT / "manifests/capabilities.json").read_text())["tools"]
    names = {t["function"]["name"] for t in report["local_tools"]}
    names |= {t["name"] for t in report.get("mcp_tools", [])}
    names |= {t["name"] for t in report["discovered_classes"]}
    report["unclassified_tools"] = sorted(names - policy.keys())
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: len(report.get(k, [])) for k in
                      ("local_tools", "mcp_tools", "api_routes", "skills", "frontend_files")}))
    print("Unclassified:", report["unclassified_tools"])
    if report.get("api_error") or report.get("mcp_error") or report["import_failures"] or report["registration_failures"] or report['unclassified_tools']:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
