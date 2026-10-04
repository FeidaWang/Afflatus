"""Stateless assumption-only calculators. No quotes, jobs, owners or storage."""
import hashlib
import json
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ALLOWED = frozenset({'option_model', 'option_payoff', 'catalogue'})
for path in (ROOT.parent / 'vibe-bridge', ROOT / 'fixed/agent'):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))


def verify_sources():
    lock = json.loads((ROOT / 'source-lock.json').read_text())
    for name, expected in lock['sentinel_blobs'].items():
        path = ROOT / 'fixed' / name
        if path.is_symlink() or not path.is_file():
            raise RuntimeError('SOURCE_LAYOUT_MISMATCH')
        data = path.read_bytes()
        if hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() != expected:
            raise RuntimeError('SOURCE_BLOB_MISMATCH')
    return lock['commit']


def calculate(body):
    # Reject before importing any upstream code. Only these pure helpers are used.
    if not isinstance(body, dict) or body.get('module') not in ALLOWED:
        raise ValueError('MODEL_MODULE_ONLY')
    commit = verify_sources()
    from bridge.quant_models import QuantRequest
    from bridge.quant import execute
    request = QuantRequest.model_validate(body)
    result = execute(request)
    if result['upstream_commit'] != commit:
        raise RuntimeError('SOURCE_COMMIT_MISMATCH')
    # A complete response, never an in-memory job to poll on another instance.
    return {'schema_version': 1, 'id': secrets.token_hex(16), 'module': request.module,
            'instrument_id': request.instrument_id, 'status': 'complete',
            'created_at': datetime.now(timezone.utc).isoformat(), 'result': result, 'error': None}
