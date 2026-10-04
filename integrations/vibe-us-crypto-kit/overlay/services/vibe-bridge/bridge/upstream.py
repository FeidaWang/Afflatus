"""Fail closed on drift in the source files used by this bridge."""
import hashlib
import json
from pathlib import Path


def verify_runtime_source(agent: Path, *, quant=False):
    lock = json.loads(Path(__file__).with_name('upstream-lock.json').read_text())
    if quant:
        additional = json.loads(Path(__file__).with_name('quant-lock.json').read_text())
        if additional['commit'] != lock['commit']:
            raise RuntimeError('SOURCE_COMMIT_MISMATCH')
        lock['sentinel_blobs'].update(additional['sentinel_blobs'])
    root = agent.parent
    for name, expected in lock['sentinel_blobs'].items():
        path = root / name
        if path.is_symlink(): raise RuntimeError('SOURCE_LAYOUT_MISMATCH')
        data = path.read_bytes()
        actual = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
        if actual != expected: raise RuntimeError('SOURCE_BLOB_MISMATCH')
