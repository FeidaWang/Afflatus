#!/usr/bin/env python3
"""Run the real private bridge and host locally, with ephemeral server secrets."""
import os
from pathlib import Path
import secrets
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / 'integrations/vibe-us-crypto-kit'


def main():
    subprocess.run([str(KIT/'.venv/bin/python'), str(KIT/'scripts/bootstrap_upstream.py'), '--verify-only'], check=True)
    token = secrets.token_urlsafe(48)
    quota = secrets.token_urlsafe(48)
    base = {k: os.environ[k] for k in ('PATH', 'SYSTEMROOT', 'SSL_CERT_FILE', 'SSL_CERT_DIR') if k in os.environ}
    bridge_env = {**base, 'VIBE_BRIDGE_TOKEN': token, 'VIBE_UPSTREAM_AGENT': str(KIT/'vendor/vibe-trading/agent'),
                  'PYTHONDONTWRITEBYTECODE': '1'}
    host_env = {**base, 'VITE_VIBE_MARKETS_ENABLED': 'true', 'VIBE_FEATURE_ENABLED': 'true',
                'VIBE_LOCAL_RESEARCH': 'true', 'VIBE_BRIDGE_URL': 'http://127.0.0.1:8765',
                'VIBE_BRIDGE_TOKEN': token, 'ARENA_ADMIN_KEY': quota,
                'VIBE_ENABLE_PUBLIC_MARKET_DATA': 'false', 'NODE_ENV': 'development'}
    children = []
    try:
        children.append(subprocess.Popen([str(KIT/'.venv/bin/python'), '-m', 'uvicorn', 'bridge.app:app',
                                         '--host', '127.0.0.1', '--port', '8765', '--workers', '1'],
                                        cwd=ROOT/'services/vibe-bridge', env=bridge_env))
        children.append(subprocess.Popen(['npm', 'run', 'dev', '--', '--port', '5175', '--strictPort'],
                                        cwd=ROOT, env=host_env))
        print('Local private research: http://127.0.0.1:5175/arena.html (no client credentials)', flush=True)
        while all(p.poll() is None for p in children):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for child in children:
            if child.poll() is None: child.terminate()
        for child in children:
            try: child.wait(timeout=5)
            except subprocess.TimeoutExpired: child.kill(); child.wait()


if __name__ == '__main__':
    main()
