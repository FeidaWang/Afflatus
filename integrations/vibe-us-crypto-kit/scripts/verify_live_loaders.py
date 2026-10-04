#!/usr/bin/env python3
"""Opt-in real network contract check; never stores or publishes price data."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

from bootstrap_upstream import KIT, verify_checkout


async def verify(out: Path, host: Path):
    upstream = KIT / 'vendor/vibe-trading'
    lock = json.loads((KIT / 'manifests/upstream-lock.json').read_text())
    verify_checkout(upstream, lock)
    sys.path.insert(0, str(host / 'services/vibe-bridge'))
    from bridge.models import BarsRequest
    from bridge.provider import fetch_bars
    from bridge.normalize import SourceUnavailable
    os.environ['VIBE_UPSTREAM_AGENT'] = str(upstream / 'agent')
    report = {'layer': 'real_network_pinned_loader_and_host_normalizer', 'commit': lock['commit'],
              'tested_at': datetime.now(timezone.utc).isoformat(), 'results': [], 'mocked': False}
    for instrument in ('US:AAPL', 'US:SPY', 'CRYPTO:OKX:BTC-USDT:SPOT'):
        # A historical interval avoids treating a partial day as a quote.
        req = BarsRequest(instrument_id=instrument, start_date='2025-01-02', end_date='2025-01-15')
        try:
            result = await fetch_bars(req)
            assert result['instrument']['id'] == instrument
            assert all(req.start_date.isoformat() <= b['date'] < req.end_date.isoformat() for b in result['bars'])
            assert result['provenance']['is_realtime_quote'] is False
            report['results'].append({'instrument': instrument, 'status': 'PASS', 'bars_count': len(result['bars']),
                                       'provenance': result['provenance']})
        except (SourceUnavailable, AssertionError) as error:
            report['results'].append({'instrument': instrument, 'status': 'FAIL', 'code': type(error).__name__})
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return all(r['status'] == 'PASS' for r in report['results'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', type=Path, default=KIT.parents[1])
    parser.add_argument('--out', type=Path, default=KIT / 'validation/live-loaders.json')
    args = parser.parse_args()
    raise SystemExit(0 if asyncio.run(verify(args.out, args.host.resolve())) else 1)
