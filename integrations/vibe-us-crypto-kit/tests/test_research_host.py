"""Host P2 contracts. Synthetic fixtures and mocked transport, never live evidence."""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

import pytest

pytestmark = pytest.mark.skipif(not os.getenv('VIBE_TEST_HOST_ROOT') or not os.getenv('VIBE_UPSTREAM_TEST_AGENT'), reason='host and pinned runtime required')


@pytest.fixture(autouse=True)
def pinned(monkeypatch):
    monkeypatch.syspath_prepend(os.environ['VIBE_UPSTREAM_TEST_AGENT'])
    monkeypatch.delenv('VIBE_TRADING_SEC_UA', raising=False)


def test_scope_rejects_arbitrary_tool_market_path_and_arguments():
    from bridge.research_models import ResearchRequest
    for fields in [dict(module='shell'), dict(instrument_id='HK:0700'), dict(url='https://example.com'),
                   dict(module='orderbook'), dict(cadence='quarter'), dict(manager='../owner'), dict(cutoff='2099-01-01')]:
        with pytest.raises(ValueError): ResearchRequest.model_validate(dict(instrument_id='US:AAPL', module='profile') | fields)
    for module in ('filings', 'profile', 'screener', 'etf'):
        with pytest.raises(ValueError): ResearchRequest(instrument_id='CRYPTO:OKX:BTC-USDT:SPOT', module=module)


def test_sec_contact_gate_does_not_import_or_fetch(monkeypatch):
    from bridge.research_models import ResearchRequest
    from bridge.research import load_research, sec_contact_valid
    assert sec_contact_valid('Offline operator test@operator-domain.org')
    for contact in [None, '', 'contact: bot@example.com', 'Operator bot@host.test', 'Operator bot@host.invalid', 'Operator bot@real.org\nInjected']:
        assert not sec_contact_valid(contact)
    for module in ('filings', 'financials', 'institutions', 'etf'):
        instrument = 'US:IVV' if module == 'etf' else 'US:AAPL'
        result = load_research(ResearchRequest(module=module, instrument_id=instrument))
        assert result['status'] == 'unavailable' and result['reason'] == 'SEC_CONTACT_REQUIRED'
        assert not result['sections'] and result['as_of'] is None


def test_profile_fixed_source_identity_missing_data_and_projection(monkeypatch):
    from bridge.research import load_research, SourceUnavailable
    from bridge.research_models import ResearchRequest
    from src.tools.stock_profile_tool import StockProfileTool
    raw = {'ok': True, 'source': 'yahoo', 'market': 'us', 'data': {'ticker': 'AAPL.US',
           'listing': {'symbol': 'AAPL', 'currency': 'USD', 'secret': 'never-forward'},
           'sections': {'key_stats': {'forwardPE': 25, 'forwardEps': None}, 'financials': {}, 'earnings_trend': [], 'recommendation_trend': []}}}
    monkeypatch.setattr(StockProfileTool, 'execute', lambda *_args, **_kwargs: json.dumps(raw))
    request = ResearchRequest(instrument_id='US:AAPL', module='profile')
    result = load_research(request)
    assert result['status'] == 'partial' and result['as_of'] is None
    assert 'never-forward' not in json.dumps(result) and 'forwardEps' not in json.dumps(result)
    raw['data']['listing']['currency'] = 'HKD'
    with pytest.raises(SourceUnavailable): load_research(request)


def test_point_in_time_facts_exclude_restatements_and_ytd_and_keep_units(monkeypatch):
    from bridge.research import load_financials, envelope
    from bridge.research_models import ResearchRequest
    from backtest.loaders import sec_edgar_client
    monkeypatch.setattr(sec_edgar_client, 'cik_for', lambda _: '0000320193')
    rows = [dict(start='2024-01-01', end='2024-03-31', filed='2024-05-01', form='10-Q', accn='original', val=100),
            dict(start='2024-01-01', end='2024-03-31', filed='2025-05-01', form='10-Q', accn='future-restatement', val=999),
            dict(start='2024-01-01', end='2024-09-30', filed='2024-11-01', form='10-Q', accn='ytd', val=300),
            dict(start='2024-01-01', end='2024-12-31', filed='2025-02-01', form='10-K', accn='annual', val=400)]
    facts = {'cik': 320193, 'facts': {'us-gaap': {'Revenues': {'units': {'USD': rows}}}}}
    monkeypatch.setattr(sec_edgar_client, 'get_company_facts', lambda _: facts)
    req = ResearchRequest(module='financials', instrument_id='US:AAPL', cadence='quarter', cutoff='2024-12-31')
    result = envelope(req); load_financials(result, req, {'symbol': 'AAPL'})
    income = next(s for s in result['sections'] if s['id'] == 'income')['rows']
    assert len(income) == 1 and income[0]['value'] == 100 and income[0]['filed_at'] == '2024-05-01'
    assert income[0]['period_start'] == '2024-01-01' and income[0]['unit'] == 'USD'
    assert 'future-restatement' not in json.dumps(result) and 'ytd' not in json.dumps(result)
    req = ResearchRequest(module='financials', instrument_id='US:AAPL', cadence='annual', cutoff='2025-04-01')
    result = envelope(req); load_financials(result, req, {'symbol': 'AAPL'})
    assert next(s for s in result['sections'] if s['id'] == 'income')['rows'][0]['value'] == 400


def test_orderbook_reuses_real_pinned_math_keeps_venue_and_partial_fill(monkeypatch):
    from bridge.research import load_research, SourceUnavailable
    from bridge.research_models import ResearchRequest
    from src.tools import orderbook_depth_tool as book
    raw = {'timestamp': int(datetime.now(timezone.utc).timestamp() * 1000), 'bids': [[99, 1]], 'asks': [[101, 1]]}
    calls = []
    def fetch(exchange, symbol, limit):
        calls.append((exchange, symbol)); return raw
    monkeypatch.setattr(book, '_fetch_raw_book', fetch)
    result = load_research(ResearchRequest(module='orderbook', instrument_id='CRYPTO:BINANCE:BTC-USDT:SPOT'))
    assert calls == [('binance', 'BTC/USDT')]
    snapshot = result['sections'][0]['rows'][0]
    assert snapshot['exchange'] == 'binance' and snapshot['spread_quote'] == 2 and snapshot['imbalance'] < 0
    assert 'PARTIAL_DEPTH_FILL' in result['notes']
    impact = next(s for s in result['sections'] if s['id'] == 'impact')['rows']
    assert not impact[0]['fully_filled'] and impact[0]['filled_base_qty'] == 1
    raw['timestamp'] -= 600000
    with pytest.raises(SourceUnavailable): load_research(ResearchRequest(module='orderbook', instrument_id='CRYPTO:OKX:BTC-USDT:SPOT'))


def test_binance_utc_alignment_never_accepts_okx_candle(monkeypatch):
    from bridge.models import BarsRequest
    from bridge.normalize import normalize_payload, SourceUnavailable
    req = BarsRequest(instrument_id='CRYPTO:BINANCE:BTC-USDT:SPOT', start_date='2025-01-01', end_date='2025-01-10')
    raw = {'BTC-USDT': [dict(trade_date='2025-01-02T00:00:00', open=100, high=105, low=99, close=103, volume=10)],
           '_provenance': {'BTC-USDT': {'source': 'binance', 'quote_currency': 'USDT'}}}
    result = normalize_payload(raw, req)
    assert result['provenance']['bar_timezone'] == 'UTC'
    assert result['bars'][0]['bar_close_at'] == '2025-01-03T00:00:00+00:00'
    raw['_provenance']['BTC-USDT']['source'] = 'okx'
    with pytest.raises(SourceUnavailable): normalize_payload(raw, req)


def test_industry_uses_declared_us_taxonomy_and_reports_missing_peer(monkeypatch):
    from bridge.research import load_research
    from bridge.research_models import ResearchRequest
    from backtest.loaders import yahoo_client
    def summary(symbol, modules):
        assert modules == ['assetProfile', 'price', 'defaultKeyStatistics']
        if symbol == 'MSFT.US': raise RuntimeError('network unavailable')
        return {'price': {'symbol': symbol[:-3], 'currency': 'USD', 'marketCap': {'raw': 100}},
                'assetProfile': {'sector': 'Technology', 'industry': 'Semiconductors'}, 'defaultKeyStatistics': {'forwardPE': {'raw': 25}}}
    monkeypatch.setattr(yahoo_client, 'get_quote_summary', summary)
    result = load_research(ResearchRequest(module='industry', instrument_id='US:NVDA'))
    assert result['source'] == 'yahoo' and result['as_of'] is None
    peers = next(s for s in result['sections'] if s['id'] == 'peers')['rows']
    assert {r['symbol'] for r in peers} == {'AAPL', 'MU'}
    assert 'PEER_DATA_INCOMPLETE' in result['notes'] and 'DEPLOYED_BASKET_NOT_SECTOR_UNIVERSE' in result['notes']


def test_13f_projection_retains_amendments_and_missing_prior_data(monkeypatch):
    from bridge.research import load_research
    from bridge.research_models import ResearchRequest
    from src.tools.institutional_holdings_tool import InstitutionalHoldingsTool
    monkeypatch.setenv('VIBE_TRADING_SEC_UA', 'Offline operator test@operator-domain.org')
    raw = {'ok': True, 'source': 'sec_edgar_13f', 'market': 'US', 'data': {
        'cik': '0001067983', 'manager': 'Berkshire', 'filing': {'period_end': '2025-06-30', 'filing_date': '2025-08-14', 'accession': 'amended'},
        'amendment_resolution': {'resolution': 'incomplete_unspecified_amendment', 'unresolved_amendments': 1},
        'positions': [{'issuer': 'Apple', 'cusip': '037833100', 'value_usd': 100, 'shares': 1, 'weight_pct': 100}],
        'changes': {'error': 'private upstream text'}}}
    monkeypatch.setattr(InstitutionalHoldingsTool, 'execute', lambda *_args, **_kwargs: json.dumps(raw))
    result = load_research(ResearchRequest(module='institutions', instrument_id='US:AAPL'))
    assert result['as_of'] == '2025-06-30' and result['status'] == 'partial'
    assert result['sections'][0]['rows'][0]['filing_date'] == '2025-08-14'
    assert 'AMENDMENT_INCOMPLETE' in result['notes'] and 'private upstream text' not in json.dumps(result)
    assert result['sections'][-1]['reason'] == 'CHANGES_UNAVAILABLE'


def test_nport_keeps_report_and_filing_identity_and_unknown_currency(monkeypatch):
    from bridge.research import load_research
    from bridge.research_models import ResearchRequest
    from src.tools.etf_holdings_tool import EtfHoldingsTool
    monkeypatch.setenv('VIBE_TRADING_SEC_UA', 'Offline operator test@operator-domain.org')
    raw = {'ok': True, 'source': 'sec_nport', 'market': 'US', 'as_of': '2025-06-30', 'data': {
        'symbol': 'IVV', 'fund': {'series_name': 'iShares S&P 500', 'cik': '0001100663', 'series_id': 'S000006012'},
        'filing': {'filing_date': '2025-08-29', 'accession': 'original', 'disclosure_lag_days': 60,
                   'document_url': 'https://www.sec.gov/Archives/edgar/data/1100663/original/primary_doc.xml'},
        'holdings_in_filing': 500, 'holdings': [{'name': 'Apple', 'ticker': 'AAPL', 'value_usd': 100, 'pct_of_net_assets': 5}]}}
    monkeypatch.setattr(EtfHoldingsTool, 'execute', lambda *_args, **_kwargs: json.dumps(raw))
    result = load_research(ResearchRequest(module='etf', instrument_id='US:IVV'))
    assert result['status'] == 'available' and result['as_of'] == '2025-06-30'
    assert result['sections'][0]['rows'][0]['filing_date'] == '2025-08-29'
    assert result['sections'][1]['rows'][0]['currency'] is None
    assert 'DISCLOSED_HOLDINGS_NOT_LIVE' in result['notes'] and 'RANKED_SLICE' in result['notes']


def test_patterns_use_pinned_helpers_and_label_retrospective_confirmation():
    import pandas as pd
    from bridge.patterns import calculate_patterns
    from src.tools.pattern_tool import double_top_bottom, candlestick_patterns
    bars = [dict(date=(datetime(2025, 1, 1) + timedelta(days=i)).date().isoformat(), open=100 + i % 11,
                 high=104 + i % 11, low=98 + i % 11, close=101 + i % 11) for i in range(60)]
    series = {'bars': bars, 'provenance': {'last_bar_date': bars[-1]['date'], 'source': 'yahoo'}}
    result = calculate_patterns(series)
    frame = pd.DataFrame(bars).set_index('date')
    expected = double_top_bottom(frame.close)
    events = result['patterns']['double_top_bottom']['events']
    assert [(e['date'], e['value']) for e in events] == [(d, int(v)) for d, v in expected.items() if v]
    assert all(e['confirmed_at'] == bars[-1]['date'] for e in events)
    assert result['interpretation'] == 'retrospective_patterns_not_tradable_signals'
    series['bars'] = bars[:1]
    result = calculate_patterns(series)
    assert all(p['status'] == 'unavailable' and p['events'] == [] for p in result['patterns'].values())


def test_research_http_auth_config_error_and_queue_isolation(monkeypatch):
    from fastapi.testclient import TestClient
    import bridge.app as app
    from bridge.normalize import SourceUnavailable
    app.cache.clear(); app.inflight.clear()
    token = 'offline-server-test-token-' + 'x' * 32
    monkeypatch.setenv('VIBE_BRIDGE_TOKEN', token)
    client = TestClient(app.app); headers = {'Authorization': 'Bearer ' + token}
    req = {'module': 'filings', 'instrument_id': 'US:AAPL'}
    assert client.post('/v1/research', json=req).status_code == 401
    result = client.post('/v1/research', json=req, headers=headers)
    assert result.status_code == 200 and result.json()['reason'] == 'SEC_CONTACT_REQUIRED'
    async def failed(*args, **kwargs): raise SourceUnavailable('private upstream content')
    monkeypatch.setattr(app, 'fetch_bars', failed)
    result = client.post('/v1/research', json={'module': 'profile', 'instrument_id': 'US:AAPL'}, headers=headers)
    assert result.json()['reason'] == 'SOURCE_UNAVAILABLE' and 'private upstream' not in result.text
    assert result.headers['cache-control'] == 'private, no-store'
    assert client.post('/v1/research', json=req | {'instrument_id': 'HK:0700'}, headers=headers).status_code == 422
