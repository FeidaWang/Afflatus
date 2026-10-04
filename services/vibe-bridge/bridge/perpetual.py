"""Local strict historical adapter. A spot series is never a risk snapshot."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal

from .ledger import decimal, signal_weights
from .models import INSTRUMENTS
from .quant import clean, number, require
from .quant_models import NotRunnable

PERPETUALS = {f'CRYPTO:BINANCE:{coin}-USDT:PERP': f'{coin}/USDT:USDT' for coin in ['BTC', 'ETH', 'SOL']}


def run_strict(request, dataset):
    import pandas as pd
    from backtest.engines.crypto import CryptoEngine
    from backtest.perpetual_risk import MaintenanceSchedule
    from backtest.perpetual_evidence import build_perpetual_summary

    parameters = request.parameters
    required = ['perpetual_id', 'initial_capital', 'leverage', 'maker_bps', 'taker_bps', 'slippage_bps', 'liquidation_bps', 'margin_mode', 'strategy', 'fast', 'slow']
    require(parameters, required)
    identifier = parameters['perpetual_id']
    underlying = INSTRUMENTS[request.instrument_id]
    if identifier not in PERPETUALS or underlying['venue'] != 'BINANCE' or identifier != request.instrument_id.removesuffix(':SPOT') + ':PERP':
        raise ValueError('explicit corresponding perpetual instrument required')
    if not isinstance(dataset, dict) or set(dataset) != {'instrument_id', 'source', 'interval', 'observed_at', 'contract_specifications', 'rows'} or dataset['instrument_id'] != identifier or dataset['source'] != 'binance_usdm_historical' or dataset['interval'] != '8H':
        raise ValueError('historical risk snapshot identity mismatch')
    if dataset['contract_specifications'] != {'linear': True, 'contract_size': 1, 'settlement_currency': 'USDT', 'base_asset': underlying['symbol'].split('-')[0]}:
        raise ValueError('unsupported historical contract specification')
    observed = pd.Timestamp(dataset['observed_at'])
    if observed.tzinfo is None or observed > pd.Timestamp.now(tz='UTC'):
        raise ValueError('invalid observation timestamp')
    rows = dataset['rows']
    if not isinstance(rows, list) or not 2 <= len(rows) <= 400:
        raise ValueError('historical risk row limit')
    fields = {'timestamp', 'open', 'high', 'low', 'close', 'volume', 'execution_open', 'mark_open', 'mark_high', 'mark_low', 'mark_close', 'funding_rate', 'funding_settlement_time', 'maintenance_brackets', 'maintenance_bracket_version', 'maintenance_valid_from'}
    symbol, records, previous = PERPETUALS[identifier], [], None
    for row in rows:
        if not isinstance(row, dict) or set(row) != fields:
            raise NotRunnable('PERPETUAL_DATA_REQUIRED', sorted(fields - set(row)))
        timestamp = pd.Timestamp(row['timestamp'])
        valid_from = pd.Timestamp(row['maintenance_valid_from'])
        settlement = pd.Timestamp(row['funding_settlement_time'])
        if timestamp.tzinfo is not None:
            timestamp = timestamp.tz_convert('UTC')
        if timestamp.tzinfo is None or valid_from.tzinfo is None or settlement != timestamp or timestamp.hour not in (0, 8, 16) or timestamp.minute or timestamp.second or timestamp.microsecond or timestamp + pd.Timedelta(hours=8) > observed or valid_from > timestamp or (previous is not None and timestamp - previous != pd.Timedelta(hours=8)):
            raise ValueError('incomplete risk history or future margin schedule')
        for key in ['open', 'high', 'low', 'close', 'execution_open', 'mark_open', 'mark_high', 'mark_low', 'mark_close']:
            number(row[key], .00000001, 1e9)
        number(row['volume'], 0, 1e15); number(row['funding_rate'], -.1, .1)
        if not row['low'] <= min(row['open'], row['close']) <= max(row['open'], row['close']) <= row['high'] or not row['mark_low'] <= min(row['mark_open'], row['mark_close']) <= max(row['mark_open'], row['mark_close']) <= row['mark_high']:
            raise ValueError('invalid price range')
        brackets = row['maintenance_brackets']
        if not isinstance(brackets, list) or not 1 <= len(brackets) <= 20:
            raise ValueError('margin tier limit')
        serialized = json.dumps(brackets, sort_keys=True, separators=(',', ':'), allow_nan=False)
        version = hashlib.sha256(serialized.encode()).hexdigest()
        if row['maintenance_bracket_version'] != version:
            raise ValueError('maintenance content hash mismatch')
        MaintenanceSchedule.from_loader_columns(symbol, serialized, version)
        records.append({**row, 'timestamp': timestamp, 'maintenance_brackets': serialized, 'funding_settlement_time': settlement})
        previous = timestamp
    capital, leverage = decimal(parameters['initial_capital']), decimal(parameters['leverage'])
    if not 1 <= capital <= Decimal('100000000') or not 1 <= leverage <= 20 or parameters['margin_mode'] not in ('isolated', 'cross'):
        raise ValueError('risk/capital limit')
    rates = {}
    for field in ['maker_bps', 'taker_bps', 'slippage_bps', 'liquidation_bps']:
        rate = decimal(parameters[field]) / 10000
        if not 0 <= rate <= Decimal('.05'):
            raise ValueError('invalid fee assumption')
        rates[field] = float(rate)
    fast, slow = parameters['fast'], parameters['slow']
    if type(fast) is not int or type(slow) is not int or not 2 <= fast < slow <= 200 or len(rows) <= slow+1:
        raise ValueError('invalid strategy warmup')
    targets = signal_weights(rows, parameters['strategy'], fast, slow)
    config = dict(initial_cash=float(capital), leverage=float(leverage), maker_rate=rates['maker_bps'], taker_rate=rates['taker_bps'], slippage=rates['slippage_bps'], liquidation_fee_rate=rates['liquidation_bps'], margin_mode=parameters['margin_mode'], perpetual_strict=True, funding_mode='data', interval='8H', market_risk_source='binance_usdm_historical')
    engine = CryptoEngine(config)
    engine._run_interval = '8H'
    frame = pd.DataFrame(records, index=pd.DatetimeIndex([row['timestamp'] for row in records]))
    # Exclude warmup bars from both trades and evaluated performance.
    frame = frame.iloc[slow:]
    weights = pd.DataFrame({symbol: [float(value) for value in targets[slow:]]}, index=frame.index)
    engine._execute_bars(frame.index, {symbol: frame}, pd.DataFrame(index=frame.index), weights, [symbol])
    events = clean(engine._perpetual_events)
    summary = build_perpetual_summary(config=config, events=engine._perpetual_events, trades=engine.trades, terminal_status=engine.terminal_status, maintenance_bracket_versions=engine._maintenance_bracket_versions, market_risk_sources=sorted(engine._market_risk_sources))
    return {'instrument': identifier, 'snapshot_hash': hashlib.sha256(json.dumps(dataset, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest(), 'events': events, 'summary': clean(summary), 'fills': clean(engine.fill_records), 'equity': clean(engine.equity_snapshots), 'assumptions': parameters, 'precision': 'pinned upstream floating-point research simulation; not an exact asset ledger', 'fidelity': '8-hour mark extrema; intrabar liquidation order is not reconstructable', 'live_execution': False}
