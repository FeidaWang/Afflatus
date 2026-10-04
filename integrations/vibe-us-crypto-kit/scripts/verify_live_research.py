#!/usr/bin/env python3
"""Opt-in real P2 requests; retain contract status/metadata, no price payloads or contacts."""
import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

KIT = Path(__file__).resolve().parents[1]
HOST = KIT.parents[1]
sys.path.insert(0, str(HOST / 'services/vibe-bridge'))


async def main():
    from bridge.models import BarsRequest
    from bridge.research_models import ResearchRequest
    from bridge.provider import fetch_bars
    from bridge.research import envelope
    from bridge.normalize import SourceUnavailable
    os.environ['VIBE_UPSTREAM_AGENT'] = str(KIT / 'vendor/vibe-trading/agent')
    report = {'layer': 'real_network_pinned_workers', 'mocked': False,
              'tested_at': datetime.now(timezone.utc).isoformat(), 'results': []}
    out = KIT / 'validation/p2-live-research.json'
    requests = [ResearchRequest(instrument_id='US:AAPL', module=m) for m in ('profile', 'news', 'screener', 'industry', 'filings', 'financials', 'institutions')]
    requests += [ResearchRequest(instrument_id='US:IVV', module='etf')]
    requests += [ResearchRequest(instrument_id=i, module=m) for i, m in [('CRYPTO:OKX:BTC-USDT:SPOT', 'orderbook'),
                 ('CRYPTO:BINANCE:BTC-USDT:SPOT', 'orderbook'), ('CRYPTO:OKX:BTC-USDT:SPOT', 'fear_greed')]]
    requests += [BarsRequest(instrument_id=i, start_date='2025-01-02', end_date='2025-01-15')
                 for i in ('US:AAPL', 'US:SPY', 'US:IVV', 'CRYPTO:OKX:BTC-USDT:SPOT', 'CRYPTO:BINANCE:BTC-USDT:SPOT')]
    for request in requests:
        research = isinstance(request, ResearchRequest)
        entry = {'instrument': request.instrument_id, 'module': request.module if research else 'bars'}
        try:
            result = await fetch_bars(request, research=research)
            entry.update({'status': result.get('status', 'available'), 'reason': result.get('reason'),
                          'source': result.get('source') or result.get('provenance', {}).get('source'),
                          'as_of': result.get('as_of') or result.get('provenance', {}).get('last_bar_date'),
                          'sections': [{ 'id': s['id'], 'status': s['status'], 'rows': len(s['rows']) } for s in result.get('sections', [])],
                          'bar_count': len(result.get('bars', []))})
        except SourceUnavailable:
            entry.update(status='unavailable', reason='SOURCE_UNAVAILABLE')
        report['results'].append(entry); out.write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(entry), flush=True)
    return report


if __name__ == '__main__': asyncio.run(main())
