"""Exact cash/asset ledger. Long only, unlevered; never a perpetual engine."""
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_EVEN, localcontext

from .quant_models import NotRunnable

MONEY = Decimal('0.00000001')


def fixed(value):
    """Canonical fixed-point transport, including Decimal's scientific zero."""
    return format(value, 'f')


def decimal(value):
    if isinstance(value, bool) or not isinstance(value, str) or len(value) > 30:
        raise ValueError('decimal strings required')
    import re
    if not re.fullmatch(r'-?\d{1,16}(?:\.\d{1,8})?', value):
        raise ValueError('invalid decimal')
    return Decimal(value)


def signal_weights(bars, strategy, fast, slow):
    """t close determines the t+1 open order; the current bar is never read."""
    closes = [Decimal(str(bar['close'])) for bar in bars]
    result = []
    for i in range(len(bars)):
        if i < slow:
            result.append(False)
        elif strategy == 'buy_hold':
            result.append(True)
        elif strategy == 'sma_cross':
            result.append(sum(closes[i-fast:i]) / fast > sum(closes[i-slow:i]) / slow)
        else:
            raise ValueError('unknown strategy')
    return result


def run_ledger(series, parameters):
    required = ['strategy', 'initial_capital', 'commission_bps', 'slippage_bps', 'participation', 'fast', 'slow']
    missing = [key for key in required if key not in parameters]
    if missing:
        raise NotRunnable('INPUT_REQUIRED', missing)
    capital = decimal(parameters['initial_capital'])
    commission = decimal(parameters['commission_bps']) / 10000
    slippage = decimal(parameters['slippage_bps']) / 10000
    participation = decimal(parameters['participation'])
    fast, slow = parameters['fast'], parameters['slow']
    if not (Decimal('1') <= capital <= Decimal('100000000') and 0 <= commission <= Decimal('.05') and 0 <= slippage <= Decimal('.05') and 0 < participation <= Decimal('.1')):
        raise ValueError('invalid cost or capital assumptions')
    if type(fast) is not int or type(slow) is not int or not 2 <= fast < slow <= 200:
        raise ValueError('invalid warmup')
    bars, item, provenance = series['bars'], series['instrument'], series['provenance']
    if len(bars) <= slow + 1:
        raise NotRunnable('INSUFFICIENT_HISTORY')
    # A quantity-based volume cap needs a declared volume unit, never a guess.
    expected_unit = 'base_asset' if item['market'] == 'crypto_spot' else 'shares'
    if provenance.get('volume_unit') not in (expected_unit, 'base' if expected_unit == 'base_asset' else 'shares') or any(bar['volume'] is None for bar in bars):
        raise NotRunnable('VOLUME_UNIT_REQUIRED')
    policy = None
    if item['market'] != 'crypto_spot':
        from backtest.engines.global_equity import GlobalEquityEngine
        policy = GlobalEquityEngine({'initial_cash': float(capital), 'leverage': 1.0}, market='us')
    quantum = Decimal('.00000001') if policy is None else Decimal('.01')
    targets = signal_weights(bars, parameters['strategy'], fast, slow)

    def execute(weights):
        cash, quantity, fees = capital, Decimal(0), Decimal(0)
        fills, snapshots = [], []
        for i in range(slow, len(bars)):
            bar = bars[i]
            mark, opening = Decimal(str(bar['close'])).quantize(MONEY, rounding=ROUND_HALF_EVEN), Decimal(str(bar['open']))
            direction = 1 if weights[i] else -1
            if policy is not None:
                import pandas as pd
                if not policy.can_execute(item['symbol'], direction, pd.Series(bar)):
                    raise NotRunnable('EXECUTION_REJECTED')
            price = (opening * (1 + direction * slippage)).quantize(MONEY, rounding=ROUND_HALF_EVEN)
            limit = (Decimal(str(bars[i-1]['volume'])) * participation).quantize(quantum, rounding=ROUND_DOWN)
            size = Decimal(0)
            if weights[i] and quantity == 0:
                affordable = (cash / (price * (1 + commission))).quantize(quantum, rounding=ROUND_DOWN)
                size = min(affordable, limit)
            elif not weights[i] and quantity > 0:
                size = min(quantity, limit)
            if size > 0:
                notional = (size * price).quantize(MONEY, rounding=ROUND_HALF_EVEN)
                fee = (notional * commission).quantize(MONEY, rounding=ROUND_HALF_EVEN)
                # Rounding must never create a loan for an otherwise affordable order.
                if direction > 0 and notional + fee > cash:
                    size = max(Decimal(0), size - quantum)
                    notional = (size * price).quantize(MONEY, rounding=ROUND_HALF_EVEN)
                    fee = (notional * commission).quantize(MONEY, rounding=ROUND_HALF_EVEN)
                if size > 0:
                    cash = (cash - direction * notional - fee).quantize(MONEY)
                    quantity += direction * size
                    fees += fee
                    fills.append({'date': bar['date'], 'signal_date': bars[i-1]['date'], 'side': 'buy' if direction > 0 else 'sell', 'quantity': fixed(size), 'price': fixed(price), 'notional': fixed(notional), 'fee': fixed(fee), 'cash_after': fixed(cash), 'quantity_after': fixed(quantity)})
            equity = (cash + quantity * mark).quantize(MONEY)
            if cash < 0 or quantity < 0:
                raise ArithmeticError('ledger invariant')
            snapshots.append({'date': bar['date'], 'close': fixed(mark), 'cash': fixed(cash), 'quantity': fixed(quantity), 'equity': fixed(equity)})
        peak, drawdown = capital, Decimal(0)
        for row in snapshots:
            value = Decimal(row['equity']); peak = max(peak, value)
            drawdown = max(drawdown, (peak - value) / peak)
        return {'fills': fills, 'equity': snapshots, 'fees': fixed(fees), 'final_equity': snapshots[-1]['equity'], 'total_return': float(Decimal(snapshots[-1]['equity']) / capital - 1), 'max_drawdown': float(drawdown)}

    with localcontext() as context:
        context.prec = 40
        actual = execute(targets)
        benchmark = execute([i >= slow for i in range(len(bars))])
    actual.update({'benchmark': {key: benchmark[key] for key in ['fees', 'final_equity', 'total_return', 'max_drawdown']}, 'currency': item['quote_currency'], 'assumptions': parameters, 'execution': 'previous_close_signal_next_open', 'engine': 'GlobalEquityEngine(us) / exact cash ledger' if policy else 'independent spot cash/asset ledger', 'warmup_bars': slow, 'ledger_precision': '8 decimal places, half even', 'shorting': False, 'leverage': '1', 'funding': False, 'liquidation': False, 'dividends_included': False, 'ending_position': 'marked, not liquidated', 'liquidity_proxy': 'previous_session_volume; single entry, partial exits'})
    return actual
