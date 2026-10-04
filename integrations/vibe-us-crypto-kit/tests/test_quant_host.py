"""P3 synthetic/offline acceptance. No fixtures enter production as fallback data."""
import asyncio
from copy import deepcopy
from datetime import date, timedelta
from decimal import Decimal
import json
import os

import pytest
from fastapi.testclient import TestClient

from bridge.models import INSTRUMENTS
from bridge.quant import execute, snapshot
from bridge.quant_models import QuantRequest
from bridge.quant_jobs import QuantJobs
from bridge.ledger import run_ledger, signal_weights

pytestmark = pytest.mark.skipif(not os.getenv('VIBE_TEST_HOST_ROOT') or not os.getenv('VIBE_UPSTREAM_TEST_AGENT'), reason='host and pinned runtime required')


@pytest.fixture(autouse=True)
def pinned(monkeypatch):
    monkeypatch.syspath_prepend(os.environ['VIBE_UPSTREAM_TEST_AGENT'])


PARAMS = dict(strategy='sma_cross', initial_capital='10000', commission_bps='10', slippage_bps='5', participation='0.1', fast=5, slow=21)


def series(identifier='US:AAPL', count=120, offset=0):
    item = INSTRUMENTS[identifier]
    bars = []
    for index in range(count):
        price = 100 + index * .13 + ((index + offset) % 19 - 9) * .4
        bars.append(dict(date=(date(2025, 1, 1) + timedelta(days=index)).isoformat(), open=price, high=price+2, low=price-2, close=price+1, volume=1000000+index*offset))
    return snapshot({'instrument': {key: value for key, value in item.items() if key != 'upstream_symbol'}, 'bars': bars, 'provenance': {'source': item['source'], 'quote_currency': item['quote_currency'], 'volume_unit': 'shares' if item['market'] != 'crypto_spot' else None, 'observed_at': '2025-06-01T00:00:00Z', 'bar_timezone': 'America/New_York' if item['market'] != 'crypto_spot' else 'UTC+08:00' if item['venue']=='OKX' else 'UTC', 'fallback_used': False}})


def request(module='backtest', identifier='US:AAPL', parameters=None):
    fields = dict(instrument_id=identifier, module=module, parameters=parameters or {})
    if module in ('backtest', 'factors', 'portfolio'):
        fields.update(start_date='2025-01-01', end_date='2025-06-01')
    return QuantRequest(**fields)


@pytest.mark.parametrize('patch', [{'module': 'shell'}, {'instrument_id': 'HK:0700'}, {'owner': 'invented-user'}, {'parameters': {'command': 'whoami'}}, {'parameters': {'strategy': {'x': float('inf')}}}, {'start_date':'2023-01-01'}, {'end_date':'2099-01-01'}])
def test_input_scope_and_size(patch):
    with pytest.raises(ValueError):
        QuantRequest.model_validate(request().model_dump() | patch)


def test_exact_ledger_reconciles_every_fill_and_mark():
    value = series(); result = run_ledger(value, PARAMS)
    cash, quantity, fees = Decimal('10000'), Decimal(0), Decimal(0)
    fills = {row['date']: row for row in result['fills']}
    assert fills
    for row in result['equity']:
        if row['date'] in fills:
            fill = fills[row['date']]; side = 1 if fill['side']=='buy' else -1
            cash -= side * Decimal(fill['notional']) + Decimal(fill['fee'])
            quantity += side * Decimal(fill['quantity']); fees += Decimal(fill['fee'])
            assert fill['signal_date'] < fill['date']
        assert Decimal(row['cash']) == cash >= 0
        assert Decimal(row['quantity']) == quantity >= 0
        assert Decimal(row['equity']) == (cash + quantity*Decimal(row['close'])).quantize(Decimal('.00000001'))
    assert Decimal(result['fees']) == fees
    assert result['final_equity'] == result['equity'][-1]['equity']


def test_future_price_and_volume_do_not_change_prior_signals_or_fills():
    original = series(); modified = deepcopy(original)
    for row in modified['bars'][70:]:
        for key in ['open','close','high','low']: row[key] *= 2
        row['volume'] = 1
    assert signal_weights(original['bars'],'sma_cross',5,21)[:71] == signal_weights(modified['bars'],'sma_cross',5,21)[:71]
    assert run_ledger(original,PARAMS)['equity'][:49] == run_ledger(modified,PARAMS)['equity'][:49]
    # Current-session volume is not observable at its open.
    modified=deepcopy(original); modified['bars'][21]['volume']=0
    assert run_ledger(original,PARAMS)['fills'][0] == run_ledger(modified,PARAMS)['fills'][0]


def test_buy_hold_benchmark_same_window_and_costs():
    result=run_ledger(series(),PARAMS | {'strategy':'buy_hold'})
    assert result['total_return'] == result['benchmark']['total_return']
    assert result['fees'] == result['benchmark']['fees']
    assert result['equity'][0]['date'] == series()['bars'][21]['date']


@pytest.mark.parametrize('venue', ['OKX', 'BINANCE'])
def test_spot_is_independent_no_debt_funding_or_liquidation(venue):
    value=series(f'CRYPTO:{venue}:BTC-USDT:SPOT')
    assert value['provenance']['volume_unit'] == 'base_asset'
    result=run_ledger(value,PARAMS)
    assert result['engine']=='independent spot cash/asset ledger'
    assert result['currency']=='USDT' and not result['funding'] and not result['liquidation']
    assert any(row['quantity'] == '0.00000000' for row in result['equity'])
    assert all('E' not in row[key] for row in result['equity'] for key in ('close', 'cash', 'quantity', 'equity'))


def test_missing_volume_unit_and_inputs_fail_closed():
    value=series();value['provenance']['volume_unit']=None
    result=execute(request(parameters=PARAMS),series_loader=lambda _:value)
    assert result['reason']=='VOLUME_UNIT_REQUIRED'
    result=execute(request(),series_loader=lambda _:series())
    assert result['reason']=='INPUT_REQUIRED' and result['data']=={}


def test_small_capital_rounding_cannot_borrow():
    result=run_ledger(series(),PARAMS | {'initial_capital':'1','strategy':'buy_hold'})
    assert all(Decimal(row['cash'])>=0 for row in result['equity'])
    assert all(Decimal(row['quantity'])>=0 for row in result['equity'])


def test_theoretical_option_reference_and_call_put_parity():
    parameters=dict(spot=100,strike=100,years=1,rate=.05,volatility=.2,dividend_yield=0,right='call')
    call=execute(request('option_model',parameters=parameters))
    put=execute(request('option_model',parameters=parameters | {'right':'put'}))
    import math
    assert call['data']['price']==pytest.approx(10.450583572185565)
    assert call['data']['price']-put['data']['price']==pytest.approx(100-100*math.exp(-.05))
    assert call['data']['quote_source'] is None


def test_payoff_contract_multiplier_and_explicit_premiums():
    parameters=dict(legs=[dict(option_type='call',strike=100,qty=1,premium=5)],spots=[0,100,110],entry_spot=100,years=1,rate=.05,volatility=.2,multiplier=100,commission_rate=0)
    result=execute(request('option_payoff',parameters=parameters))
    assert result['data']['payoff']==[-500,-500,500]
    assert result['data']['max_profit'] is None and result['data']['profit_unbounded']
    del parameters['legs'][0]['premium']
    assert execute(request('option_payoff',parameters=parameters))['reason']=='INPUT_INVALID'


def test_dcf_refuses_missing_justifications_and_accepts_worked_model():
    inputs=dict(risk_free_rate=.04,beta=1.2,equity_risk_premium=.05,size_premium=.01,country_risk_premium=0,pretax_cost_of_debt=.06,tax_rate=.25,ebit=[100,105,110],depreciation_amortization=[20,21,22],capex=[30,28,26],delta_nwc=[5,4,3],terminal_growth=dict(name='terminal_growth',value=.03,basis='offline worked example'),exit_multiple=dict(name='exit_multiple',value=8,basis='offline worked example'),total_debt=200,cash_and_equivalents=50,minority_interest=10,preferred_equity=15,associate_investments=5,diluted_shares=100,target_equity_weight=.7,target_debt_weight=.3)
    parameters=dict(inputs=inputs,capital_structure_basis='target',discounting_convention='mid_year',terminal_value_method='perpetuity_growth',gdp_growth_ceiling=.04)
    result=execute(request('dcf',parameters=parameters))
    assert result['status']=='available',result
    assert result['data']['model']['value_per_share']==pytest.approx(10.428050212786289)
    del inputs['beta']
    assert execute(request('dcf',parameters=parameters))['reason']=='INPUT_REQUIRED'


def test_three_statement_balances_and_does_not_default_missing_driver():
    opening=dict(revenue=1000,cash=200,net_working_capital=150,ppe=800,revolver_balance=300,paid_in_capital=500,retained_earnings=350)
    drivers=dict(revenue_growth=[.1],gross_margin=[.4],opex_pct_revenue=[.2],capex_pct_revenue=[.05],nwc_pct_revenue=[.15],tax_rate=[.25],dividend_payout_ratio=[.3],depreciation_amortization=[60],interest_rate=[.06],minimum_cash=[264.55])
    parameters=dict(opening=opening,drivers=drivers,assumption_basis='offline example')
    result=execute(request('three_statement',parameters=parameters))
    assert result['status']=='available',result
    balance=result['data']['model']['periods'][0]['balance_sheet']
    assert balance['cash']+balance['net_working_capital']+balance['ppe']==pytest.approx(balance['revolver_balance']+balance['paid_in_capital']+balance['retained_earnings'])
    del drivers['tax_rate']
    assert execute(request('three_statement',parameters=parameters))['reason']=='INPUT_REQUIRED'


def test_portfolio_rejects_currency_and_exchange_day_mixing():
    def loader(req,key): return series(key)
    for identifiers,reason in [(['US:AAPL','CRYPTO:OKX:BTC-USDT:SPOT'],'CURRENCY_MISMATCH'),(['CRYPTO:OKX:BTC-USDT:SPOT','CRYPTO:BINANCE:BTC-USDT:SPOT'],'CALENDAR_MISMATCH')]:
        result=execute(request('portfolio',identifiers[0],dict(instruments=identifiers,weights=['0.5','0.5'])),series_loader=loader)
        assert result['reason']==reason
    result=execute(request('portfolio',parameters=dict(instruments=['US:AAPL','US:MSFT'],weights=['0.5','0.5'])),series_loader=loader)
    assert result['status']=='available',result
    assert result['data']['correlation']['US:AAPL']['US:MSFT']==pytest.approx(1)


def test_factors_filter_universe_and_keep_purged_time_split(monkeypatch):
    def loader(req,key): return series(key,offset=list(INSTRUMENTS).index(key)+1)
    parameters=dict(factor='academic_strev',commission_bps='10',slippage_bps='5')
    result=execute(request('factors',parameters=parameters),series_loader=loader)
    assert result['status']=='available',result
    data=result['data'];assert len(data['universe'])==6
    assert data['training']['end']<data['validation']['start']
    assert all(row['net_nav']<=row['gross_nav']+1e-10 for rows in data['groups'].values() for row in rows)
    assert execute(request('factors',parameters=parameters | {'factor':'gtja191_alpha001'}),series_loader=loader)['reason']=='FACTOR_UNIVERSE_UNSUPPORTED'
    assert execute(request('factors',parameters=parameters | {'commission_bps':'-1'}),series_loader=loader)['reason']=='INPUT_INVALID'
    # A fixed layer still needs rebalancing as its constituent weights drift.
    import pandas as pd
    from bridge.quant import factor_modules
    monkeypatch.setattr(factor_modules()['academic_strev'], 'compute', lambda panels: pd.DataFrame({key: index for index, key in enumerate(panels['close'].columns)}, index=panels['close'].index))
    fixed=execute(request('factors',parameters=parameters),series_loader=loader)['data']
    rows=fixed['groups']['Group_1']; day=rows[0]['date']
    prices=[]
    for identifier in fixed['universe'][:2]:
        bars=loader(None,identifier)['bars'];index=next(i for i,row in enumerate(bars) if row['date']==day)
        prices.append(bars[index+1]['open']/bars[index]['open']-1)
    mean=sum(prices)/2
    expected=sum(abs(.5*(1+ret)/(1+mean)-.5) for ret in prices)
    assert expected>0 and rows[1]['turnover']==pytest.approx(expected)


@pytest.mark.parametrize('module',['cashflows','rigor','audit','decay','reconcile'])
def test_personal_calculators_never_mount_without_owner(module):
    assert execute(request(module))['reason']=='OWNER_REQUIRED'


def test_local_cashflows_rigor_audit_and_decay_are_real_calculations():
    parameters=dict(currency='USD',flow_timing='end',flows=[dict(date='2024-01-01',amount='-100',kind='contribution',currency='USD'),dict(date='2025-01-01',amount='110',kind='nav',currency='USD')],valuations=[dict(date='2024-01-01',value='100'),dict(date='2025-01-01',value='110')])
    result=execute(request('cashflows',parameters=parameters),local=True)
    assert result['status']=='available',result
    assert result['data']['fund_multiples']['tvpi']==pytest.approx(1.1)
    result=execute(request('rigor',parameters=dict(operation='calc',values={'expr':'0.1 + 0.2'})),local=True)
    assert result['status']=='available',result
    assert execute(request('rigor',parameters=dict(operation='calc',values={'expr':'__import__("os").system("whoami")'})),local=True)['reason']=='INPUT_INVALID'
    result=execute(request('audit',parameters=dict(text='Revenue: $10M',seed=42,sample_rate=1,checks=[dict(label='Revenue',reported_value=10,fetched_value=10)])),local=True)
    assert result['data']['verdict']['verdict']=='PASS'
    result=execute(request('decay',parameters=dict(current_status='active',prior_signals=['warning','warning'],ir=.7)),local=True)
    assert result['status']=='available',result
    assert result['data']['evaluation']['signal']=='warning'


def test_perpetual_never_relabels_spot_or_invents_risk_data():
    result=execute(request('perpetual','CRYPTO:OKX:BTC-USDT:SPOT'))
    assert result['reason']=='PERPETUAL_DATA_REQUIRED' and 'historical_funding' in result['missing']


def strict_dataset():
    import hashlib
    brackets=[dict(bracket_tier=1,notional_cap=10000000,maintenance_rate=.004,cumulative_maintenance_amount=0)]
    version=hashlib.sha256(json.dumps(brackets,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    from datetime import datetime,timezone
    start=datetime(2025,1,1,tzinfo=timezone.utc)
    rows=[]
    for index in range(60):
        timestamp=(start+timedelta(hours=index*8)).isoformat(); price=100+index*.2
        rows.append(dict(timestamp=timestamp,open=price,high=price+1,low=price-1,close=price+.5,volume=10000,execution_open=price,mark_open=price,mark_high=price+1,mark_low=price-1,mark_close=price+.5,funding_rate=.0001,funding_settlement_time=timestamp,maintenance_brackets=brackets,maintenance_bracket_version=version,maintenance_valid_from='2024-12-01T00:00:00Z'))
    return dict(instrument_id='CRYPTO:BINANCE:BTC-USDT:PERP',source='binance_usdm_historical',interval='8H',observed_at='2025-02-01T00:00:00Z',contract_specifications=dict(linear=True,contract_size=1,settlement_currency='USDT',base_asset='BTC'),rows=rows)


def test_strict_perpetual_runs_only_full_risk_snapshot_and_emits_funding_evidence():
    parameters=dict(perpetual_id='CRYPTO:BINANCE:BTC-USDT:PERP',initial_capital='10000',leverage='2',maker_bps='2',taker_bps='5',slippage_bps='0',liquidation_bps='5',margin_mode='isolated',strategy='buy_hold',fast=5,slow=21)
    req=request('perpetual','CRYPTO:BINANCE:BTC-USDT:SPOT',parameters)
    result=execute(req,local=True,perpetual_snapshot=strict_dataset())
    assert result['status']=='available',result
    assert result['data']['summary']['funding_mode']=='data'
    assert any(event['event_type']=='funding_settlement' for event in result['data']['events'])
    assert result['data']['live_execution'] is False
    dataset=strict_dataset();dataset['rows'][23]['maintenance_valid_from']='2026-01-01T00:00:00Z'
    assert execute(req,local=True,perpetual_snapshot=dataset)['reason']=='INPUT_INVALID'
    dataset=strict_dataset();del dataset['rows'][23]['mark_low']
    assert execute(req,local=True,perpetual_snapshot=dataset)['reason']=='PERPETUAL_DATA_REQUIRED'
    dataset=strict_dataset();dataset['rows'][23]['maintenance_bracket_version']='invented'
    assert execute(req,local=True,perpetual_snapshot=dataset)['reason']=='INPUT_INVALID'
    dataset=strict_dataset();dataset['rows'][23]['timestamp']='2025-01-08T16:00:00+05:00';dataset['rows'][23]['funding_settlement_time']=dataset['rows'][23]['timestamp']
    assert execute(req,local=True,perpetual_snapshot=dataset)['reason']=='INPUT_INVALID'


def test_local_reconciliation_compares_real_contracts_and_cannot_call_a_connector():
    timestamp='2025-01-01T00:00:00Z'
    position=dict(symbol='BTC-USDT-PERP',quantity=.1,entry_price=60000,leverage=10,accumulated_entry_fee=3,isolated_margin=None)
    risk_position=dict(symbol='BTC-USDT-PERP',mark_price=61000,notional=6100,unrealized_pnl=100,initial_margin=610,maintenance_margin=24.4,margin_balance=None)
    account=dict(wallet_balance=1000,positions=[position],margin_mode='cross',terminal_status='active')
    risk=dict(margin_balance=1100,initial_margin=610,maintenance_margin=24.4,available_balance=490,per_position=[risk_position],status='healthy',liquidation_targets=[],fidelity_flags=[])
    observed=dict(schema_version='binance-usdm-account-snapshot-v1',observed_at=timestamp,source='binance-usdm',source_profile='offline-fixture',configuration_hash='a'*64,data_status='complete',wallet_balance=1000,margin_balance=1100,available_balance=490,total_unrealized_pnl=100,total_initial_margin=610,total_maintenance_margin=24.4,positions=[dict(symbol='BTC-USDT-PERP',quantity=.1,entry_price=60000,leverage=10,margin_mode='cross',isolated_margin=None,unrealized_pnl=100,initial_margin=610,maintenance_margin=24.4)])
    parameters=dict(account=account,risk=risk,observed=observed,expected_timestamp=timestamp,tolerance=dict(absolute=.00000001,relative=.00000001,max_timestamp_skew_seconds=0,version='offline-v1'))
    result=execute(request('reconcile',parameters=parameters),local=True)
    assert result['status']=='available',result
    assert result['data']['reconciliation']['status']=='comparison_complete'
    assert result['data']['reconciliation']['has_drift'] is False
    observed['data_status']='incomplete'
    assert execute(request('reconcile',parameters=parameters),local=True)['reason']=='INPUT_INVALID'


def test_comps_uses_supplied_periods():
    def metric(value):return dict(fiscal_year_end_month=12,last_full_fiscal_year=value,current_year_to_date=value/2,prior_year_to_date=value/2,next_full_fiscal_year=None)
    common=dict(total_debt=100,cash_and_equivalents=50,ebitda=metric(150),ebit=metric(100),revenue=metric(900),diluted_eps=metric(5),book_value_of_equity=500,eps_basis='gaap')
    target=common | dict(name='offline-target',diluted_shares_outstanding=100)
    peers=[common | dict(name='offline-peer-'+str(index),market_cap=1000+index*100,price_per_share=50+index) for index in range(3)]
    result=execute(request('comps',parameters=dict(target=target,peers=peers,calendarisation_policy='ltm')))
    assert result['status']=='available',result
    assert result['data']['model']['distributions']['pe']['median']==pytest.approx(10.2)


def test_portfolio_carino_attribution_reconciles_compounded_active_return():
    def loader(req,key):return series(key,offset=list(INSTRUMENTS).index(key)+1)
    result=execute(request('portfolio',parameters=dict(instruments=['US:AAPL','US:MSFT'],weights=['0.7','0.3'],benchmark_weights=['0.5','0.5'])),series_loader=loader)
    assert result['status']=='available',result
    attribution=result['data']['attribution']
    assert attribution['active_return']==pytest.approx(result['data']['total_return']-result['data']['benchmark_total_return'])


def test_async_queue_limits_cancellation_and_expiry():
    async def scenario():
        barrier=asyncio.Event()
        async def worker(req): await barrier.wait();return execute(req)
        now=[0.];jobs=QuantJobs(asyncio.Semaphore(1),worker,lambda:now[0])
        values=[jobs.submit(request('catalogue')) for _ in range(4)]
        with pytest.raises(Exception) as failure: jobs.submit(request('catalogue'))
        assert failure.value.status_code==429
        await asyncio.sleep(0)
        assert (await jobs.cancel(values[0]['id']))['status']=='cancelled'
        barrier.set();await asyncio.gather(*list(jobs.tasks.values()))
        assert jobs.view(values[1]['id'])['status']=='complete'
        now[0]=601
        with pytest.raises(Exception) as failure:jobs.view(values[1]['id'])
        assert failure.value.status_code==404
        await jobs.close()
    asyncio.run(scenario())


def test_bridge_auth_body_limit_and_local_only_request(monkeypatch):
    import bridge.app as module
    monkeypatch.setenv('VIBE_BRIDGE_TOKEN','offline-token-'+'x'*32)
    headers={'Authorization':'Bearer '+'offline-token-'+'x'*32}
    with TestClient(module.app) as client:
        assert client.post('/v1/quant/jobs',json=request('catalogue').model_dump(mode='json')).status_code==401
        assert client.post('/v1/quant/jobs',json=request('cashflows').model_dump(mode='json'),headers=headers).status_code==403
        assert client.post('/v1/quant/jobs',content=b'x'*32769,headers=headers).status_code==413
        assert client.post('/v1/research',content=b'x'*4097,headers=headers).status_code==413
        assert client.get('/v1/quant/jobs/'+'.'*32,headers=headers).status_code==404
