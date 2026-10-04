#!/usr/bin/env python3
"""Local operator JSON stdin calculator. Does not publish or store inputs."""
import contextlib
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
upstream = Path(os.environ.get('VIBE_UPSTREAM_AGENT', ROOT / 'integrations/vibe-us-crypto-kit/vendor/vibe-trading/agent')).resolve()
sys.path[:0] = [str(ROOT / 'services/vibe-bridge'), str(upstream)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, help='Local previously saved normalized bars, keyed by deployed instrument ID')
    parser.add_argument('--perpetual-snapshot', type=Path, help='Local strict historical funding/mark/margin dataset, never a spot series')
    options = parser.parse_args()
    from bridge.quant_models import QuantRequest
    from bridge.upstream import verify_runtime_source
    raw = sys.stdin.buffer.read(32769)
    if len(raw) > 32768:
        raise ValueError('input limit')
    request = QuantRequest.model_validate_json(raw)
    verify_runtime_source(upstream, quant=True)
    snapshots, perpetual = None, None
    def read_bounded(path):
        if path.stat().st_size > 1048576:
            raise ValueError('snapshot byte limit')
        return json.loads(path.read_text())
    if options.snapshot:
        snapshots = read_bounded(options.snapshot)
    if options.perpetual_snapshot:
        perpetual = read_bounded(options.perpetual_snapshot)
    with contextlib.redirect_stdout(sys.stderr):
        from bridge.quant import execute, snapshot, load_series
        from bridge.normalize import normalize_payload
        from bridge.models import BarsRequest, INSTRUMENTS
        def saved_series(req, instrument=None):
            identifier = instrument or req.instrument_id
            item = INSTRUMENTS[identifier]
            raw = snapshots[identifier]
            if raw['instrument']['id'] != identifier:
                raise ValueError('snapshot identity mismatch')
            rows = [{**bar, 'date': bar.get('bar_open_at', bar['date'])} for bar in raw['bars']]
            normalized = normalize_payload({item['upstream_symbol']: rows, '_provenance': {item['upstream_symbol']: raw['provenance']}}, BarsRequest(instrument_id=identifier, start_date=req.start_date, end_date=req.end_date))
            return snapshot(normalized)
        result = execute(request, local=True, series_loader=saved_series if snapshots is not None else load_series, perpetual_snapshot=perpetual)
    print(json.dumps(result, allow_nan=False, separators=(',', ':')))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'error': {'code': 'QUANT_INPUT_OR_SOURCE_UNAVAILABLE'}}))
        raise SystemExit(2)
