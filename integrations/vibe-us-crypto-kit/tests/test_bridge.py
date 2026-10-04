"""Offline synthetic contract tests; these do not contact a market-data provider."""
import asyncio
from copy import deepcopy
from datetime import date, timedelta
import importlib

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from bridge.models import BarsRequest, INSTRUMENTS
from bridge.normalize import SourceUnavailable, normalize_payload
from bridge.limits import RequestBodyLimit
from bridge.provider import _bounded_read

BASE = dict(instrument_id='US:AAPL', start_date='2026-01-01', end_date='2026-01-10')
TOKEN = 'test-token-for-offline-validation-' + 'x'*32


def payload(request=None):
    request = request or BarsRequest(**BASE)
    item = INSTRUMENTS[request.instrument_id]
    return {
        item['upstream_symbol']: [dict(date='2026-01-02T16:00:00' if item['market']=='crypto_spot' else '2026-01-02', open=100, high=105, low=99, close=103, volume=1000)],
        '_provenance': {item['upstream_symbol']: {'source': item['source'], 'quote_currency': item['quote_currency'], 'volume_unit': 'shares', 'adjustment': 'unknown', 'fallback_used': False}},
    }


@pytest.mark.parametrize('instrument', list(INSTRUMENTS))
def test_registered_market_is_accepted(instrument):
    assert BarsRequest(**{**BASE, 'instrument_id':instrument}).interval == '1D'


@pytest.mark.parametrize('change', [
    {'instrument_id':'HK:0700'}, {'instrument_id':'../../etc/passwd'},
    {'instrument_id':'CRYPTO:OKX:BTC-USDT:PERP'}, {'interval':'1m'},
    {'mcpServers':{}}, {'source':'http://127.0.0.1/secrets'}, {'start_date':'2026-01-10'},
    {'end_date':'2028-01-01'}, {'start_date':'2024-01-01'}, {'end_date':'not-a-date'},
])
def test_request_is_fail_closed(change):
    with pytest.raises(ValidationError): BarsRequest(**{**BASE, **change})


def test_normalized_contract_and_no_internal_symbol():
    result = normalize_payload(payload(), BarsRequest(**BASE))
    assert result['bars'][0]['close'] == 103
    assert result['provenance']['last_bar_date'] == '2026-01-02'
    assert result['provenance']['is_realtime_quote'] is False
    assert result['provenance']['quote_currency'] == 'USD'
    assert 'upstream_symbol' not in result['instrument']


def test_crypto_keeps_usdt_and_spot_identity():
    req = BarsRequest(**{**BASE, 'instrument_id':'CRYPTO:OKX:BTC-USDT:SPOT'})
    result = normalize_payload(payload(req), req)
    assert result['instrument']['market'] == 'crypto_spot'
    assert result['provenance']['quote_currency'] == 'USDT'
    assert result['provenance']['source'] == 'okx'


@pytest.mark.parametrize('field,value', [('close',float('nan')),('open',True),('high',0),('low',104),('volume',-1),('volume',True),('close','103')])
def test_invalid_numeric_data_rejected(field,value):
    raw=payload(); raw['AAPL.US'][0][field]=value
    with pytest.raises(SourceUnavailable): normalize_payload(raw,BarsRequest(**BASE))


@pytest.mark.parametrize('patch', [ {'source':'stooq'}, {'quote_currency':'AUD'}, {'resolved_symbol':'MSFT.US'}, {'fallback_used':True} ])
def test_provenance_identity_rejected(patch):
    raw=payload(); raw['_provenance']['AAPL.US'].update(patch)
    with pytest.raises(SourceUnavailable): normalize_payload(raw,BarsRequest(**BASE))


@pytest.mark.parametrize('data', [[], {'data':[],'truncated':True}, None])
def test_missing_sampled_data_rejected(data):
    raw=payload();raw['AAPL.US']=data
    with pytest.raises(SourceUnavailable): normalize_payload(raw,BarsRequest(**BASE))


def test_duplicate_dates_rejected():
    raw=payload();raw['AAPL.US']*=2
    with pytest.raises(SourceUnavailable): normalize_payload(raw,BarsRequest(**BASE))


def test_sort_and_exclusive_end_without_fill():
    raw=payload();row=raw['AAPL.US'][0]
    raw['AAPL.US']=[{**row,'date':'2026-01-10'},{**row,'date':'2026-01-05'},row,{**row,'date':'2025-12-31'}]
    result=normalize_payload(raw,BarsRequest(**BASE))
    assert [x['date'] for x in result['bars']]==['2026-01-02','2026-01-05']


@pytest.fixture
def service(monkeypatch):
    module=importlib.import_module('bridge.app')
    module.cache.clear();module.inflight.clear();module.slots=asyncio.Semaphore(2)
    monkeypatch.setenv('VIBE_BRIDGE_TOKEN',TOKEN)
    with TestClient(module.app) as client:
        yield module,client
    module.cache.clear();module.inflight.clear()


def test_health_is_non_secret(service):
    _,client=service
    r=client.get('/healthz')
    assert r.status_code==200 and TOKEN not in r.text
    assert r.headers['cache-control']=='private, no-store'


@pytest.mark.parametrize('headers',[{}, {'Authorization':'wrong'}, {'Authorization':'Bearer bad'}])
def test_auth_rejects(service,headers):
    _,client=service
    assert client.get('/v1/instruments',headers=headers).status_code==401


def test_missing_secret_is_not_open(service,monkeypatch):
    _,client=service;monkeypatch.delenv('VIBE_BRIDGE_TOKEN')
    assert client.get('/v1/instruments').status_code==503


def test_registry_only_and_no_private_data(service):
    _,client=service
    r=client.get('/v1/instruments',headers={'Authorization':'Bearer '+TOKEN})
    assert r.status_code==200 and len(r.json()['instruments'])==9
    assert 'upstream_symbol' not in r.text


@pytest.mark.parametrize('path',['/settings','/v1/orders','/sessions','/docs','/openapi.json','/live','/shutdown'])
def test_sensitive_routes_absent(service,path):
    _,client=service
    assert client.get(path,headers={'Authorization':'Bearer '+TOKEN}).status_code==404


def test_success_and_short_cache(service,monkeypatch):
    module,client=service;calls=[]
    async def fake(req): calls.append(req);return normalize_payload(payload(req),req)
    monkeypatch.setattr(module,'fetch_bars',fake)
    for _ in range(2):
        r=client.post('/v1/bars',json=BASE,headers={'Authorization':'Bearer '+TOKEN})
        assert r.status_code==200 and r.json()['bars'][0]['close']==103
    assert len(calls)==1


def test_source_failure_is_explicit_not_mock(service,monkeypatch):
    module,client=service
    async def fail(req):raise SourceUnavailable('secret details must not leak')
    monkeypatch.setattr(module,'fetch_bars',fail)
    r=client.post('/v1/bars',json=BASE,headers={'Authorization':'Bearer '+TOKEN})
    assert r.status_code==503 and 'secret details' not in r.text
    assert not module.cache


def test_invalid_request_never_loads(service,monkeypatch):
    module,client=service
    async def forbidden(req):pytest.fail('must not load')
    monkeypatch.setattr(module,'fetch_bars',forbidden)
    r=client.post('/v1/bars',json={**BASE,'instrument_id':'HK:0700'},headers={'Authorization':'Bearer '+TOKEN})
    assert r.status_code==422


def test_large_body_rejected_before_parse(service):
    _,client=service
    r=client.post('/v1/bars',content=b'x'*4097,headers={'Authorization':'Bearer '+TOKEN})
    assert r.status_code==413 and r.headers['cache-control']=='private, no-store'


def test_chunked_body_limit_without_content_length():
    async def run():
        messages=iter([{'type':'http.request','body':b'x'*3000,'more_body':True},{'type':'http.request','body':b'x'*2000,'more_body':False}]);output=[]
        async def receive():return next(messages)
        async def send(value):output.append(value)
        async def forbidden(*args):pytest.fail('must not parse oversized stream')
        await RequestBodyLimit(forbidden)({'type':'http','method':'POST','path':'/v1/bars','headers':[]},receive,send)
        assert output[0]['status']==413
    asyncio.run(run())


def test_worker_output_limit():
    async def run():
        stream=asyncio.StreamReader();stream.feed_data(b'x'*100);stream.feed_eof()
        with pytest.raises(SourceUnavailable):await _bounded_read(stream,10)
        stream=asyncio.StreamReader();stream.feed_data(b'{}');stream.feed_eof()
        assert await _bounded_read(stream,10)==b'{}'
    asyncio.run(run())


def test_subprocess_contract_and_credentials_scrubbed(tmp_path, monkeypatch):
    # Synthetic source proves our process boundary, NOT actual provider compatibility.
    from bridge.provider import fetch_bars
    upstream=tmp_path/'upstream';(upstream/'src').mkdir(parents=True)
    (upstream/'src/__init__.py').write_text('')
    (upstream/'src/market_data.py').write_text('''
import os
class Loader:
    name = "yahoo"
def get_loader(source): return Loader
def fetch_market_data(**kw):
    assert all(k not in os.environ for k in ["OPENAI_API_KEY", "BINANCE_API_SECRET", "ARENA_ADMIN_KEY"])
    assert kw["codes"] == ["AAPL.US"]
    assert kw["max_rows"] == 0 and kw["max_fallback_attempts"] == 1
    assert kw["include_provenance"] and kw["interval"] == "1D"
    assert kw["loader_resolver"]("yahoo").name == "yahoo"
    assert kw["fallback_chain_provider"]("yahoo") == ["yahoo"]
    print("loader diagnostic must not corrupt JSON stdout")
    return {"AAPL.US":[{"date":"2026-01-02","open":100,"high":105,"low":99,"close":103,"volume":1}],
            "_provenance":{"AAPL.US":{"source":"yahoo","quote_currency":"USD"}}}
''')
    monkeypatch.setenv('VIBE_UPSTREAM_AGENT',str(upstream))
    for key in ['OPENAI_API_KEY','BINANCE_API_SECRET','ARENA_ADMIN_KEY']:monkeypatch.setenv(key,'synthetic-private-key')
    if __import__('os').environ.get('VIBE_TEST_HOST_ROOT'):
        # The host now verifies pinned blobs before importing any loader.
        # Keep this synthetic source as a rejection test, and inspect the
        # actual process environment without bypassing that verification.
        create = asyncio.create_subprocess_exec
        captured = {}
        async def spy(*args, **kwargs):
            captured.update(kwargs['env'])
            return await create(*args, **kwargs)
        monkeypatch.setattr(asyncio, 'create_subprocess_exec', spy)
        with pytest.raises(SourceUnavailable): asyncio.run(fetch_bars(BarsRequest(**BASE)))
        assert all(k not in captured for k in ['OPENAI_API_KEY','BINANCE_API_SECRET','ARENA_ADMIN_KEY'])
        assert 'synthetic-private-key' not in str(captured)
        return
    result=asyncio.run(fetch_bars(BarsRequest(**BASE)))
    assert result['schema_version']==1 and result['bars'][0]['close']==103
    assert 'synthetic-private-key' not in str(result)


def test_subprocess_refuses_implicit_provider_fallback(tmp_path,monkeypatch):
    from bridge.provider import fetch_bars
    upstream=tmp_path/'upstream';(upstream/'src').mkdir(parents=True)
    (upstream/'src/__init__.py').write_text('')
    (upstream/'src/market_data.py').write_text('''
class Loader:
    name="unapproved-fallback"
def get_loader(source):return Loader
def fetch_market_data(**kw):return kw["loader_resolver"]("yahoo")
''')
    monkeypatch.setenv('VIBE_UPSTREAM_AGENT',str(upstream))
    with pytest.raises(SourceUnavailable):asyncio.run(fetch_bars(BarsRequest(**BASE)))
