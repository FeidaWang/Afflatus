#!/usr/bin/env python3
"""Static, non-executing inventory plus a conservative research-source slice.

Dynamic registration cannot be proven complete by AST: an explicit limitation
is emitted. Unknown tool names fail the coverage gate. Source presence is not
runtime enablement, and this exported slice is not a standalone build.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

from bootstrap_upstream import KIT, verify_checkout

TEXT_EXTENSIONS = {".py", ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ts", ".tsx", ".js", ".mjs", ".css", ".html"}
REFERENCE_ROOTS = ("agent/src/", "agent/backtest/", "agent/skills/", "agent/tests/", "frontend/src/", "frontend/tests/")
TOP_FILES = {"LICENSE", "NOTICE", "pyproject.toml", "requirements-lock.txt", "agent/api_server.py", "agent/mcp_server.py", "agent/SKILL.md", "agent/requirements.txt", "frontend/package.json"}
EXCLUDED_PATH_PARTS = {"__pycache__", "node_modules", ".git", "dist", "fonts"}


def dotted(node) -> str:
    if isinstance(node, ast.Name): return node.id
    if isinstance(node, ast.Attribute): return f"{dotted(node.value)}.{node.attr}"
    return ""


def scan_python(text: str, name: str) -> dict:
    result = {"functions": [], "tools": [], "routes": [], "imports": [], "parse_error": None}
    try:
        tree = ast.parse(text, filename=name)
    except SyntaxError as exc:
        result["parse_error"] = f"{name}:{exc.lineno}"
        return result
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and name.startswith("agent/src/tools/"):
            for member in node.body:
                if isinstance(member, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'name' for t in member.targets):
                    value = member.value
                elif isinstance(member, ast.AnnAssign) and isinstance(member.target, ast.Name) and member.target.id == 'name':
                    value = member.value
                else:
                    continue
                if isinstance(value, ast.Constant) and isinstance(value.value, str) and value.value:
                    result['tools'].append({'name': value.value, 'function': node.name, 'line': member.lineno})
        if isinstance(node, ast.Import): result["imports"].extend(x.name for x in node.names)
        elif isinstance(node, ast.ImportFrom): result["imports"].append("." * node.level + (node.module or ""))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            result["functions"].append({"name": node.name, "line": node.lineno})
            for decorator in node.decorator_list:
                called = decorator.func if isinstance(decorator, ast.Call) else decorator
                decname = dotted(called)
                if decname == "tool" or decname.endswith(".tool"):
                    declared_name = node.name
                    if isinstance(decorator, ast.Call):
                        if decorator.args and isinstance(decorator.args[0], ast.Constant) and isinstance(decorator.args[0].value, str):
                            declared_name = decorator.args[0].value
                        for kw in decorator.keywords:
                            if kw.arg == "name" and isinstance(kw.value, ast.Constant): declared_name = str(kw.value.value)
                    result["tools"].append({"name": declared_name, "function": node.name, "line": node.lineno})
                method = decname.rsplit(".", 1)[-1]
                if method in {"get", "post", "put", "patch", "delete", "websocket"} and isinstance(decorator, ast.Call):
                    route = decorator.args[0] if decorator.args else None
                    if isinstance(route, ast.Constant) and isinstance(route.value, str):
                        result["routes"].append({"method": method.upper(), "path": route.value, "function": node.name, "line": node.lineno})
    result["imports"] = sorted(set(result["imports"]))
    return result


def documented_tools(text: str) -> set[str]:
    return set(re.findall(r"^\|\s*`([a-z][a-z0-9_]+)`\s*\|", text, re.M))


def is_candidate(name: str) -> bool:
    path = Path(name)
    if set(path.parts) & EXCLUDED_PATH_PARTS or path.is_absolute() or ".." in path.parts:
        return False
    return (name in TOP_FILES or (name.startswith(REFERENCE_ROOTS) and path.suffix.lower() in TEXT_EXTENSIONS))


def build_inventory(upstream: Path, policy: dict) -> dict:
    records, tool_locations, routes, skills, parse_errors = [], {}, [], [], []
    for path in sorted(upstream.rglob("*")):
        if not path.is_file() or path.is_symlink(): continue
        name = path.relative_to(upstream).as_posix()
        if not is_candidate(name): continue
        raw = path.read_bytes()
        item = {"path": name, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
        records.append(item)
        try: text = raw.decode("utf-8")
        except UnicodeDecodeError: continue
        if path.suffix == ".py":
            data = scan_python(text, name)
            item.update(data)
            if data["parse_error"]: parse_errors.append(data["parse_error"])
            for tool in data["tools"]:
                tool_locations.setdefault(tool["name"], []).append({"path": name, **tool})
            routes.extend({"file": name, **route} for route in data["routes"])
        if name.startswith(("agent/skills/", "agent/src/skills/")) and path.name.lower() == "skill.md":
            first_heading = next((line[2:].strip() for line in text.splitlines() if line.startswith("# ")), path.parent.name)
            skills.append({"path": name, "heading": first_heading, "status": "REVIEW_MARKET_AND_DATA_REQUIREMENTS"})
    skill_path = upstream / "agent/SKILL.md"
    doc_tools = documented_tools(skill_path.read_text(encoding="utf-8")) if skill_path.exists() else set()
    all_names = sorted(set(tool_locations) | doc_tools)
    declared = policy["tools"]
    unclassified = [name for name in all_names if name not in declared]
    missing = [name for name in declared if name not in all_names]
    return {
        "source_files": records, "api_routes": routes, "skills": skills,
        "tools": [{"name": name, "policy": declared.get(name, "UNCLASSIFIED"),
                   "documented": name in doc_tools, "locations": tool_locations.get(name, [])} for name in all_names],
        "unclassified_tools": unclassified, "policy_tools_not_found": missing,
        "parse_errors": parse_errors,
        "limitations": [
            "Static decorators and SKILL.md are indexed. Dynamic tool factories/registries require a runtime enumeration in a sandbox.",
            "Generic functions can serve excluded markets; per-argument market validation is still mandatory.",
            "Skills are not data connectors. Every skill requires a manual scope/data audit.",
            "The source slice intentionally retains shared dependencies and mixed-market branches. It is a review artifact, not a standalone executable distribution.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream", type=Path, default=KIT / "vendor/vibe-trading")
    parser.add_argument("--out", type=Path, default=KIT / "extracted")
    parser.add_argument("--strict", action="store_true", help="Fail when inventory requires further tool classification")
    args = parser.parse_args()
    upstream, output = args.upstream.resolve(), args.out.resolve()
    verify_checkout(upstream, json.loads((KIT / "manifests/upstream-lock.json").read_text()))
    if output.exists(): raise RuntimeError("Output already exists; use a fresh output directory")
    if output == upstream or upstream in output.parents: raise RuntimeError("Cannot write into upstream checkout")
    policy = json.loads((KIT / "manifests/capabilities.json").read_text())
    report = build_inventory(upstream, policy)
    output.mkdir(parents=True)
    for file in report["source_files"]:
        name = file["path"]
        target = output / "source-review" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(upstream / name, target)
    (output / "inventory.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = {
        "files": len(report["source_files"]), "tools": len(report["tools"]), "routes": len(report["api_routes"]),
        "skills": len(report["skills"]), "unclassified_tools": report["unclassified_tools"],
        "policy_tools_not_found": report["policy_tools_not_found"], "parse_errors": report["parse_errors"],
        "status": "REQUIRES_RUNTIME_REGISTRY_AND_SKILL_REVIEW",
    }
    (output / "coverage.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.strict and (report["unclassified_tools"] or report["parse_errors"] or report["policy_tools_not_found"]):
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as exc:
        print(f"STOP: {exc}", file=sys.stderr)
        raise SystemExit(1)
