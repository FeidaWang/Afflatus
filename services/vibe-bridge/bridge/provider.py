from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path

from .models import BarsRequest
from .normalize import SourceUnavailable

MAX_OUTPUT = 1_048_576


async def _bounded_read(stream, maximum: int) -> bytes:
    chunks, total = [], 0
    while True:
        chunk = await stream.read(8192)
        if not chunk:
            return b"".join(chunks)
        total += len(chunk)
        if total > maximum:
            raise SourceUnavailable("worker output too large")
        chunks.append(chunk)


async def fetch_bars(request: BarsRequest) -> dict:
    upstream = Path(os.environ.get("VIBE_UPSTREAM_AGENT", "/nonexistent")).resolve()
    if not (upstream / "src" / "market_data.py").is_file():
        raise SourceUnavailable("upstream not installed")
    service_root = Path(__file__).resolve().parents[1]
    # Intentionally do not forward OPENAI_*, broker keys, HOME, proxy settings,
    # or host session state into a market-data operation.
    env = {key: os.environ[key] for key in ("PATH", "SYSTEMROOT", "SSL_CERT_FILE", "SSL_CERT_DIR") if key in os.environ}
    with tempfile.TemporaryDirectory(prefix="vibe-bars-") as home:
        env.update({
            "HOME": home, "USERPROFILE": home, "VIBE_TRADING_HOME": home,
            "PYTHONPATH": os.pathsep.join([str(service_root), str(upstream)]),
            "PYTHONUNBUFFERED": "1", "PYTHONNOUSERSITE": "1",
            "VIBE_UPSTREAM_AGENT": str(upstream), "PYTHONDONTWRITEBYTECODE": "1",
        })
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "bridge.worker", cwd=home, env=env,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        async def exchange():
            process.stdin.write(request.model_dump_json().encode())
            await process.stdin.drain()
            process.stdin.close()
            out, _err = await asyncio.gather(
                _bounded_read(process.stdout, MAX_OUTPUT),
                _bounded_read(process.stderr, 65_536),
            )
            code = await process.wait()
            if code:
                raise SourceUnavailable("upstream read failed")
            return json.loads(out)
        try:
            return await asyncio.wait_for(exchange(), timeout=20)
        except asyncio.CancelledError:
            if process.returncode is None:
                process.kill()
            await process.wait()
            raise
        except Exception as exc:
            if process.returncode is None:
                process.kill()
            await process.wait()
            raise SourceUnavailable("source unavailable or timed out") from exc
