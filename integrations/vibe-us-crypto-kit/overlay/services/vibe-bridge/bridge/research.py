"""Narrow adapters for inspected pinned P2 tools. Upstream errors never leave here."""
from __future__ import annotations

import json
import math
import os
import re
from datetime import date, datetime, timezone
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from .models import INSTRUMENTS
from .normalize import SourceUnavailable
from .research_models import CONTRACT, MANAGERS, ResearchRequest

SOURCE_URLS = {
    'yahoo': 'https://finance.yahoo.com/', 'sec_edgar': 'https://www.sec.gov/edgar/search/',
    'sec_edgar_13f': 'https://www.sec.gov/edgar/search/', 'sec_nport': 'https://www.sec.gov/edgar/search/',
    'eastmoney': 'https://quote.eastmoney.com/usstock.html', 'ccxt': 'https://docs.ccxt.com/',
    'alternative_me': 'https://alternative.me/crypto/fear-and-greed-index/',
    'futu_opend': 'https://openapi.futunn.com/futu-api-doc/en/quote/get-earnings-calendar.html',
}


def sec_contact_valid(value):
    if not isinstance(value, str) or not 8 <= len(value) <= 256 or any(ord(c) < 32 for c in value):
        return False
    match = re.search(r'[A-Za-z0-9._%+\-]+@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})', value)
    return bool(match and match.group(1).lower() not in ('example.com', 'example.org', 'example.net')
                and not match.group(1).lower().endswith(('.invalid', '.test', '.localhost'))
                and len(value[:match.start()].strip()) >= 2)


def safe_cell(value, kind):
    if value is None:
        return None
    if kind == 'boolean':
        if isinstance(value, bool): return value
    elif kind in ('number', 'scalar') and isinstance(value, (int, float)) and not isinstance(value, bool):
        if math.isfinite(value): return value
    elif kind in ('text', 'scalar') and isinstance(value, str) and len(value) <= 1000:
        return value
    elif kind == 'date' and isinstance(value, str):
        try:
            if date.fromisoformat(value).isoformat() == value: return value
        except ValueError: pass
    elif kind in ('url', 'sec_url') and isinstance(value, str) and len(value) <= 1000:
        parsed = urlsplit(value)
        if parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password:
            if kind == 'url' or (parsed.hostname == 'www.sec.gov' and parsed.path.startswith('/Archives/edgar/data/')):
                return value
    raise SourceUnavailable('invalid research cell')


def envelope(request, reason=None):
    spec = CONTRACT['modules'][request.module]
    return {'schema_version': 1, 'module': request.module, 'instrument_id': request.instrument_id,
            'status': 'unavailable' if reason else 'available', 'reason': reason, 'source': spec['source'],
            'source_url': SOURCE_URLS[spec['source']], 'observed_at': datetime.now(timezone.utc).isoformat(),
            'as_of': None, 'quality': spec['quality'], 'upstream_commit': CONTRACT['commit'],
            'sections': [], 'notes': []}


def section(result, name, rows, reason=None):
    fields = CONTRACT['modules'][result['module']]['sections'][name]
    if not isinstance(rows, list): raise SourceUnavailable('invalid rows')
    # A ranked page is explicit, never described as the complete universe.
    if len(rows) > 100: raise SourceUnavailable('oversized section')
    shaped = [{key: safe_cell(row.get(key), kind) for key, kind in fields.items()} for row in rows]
    result['sections'].append({'id': name, 'status': 'available' if shaped else 'unavailable',
                               'reason': None if shaped else (reason or 'NO_DATA'), 'rows': shaped})


def checked_tool(tool, source, expected_market, **arguments):
    raw = json.loads(tool.execute(**arguments))
    if raw.get('ok') is not True or raw.get('source') != source or raw.get('market', '').lower() != expected_market:
        raise SourceUnavailable('tool source or market unavailable')
    if not isinstance(raw.get('data'), dict): raise SourceUnavailable('invalid tool data')
    return raw


def finalize(result):
    count = sum(s['status'] == 'available' for s in result['sections'])
    result['status'] = 'available' if count == len(result['sections']) and count else 'partial' if count else 'unavailable'
    result['reason'] = 'NO_DATA' if not count else None
    return result


def load_research(request):
    item = INSTRUMENTS[request.instrument_id]
    module = request.module
    if module in ('filings', 'financials', 'institutions', 'etf') and not sec_contact_valid(os.getenv('VIBE_TRADING_SEC_UA')):
        return envelope(request, 'SEC_CONTACT_REQUIRED')
    if module == 'earnings':
        from .calendar import gateway_settings
        if gateway_settings() is None:
            return envelope(request, 'US_CONNECTOR_REQUIRED')
    result = envelope(request)
    if module == 'earnings':
        from .calendar import load_calendar
        load_calendar(result, request)
    elif module == 'profile':
        from src.tools.stock_profile_tool import StockProfileTool
        raw = checked_tool(StockProfileTool(), 'yahoo', 'us', ticker=item['upstream_symbol'],
                           sections=['key_stats', 'financials', 'earnings_trend', 'recommendation_trend'])
        data = raw['data']; listing = data.get('listing', {})
        if data.get('ticker') != item['upstream_symbol'] or listing.get('symbol') != item['symbol'] or listing.get('currency') != 'USD':
            raise SourceUnavailable('listing identity changed')
        section(result, 'listing', [listing])
        for name in ('key_stats', 'financials'):
            section(result, name, [{'metric': k, 'value': v} for k, v in data['sections'].get(name, {}).items() if v is not None])
        for name in ('earnings_trend', 'recommendation_trend'): section(result, name, data['sections'].get(name, []))
        result['notes'] = ['CURRENT_SNAPSHOT_NOT_POINT_IN_TIME', 'PROVIDER_TIME_UNKNOWN']
    elif module == 'filings':
        from src.tools.sec_filings_tool import SecFilingsTool
        raw = checked_tool(SecFilingsTool(), 'sec_edgar', 'us', ticker=item['symbol'], limit=20)
        if raw['data'].get('ticker') != item['symbol']: raise SourceUnavailable('filing ticker changed')
        rows = raw['data'].get('filings', [])[:20]
        section(result, 'filings', rows)
        result['as_of'] = max((r['filing_date'] for r in rows if r.get('filing_date')), default=None)
        result['notes'] = ['RANKED_SLICE']
    elif module == 'financials':
        load_financials(result, request, item)
    elif module == 'institutions':
        from src.tools.institutional_holdings_tool import InstitutionalHoldingsTool
        cik = MANAGERS[request.manager]
        raw = checked_tool(InstitutionalHoldingsTool(), 'sec_edgar_13f', 'us', mode='manager_holdings',
                           manager=cik, include_changes=True, top_n=20)
        data = raw['data']; filing = data.get('filing') or {}; changes = data.get('changes') or {}
        if data.get('cik') != cik: raise SourceUnavailable('manager identity changed')
        resolution = data.get('amendment_resolution') or {}
        section(result, 'filing', [{**filing, 'manager': data.get('manager'), 'cik': cik,
                                   'resolution': resolution.get('resolution'), 'prior_period_end': changes.get('prior_period_end'),
                                   'prior_accession': changes.get('prior_accession')}])
        section(result, 'positions', data.get('positions', []))
        section(result, 'changes', changes.get('items', []), 'CHANGES_UNAVAILABLE' if changes.get('error') else 'NO_DATA')
        result['as_of'] = filing.get('period_end')
        result['notes'] = ['DISCLOSED_HOLDINGS_NOT_LIVE', 'RANKED_SLICE']
        if resolution.get('chain_truncated') or resolution.get('unresolved_amendments') or resolution.get('unresolved_duplicate_originals'):
            result['notes'].append('AMENDMENT_INCOMPLETE')
    elif module == 'etf':
        from src.tools.etf_holdings_tool import EtfHoldingsTool
        raw = checked_tool(EtfHoldingsTool(), 'sec_nport', 'us', mode='holdings', symbol=item['symbol'], market='US', top_n=20)
        data = raw['data']
        if data.get('symbol') != item['symbol']: raise SourceUnavailable('fund identity changed')
        section(result, 'filing', [{**data.get('fund', {}), **data.get('filing', {}), 'symbol': item['symbol'],
                                  'as_of': raw.get('as_of'), 'holdings_in_filing': data.get('holdings_in_filing')}])
        section(result, 'holdings', data.get('holdings', []))
        result['as_of'] = raw.get('as_of'); result['notes'] = ['DISCLOSED_HOLDINGS_NOT_LIVE', 'RANKED_SLICE']
    elif module == 'news':
        from src.tools.stock_news_tool import StockNewsTool
        from src.tools.sentiment_tool import _score_text
        raw = checked_tool(StockNewsTool(), 'yahoo', 'us', code=item['upstream_symbol'], scope='stock', limit=10)
        if raw['data'].get('code') != item['upstream_symbol']: raise SourceUnavailable('news identity changed')
        rows = [{**r, **_score_text(r.get('title') or '')} for r in raw['data'].get('articles', [])]
        section(result, 'articles', rows)
        result['notes'] = ['ENGLISH_LEXICON', 'PROVIDER_TIME_UNKNOWN']
    elif module == 'screener':
        from src.tools.market_screener_tool import MarketScreenerTool
        raw = checked_tool(MarketScreenerTool(), 'eastmoney', 'us', market='us', sort_by='change_pct', top_n=20)
        if raw['data'].get('market') != 'us': raise SourceUnavailable('screener universe changed')
        section(result, 'leaders', raw['data'].get('rows', []))
        result['notes'] = ['US_UNIVERSE_ONLY', 'PROVIDER_TIME_UNKNOWN', 'RANKED_SLICE']
    elif module == 'industry':
        # The upstream sector tool is A-share-only. Reuse the fixed Yahoo
        # transport for provider-declared US taxonomy, with an explicit basket.
        from backtest.loaders.yahoo_client import get_quote_summary
        def company(instrument):
            summary = get_quote_summary(instrument['upstream_symbol'], ['assetProfile', 'price', 'defaultKeyStatistics'])
            profile, price, stats = (summary.get(name) or {} for name in ('assetProfile', 'price', 'defaultKeyStatistics'))
            if price.get('symbol') != instrument['symbol'] or price.get('currency') != 'USD':
                raise SourceUnavailable('peer identity changed')
            def raw(value): return value.get('raw') if isinstance(value, dict) else value
            return {'symbol': price['symbol'], 'currency': price['currency'], 'sector': profile.get('sector'),
                    'industry': profile.get('industry'), 'market_cap': raw(price.get('marketCap')),
                    'forward_pe': raw(stats.get('forwardPE')), 'profit_margin': raw(stats.get('profitMargins'))}
        selected = company(item)
        if not selected['sector'] or not selected['industry']: raise SourceUnavailable('taxonomy missing')
        peers = []; failed = False
        for peer in INSTRUMENTS.values():
            if peer['market'] != 'us_equity' or peer['id'] == item['id']: continue
            try:
                row = company(peer)
                if not row['sector']: failed = True
                if row['sector'] == selected['sector']: peers.append(row)
            except Exception:
                failed = True
        section(result, 'company', [selected]); section(result, 'peers', peers)
        result['notes'] = ['DEPLOYED_BASKET_NOT_SECTOR_UNIVERSE', 'CURRENT_SNAPSHOT_NOT_POINT_IN_TIME', 'PROVIDER_TIME_UNKNOWN']
        if failed: result['notes'].append('PEER_DATA_INCOMPLETE')
    elif module == 'orderbook':
        from src.tools.orderbook_depth_tool import OrderBookDepthTool
        raw = checked_tool(OrderBookDepthTool(), 'ccxt', 'crypto', symbol=item['symbol'], exchange=item['source'], levels=10, notional_quote=10000)
        data = raw['data']
        if data.get('exchange') != item['source'] or data.get('symbol') != item['symbol']:
            raise SourceUnavailable('book identity changed')
        stamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00')).isoformat()
        if abs((datetime.now(timezone.utc) - datetime.fromisoformat(stamp)).total_seconds()) > 120:
            raise SourceUnavailable('stale order book')
        section(result, 'snapshot', [{**data, 'timestamp': stamp, 'spread_quote': data['spread']['absolute_quote'],
                                     'spread_bps': data['spread']['relative_bps'], 'imbalance': data['imbalance']['normalized_imbalance'],
                                     'notional_quote': data['impact_cost']['notional_quote']}])
        for side in ('bids', 'asks'): section(result, side, data['depth'][side])
        section(result, 'impact', [{'side': side, **data['impact_cost'][side]} for side in ('buy', 'sell')])
        result['as_of'] = stamp
        if data['timestamp_source'] == 'local_fetch_time': result['notes'].append('LOCAL_BOOK_TIME')
        if any(not data['impact_cost'][side]['fully_filled'] for side in ('buy', 'sell')): result['notes'].append('PARTIAL_DEPTH_FILL')
    elif module == 'fear_greed':
        # The pinned helper drops the API timestamp. Keep its exact endpoint,
        # but preserve the documented observation time and reject missing values.
        req = Request('https://api.alternative.me/fng/?limit=1', headers={'User-Agent': 'Afflatus research/1.0'})
        with urlopen(req, timeout=10) as response:
            payload = response.read(65537)
            if len(payload) > 65536: raise SourceUnavailable('index too large')
            raw = json.loads(payload)
        row = raw['data'][0]; value = int(row['value']); stamp = datetime.fromtimestamp(int(row['timestamp']), timezone.utc)
        if not 0 <= value <= 100 or not 0 <= (datetime.now(timezone.utc) - stamp).total_seconds() <= 3 * 86400:
            raise SourceUnavailable('invalid or stale index')
        result['as_of'] = stamp.isoformat()
        section(result, 'index', [{'value': value, 'classification': row['value_classification'], 'index_at': result['as_of']}])
        result['notes'] = ['BITCOIN_INDEX_NOT_INSTRUMENT_SENTIMENT']
    return finalize(result)


def load_financials(result, request, item):
    """Per-concept latest fact known by cutoff; never use a later restatement.

    Reuse pinned concepts/span classification. Keep units, filed dates and
    accession per value; don't merge annual and quarterly spans or invent Q4.
    """
    from backtest.loaders.sec_edgar_client import cik_for, get_company_facts
    from backtest.loaders import sec_frames as frames
    from src.tools.financial_statements_tool import _SEC_CONCEPTS
    cik = cik_for(item['symbol'])
    if not cik: raise SourceUnavailable('ticker unresolved')
    facts = get_company_facts(cik)
    if str(facts.get('cik', '')).zfill(10) != cik: raise SourceUnavailable('facts identity changed')
    gaap = facts.get('facts', {}).get('us-gaap', {})
    cutoff = (request.cutoff or datetime.now(timezone.utc).date()).isoformat()
    for statement in ('balance', 'income', 'cashflow'):
        chosen = {}
        for concept in _SEC_CONCEPTS[statement]:
            for unit, rows in gaap.get(concept, {}).get('units', {}).items():
                for row in rows:
                    filed, end, start = row.get('filed'), row.get('end'), row.get('start')
                    if not filed or not end or filed > cutoff or end > cutoff or row.get('form') not in ('10-K', '10-K/A', '10-Q', '10-Q/A'):
                        continue
                    kind = frames.classify_span(frames.span_days(row))
                    if kind == frames.INSTANT:
                        if statement != 'balance' or (request.cadence == 'annual' and row['form'] not in ('10-K', '10-K/A')): continue
                    elif kind != (frames.ANNUAL if request.cadence == 'annual' else frames.QUARTER): continue
                    key = (concept, unit, start, end)
                    if key in chosen and chosen[key]['filed_at'] >= filed: continue
                    accession = row.get('accn')
                    chosen[key] = {'concept': concept, 'unit': unit, 'value': row.get('val'), 'period_start': start,
                                   'period_end': end, 'filed_at': filed, 'accession': accession, 'form': row['form'],
                                   'document_url': f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace("-", "")}/' if accession else None}
        # Latest three distinct reported spans; keep every allowed concept in each.
        periods = sorted({(r['period_end'], r['period_start'] or '') for r in chosen.values()}, reverse=True)[:3]
        selected = [r for r in chosen.values() if (r['period_end'], r['period_start'] or '') in periods]
        section(result, statement, sorted(selected, key=lambda r: (r['period_end'], r['concept']), reverse=True))
    result['as_of'] = cutoff
    result['notes'] = ['FILED_CUTOFF_APPLIED', 'RAW_REPORTED_QUARTERS_NO_SYNTHETIC_Q4']
