"""Pinned pure mathematics and fixed public-data research adapters."""
from __future__ import annotations

import dataclasses
from collections.abc import Mapping
import hashlib
import json
import math
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum

from .models import BarsRequest, INSTRUMENTS
from .quant_models import CONTRACT, NotRunnable, QuantRequest

STRATEGIES = [
    {'id': 'buy_hold', 'signal': 'long after declared warmup', 'execution': 'next open', 'shorting': False},
    {'id': 'sma_cross', 'signal': 'prior close fast SMA > slow SMA', 'execution': 'next open', 'shorting': False},
]


def clean(value):
    """Dataclasses/NumPy to JSON; undefined metrics remain null, never zero."""
    if dataclasses.is_dataclass(value):
        return {field.name: clean(getattr(value, field.name)) for field in dataclasses.fields(value)}
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if hasattr(value, 'tolist'):
        return clean(value.tolist())
    if hasattr(value, 'item'):
        return clean(value.item())
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    raise ValueError('non-JSON output')


def require(values, fields):
    missing = [field for field in fields if values.get(field) is None]
    if missing:
        raise NotRunnable('INPUT_REQUIRED', missing)


def number(value, minimum=-1e15, maximum=1e15):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError('invalid numeric assumption')
    return value


def shape_dataclass(cls, values):
    if not isinstance(values, dict) or set(values) - {field.name for field in dataclasses.fields(cls)}:
        raise ValueError('invalid model fields')
    return cls(**values)


def load_series(request, instrument=None):
    from .worker import load_bars
    identifier = instrument or request.instrument_id
    bars_request = BarsRequest(instrument_id=identifier, start_date=request.start_date, end_date=request.end_date)
    series = load_bars(bars_request, INSTRUMENTS[identifier])
    return snapshot(series)


def snapshot(series):
    series = {**series, 'provenance': dict(series['provenance'])}
    item = series['instrument']
    # This mapping is deliberately limited to the two inspected SPOT loaders.
    if item['market'] == 'crypto_spot' and item['source'] in ('okx', 'binance'):
        series['provenance'].update(volume_unit='base_asset', volume_unit_basis='pinned_loader_field_and_venue_documentation',
            volume_unit_source_url='https://www.okx.com/docs-v5/en/#rest-api-market-data-get-candlesticks-history' if item['source'] == 'okx' else 'https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klinecandlestick-data')
    series['provenance']['bars_sha256'] = hashlib.sha256(json.dumps(series['bars'], sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    return series


def factor_modules():
    from src.factors.zoo.academic import strev, illiq
    return {'academic_strev': strev, 'academic_illiq': illiq}


def execute(request: QuantRequest, *, local=False, series_loader=load_series, perpetual_snapshot=None):
    spec = CONTRACT['modules'][request.module]
    result = {'schema_version': 1, 'module': request.module, 'instrument_id': request.instrument_id,
              'status': 'available', 'reason': None, 'missing': [], 'data': {}, 'provenance': [],
              'observed_at': datetime.now(timezone.utc).isoformat(), 'upstream_commit': CONTRACT['commit'],
              'request_hash': hashlib.sha256(request.model_dump_json().encode()).hexdigest(), 'notes': []}
    if spec['local_only'] and not local:
        result.update(status='unavailable', reason='OWNER_REQUIRED')
        return result
    parameters = request.parameters
    try:
        if request.module == 'backtest':
            from .ledger import run_ledger
            series = series_loader(request)
            result['data'] = run_ledger(series, parameters)
            result['provenance'] = [series['provenance']]
            result['notes'] = ['long_only', 'no_borrowing', 'dividends_excluded', 'volume_is_prior_session_proxy', 'price_adjustment_as_declared_by_source']
        elif request.module == 'options_chain':
            result['data'] = options_chain(request)
            result['notes'] = ['provider_snapshot_not_executable_quote', 'no_theoretical_quote_substitution']
        elif request.module == 'option_model':
            result['data'] = option_model(parameters)
            result['notes'] = ['european_model', 'american_exercise_not_modelled', 'caller_assumptions_not_market_quotes']
        elif request.module == 'option_payoff':
            result['data'] = option_payoff(parameters)
            result['notes'] = ['expiry_only', 'caller_premiums_not_market_quotes', 'american_assignment_not_modelled']
        elif request.module in ('dcf', 'comps', 'three_statement'):
            result['data'] = valuation(request.module, parameters)
            result['notes'] = ['caller_assumptions', 'not_filed_financial_statements']
        elif request.module == 'factors':
            result['data'], result['provenance'] = factors(request, series_loader)
            result['notes'] = ['deployed_six_stock_cohort_not_full_market', 'purged_chronological_split', 'costs_are_explicit_assumptions']
        elif request.module == 'portfolio':
            result['data'], result['provenance'] = portfolio(request, series_loader)
            result['notes'] = ['fixed_weight_daily_rebalanced_research', 'costs_and_dividends_excluded', 'no_fx_conversion']
        elif request.module == 'catalogue':
            eligible = []
            if INSTRUMENTS[request.instrument_id]['market'] == 'us_equity':
                eligible = [clean(module.__alpha_meta__) for module in factor_modules().values()]
            result['data'] = {'strategies': STRATEGIES, 'factors': eligible, 'evidence_policy': 'request hash + source snapshot + complete ledger; ephemeral, no persistent personal strategy store'}
        elif request.module == 'perpetual':
            if not local or perpetual_snapshot is None:
                raise NotRunnable('PERPETUAL_DATA_REQUIRED', ['historical_funding', 'historical_mark_price', 'historical_margin_tiers', 'perpetual_id'])
            from .perpetual import run_strict
            result['data'] = run_strict(request, perpetual_snapshot)
            result['notes'] = ['strict_snapshot_only', 'no_live_orders', 'upstream_float_simulation_not_asset_ledger', 'intrabar_sequence_unknown']
        else:
            from .quant_local import calculate_local
            result['data'] = calculate_local(request.module, parameters)
        result['data'] = clean(result['data'])
        if set(result['data']) - set(spec['output_keys']):
            raise ValueError('unexpected output fields')
    except NotRunnable as exc:
        result.update(status='unavailable', reason=exc.reason, missing=exc.missing, data={}, provenance=[])
    except (ValueError, TypeError, KeyError, ArithmeticError):
        result.update(status='unavailable', reason='INPUT_INVALID', missing=[], data={}, provenance=[])
    return result


def options_chain(request):
    from .research import checked_tool
    from src.tools.options_chain_tool import OptionsChainTool
    arguments = {'ticker': INSTRUMENTS[request.instrument_id]['upstream_symbol']}
    if 'expiration' in request.parameters:
        expiration = request.parameters['expiration']
        if type(expiration) is not int or not 1 <= expiration <= 4102444800:
            raise ValueError('expiration epoch required')
        arguments['expiration'] = expiration
    data = checked_tool(OptionsChainTool(), 'yahoo', 'us', **arguments)['data']
    if data.get('ticker') != arguments['ticker'] or data.get('expiration') not in data.get('expirations', []):
        raise ValueError('option identity mismatch')
    fields = ['contract_symbol', 'strike', 'last_price', 'bid', 'ask', 'volume', 'open_interest', 'implied_volatility', 'in_the_money', 'expiration']
    sides = {}
    for side in ('calls', 'puts'):
        rows = data.get(side)
        if not isinstance(rows, list) or len(rows) > 60:
            raise ValueError('invalid chain')
        sides[side] = []
        for row in rows:
            if not isinstance(row.get('contract_symbol'), str) or not row['contract_symbol'].startswith(INSTRUMENTS[request.instrument_id]['symbol']) or row.get('expiration') != data['expiration']:
                raise ValueError('option contract mismatch')
            for key in ['strike', 'last_price', 'bid', 'ask', 'volume', 'open_interest', 'implied_volatility']:
                if row.get(key) is not None:
                    number(row[key], 0)
            sides[side].append({key: row.get(key) for key in fields})
    if not any(sides.values()):
        raise NotRunnable('NO_DATA')
    return {'expiration': data['expiration'], 'expirations': data['expirations'][:100], **sides,
            'source': 'yahoo', 'source_url': 'https://finance.yahoo.com/', 'quote_as_of': None,
            'truncated': 'upstream caps each side at 60; completeness unknown', 'theoretical_model': False}


def option_model(parameters):
    from src.quantlib.options import bs_price, bs_greeks
    fields = ['spot', 'strike', 'years', 'rate', 'volatility', 'dividend_yield', 'right']
    require(parameters, fields)
    for field in ['spot', 'strike']:
        number(parameters[field], 0.000001, 1e9)
    number(parameters['years'], 0, 30); number(parameters['rate'], -.5, 1)
    number(parameters['volatility'], 0, 5); number(parameters['dividend_yield'], 0, 1)
    if parameters['right'] not in ('call', 'put'):
        raise ValueError('invalid option right')
    args = [parameters[key] for key in ['spot', 'strike', 'years', 'rate', 'volatility', 'right', 'dividend_yield']]
    return {'price': bs_price(*args), 'greeks': bs_greeks(*args), 'assumptions': parameters, 'exercise_style': 'European', 'quote_source': None}


def option_payoff(parameters):
    import numpy as np
    from backtest.options_payoff import OptionLeg, expiry_payoff
    require(parameters, ['legs', 'spots', 'entry_spot', 'years', 'rate', 'volatility', 'multiplier', 'commission_rate'])
    if not isinstance(parameters['legs'], list) or not 1 <= len(parameters['legs']) <= 8:
        raise ValueError('leg limit')
    legs = []
    for row in parameters['legs']:
        if set(row) != {'option_type', 'strike', 'qty', 'premium'} or type(row['qty']) is not int or not 0 < abs(row['qty']) <= 100:
            raise ValueError('invalid leg')
        number(row['strike'], 0.000001, 1e9); number(row['premium'], 0, 1e9)
        legs.append(OptionLeg(**row))
    spots = parameters['spots']
    if not isinstance(spots, list) or not 2 <= len(spots) <= 400 or spots != sorted(set(spots)):
        raise ValueError('invalid spot grid')
    for spot in spots:
        number(spot, 0, 1e9)
    number(parameters['entry_spot'], .000001, 1e9); number(parameters['years'], 0, 30)
    number(parameters['rate'], -.5, 1); number(parameters['volatility'], 0, 5)
    number(parameters['multiplier'], .000001, 10000); number(parameters['commission_rate'], 0, .05)
    report = expiry_payoff(legs, np.array(spots), entry_spot=parameters['entry_spot'], time_to_expiry=parameters['years'], rate=parameters['rate'], iv=parameters['volatility'], multiplier=parameters['multiplier'], commission_rate=parameters['commission_rate'])
    return {**clean(report), 'premium_source': 'caller_supplied'}


def valuation(module, parameters):
    from src.quantlib.valuation.contracts import Assumption, MissingInputError
    try:
        if module == 'dcf':
            from src.quantlib.valuation.dcf import run_dcf, DCF_BASE_REQUIRED_FIELDS, DCF_CURRENT_STRUCTURE_FIELDS, DCF_TARGET_STRUCTURE_FIELDS
            require(parameters, ['inputs', 'capital_structure_basis', 'discounting_convention', 'terminal_value_method', 'gdp_growth_ceiling'])
            inputs = dict(parameters['inputs'])
            if parameters['capital_structure_basis'] not in ('current', 'target'):
                raise ValueError('invalid capital structure')
            structure = DCF_CURRENT_STRUCTURE_FIELDS if parameters['capital_structure_basis'] == 'current' else DCF_TARGET_STRUCTURE_FIELDS
            allowed = set(DCF_BASE_REQUIRED_FIELDS + structure) | {'size_premium', 'country_risk_premium'}
            if set(inputs) - allowed:
                raise ValueError('unknown DCF input')
            require(inputs, sorted(allowed))
            for name in ['terminal_growth', 'exit_multiple']:
                raw = inputs[name]
                if not isinstance(raw, dict) or set(raw) - {'name', 'value', 'basis', 'source'} or raw.get('name') != name:
                    raise ValueError('named assumption required')
                number(raw.get('value'))
                if not isinstance(raw.get('basis'), str) or len(raw['basis'].strip()) < 3:
                    raise ValueError('assumption basis required')
                inputs[name] = Assumption(**raw)
            for key in ['ebit', 'depreciation_amortization', 'capex', 'delta_nwc']:
                if not isinstance(inputs[key], list) or not 1 <= len(inputs[key]) <= 20:
                    raise ValueError('projection period limit')
                for value in inputs[key]: number(value)
            for key in allowed - {'ebit', 'depreciation_amortization', 'capex', 'delta_nwc', 'terminal_growth', 'exit_multiple'}:
                number(inputs[key])
            number(parameters['gdp_growth_ceiling'], -1, 1)
            model = run_dcf(inputs, **{key: parameters[key] for key in ['capital_structure_basis', 'discounting_convention', 'terminal_value_method', 'gdp_growth_ceiling']})
        elif module == 'three_statement':
            from src.quantlib.valuation.threestatement import project_three_statement, OPENING_REQUIRED_FIELDS, DRIVER_REQUIRED_FIELDS
            require(parameters, ['opening', 'drivers', 'assumption_basis'])
            opening, drivers = parameters['opening'], parameters['drivers']
            require(opening, OPENING_REQUIRED_FIELDS); require(drivers, DRIVER_REQUIRED_FIELDS)
            if set(opening) != set(OPENING_REQUIRED_FIELDS) or set(drivers) != set(DRIVER_REQUIRED_FIELDS) or not isinstance(parameters['assumption_basis'], str) or len(parameters['assumption_basis'].strip()) < 3:
                raise ValueError('invalid projection assumptions')
            for value in opening.values(): number(value)
            for values in drivers.values():
                if not isinstance(values, list) or not 1 <= len(values) <= 20:
                    raise ValueError('projection period limit')
                for value in values: number(value)
            model = project_three_statement(opening, drivers)
        else:
            from src.quantlib.valuation.comps import FlowMetricPeriods, PeerCompany, TargetCompany, run_comps
            require(parameters, ['target', 'peers', 'calendarisation_policy'])
            if not isinstance(parameters['peers'], list) or not 2 <= len(parameters['peers']) <= 20:
                raise ValueError('peer count')
            def company(cls, value):
                value = dict(value)
                for key in ['ebitda', 'ebit', 'revenue', 'diluted_eps']:
                    for name, metric in value[key].items():
                        if metric is not None: number(metric)
                    value[key] = shape_dataclass(FlowMetricPeriods, value[key])
                for key, number_value in value.items():
                    if key not in ('name', 'eps_basis', 'ebitda', 'ebit', 'revenue', 'diluted_eps') and number_value is not None: number(number_value)
                return shape_dataclass(cls, value)
            model = run_comps(company(TargetCompany, parameters['target']), [company(PeerCompany, peer) for peer in parameters['peers']], calendarisation_policy=parameters['calendarisation_policy'])
        return {'model': clean(model), 'assumptions': parameters}
    except MissingInputError as exc:
        raise NotRunnable('INPUT_REQUIRED', exc.missing) from exc


def factors(request, loader):
    import numpy as np
    import pandas as pd
    from src.factors.factor_analysis_core import compute_ic_series, compute_group_equity
    from .ledger import decimal
    parameters = request.parameters
    require(parameters, ['factor', 'commission_bps', 'slippage_bps'])
    selected = factor_modules().get(parameters['factor'])
    if selected is None or 'equity_us' not in selected.__alpha_meta__['universe']:
        raise NotRunnable('FACTOR_UNIVERSE_UNSUPPORTED')
    commission, slippage = decimal(parameters['commission_bps']) / 10000, decimal(parameters['slippage_bps']) / 10000
    if not 0 <= commission <= Decimal('.05') or not 0 <= slippage <= Decimal('.05'):
        raise ValueError('invalid factor costs')
    cost = commission + slippage
    universe = [key for key, item in INSTRUMENTS.items() if item['market'] == 'us_equity']
    series = {key: loader(request, key) for key in universe}
    def panel(field):
        return pd.DataFrame({key: pd.Series({bar['date']: bar[field] for bar in value['bars']}) for key, value in series.items()}).sort_index()
    prices, opens, volumes = panel('close'), panel('open'), panel('volume')
    if 'volume' in selected.__alpha_meta__['columns_required'] and any(value['provenance']['volume_unit'] != 'shares' for value in series.values()):
        raise NotRunnable('VOLUME_UNIT_REQUIRED')
    values = selected.compute({'close': prices, 'volume': volumes}).shift(1)
    returns = opens.shift(-1).div(opens).sub(1)
    ic = compute_ic_series(values, returns)
    gross = compute_group_equity(values, returns, 3)
    if len(ic) < 20 or gross.empty:
        raise NotRunnable('INSUFFICIENT_HISTORY')
    valid_dates = gross.index
    net = {}
    for group in range(3):
        previous = pd.Series(0., index=universe); nav = 1.; rows = []
        for day in valid_dates:
            shared = values.loc[day].dropna().index.intersection(returns.loc[day].dropna().index)
            bins = pd.qcut(values.loc[day, shared].rank(method='first'), 3, labels=False)
            members = bins[bins == group].index
            weights = pd.Series(0., index=universe); weights.loc[members] = 1 / len(members)
            turnover = float((weights - previous).abs().sum())
            ret = float(returns.loc[day, members].mean())
            nav *= (1 - turnover * float(cost)) * (1 + ret)
            rows.append({'date': day, 'gross_nav': float(gross.loc[day, f'Group_{group+1}']), 'net_nav': nav, 'turnover': turnover})
            # Holdings drift with constituent returns between rebalances.
            # Charging only target-weight changes understates turnover even
            # when the same two stocks remain in an equal-weight layer.
            previous = weights.mul(1 + returns.loc[day].fillna(0)).div(1 + ret)
        net[f'Group_{group+1}'] = rows
    split = max(2, int(len(ic) * .7))
    def summary(part):
        mean, std = float(part.mean()), float(part.std(ddof=1))
        return {'start': part.index[0], 'end': part.index[-1], 'samples': len(part), 'ic_mean': mean, 'ic_std': std, 'ir': mean / std if std > 0 else None}
    mean, std = float(ic.mean()), float(ic.std(ddof=1))
    return {'factor': parameters['factor'], 'metadata': clean(selected.__alpha_meta__), 'universe': universe, 'ic': [{'date': day, 'value': float(value)} for day, value in ic.items()], 'ic_mean': mean, 'ic_std': std, 'ir': mean / std if std > 0 else None, 'groups': net, 'costs': parameters, 'training': summary(ic.iloc[:split-1]), 'validation': summary(ic.iloc[split:]), 'timing': 'previous close factor; current open to next open label; one date purged between train and validation'}, [value['provenance'] for value in series.values()]


def portfolio(request, loader):
    import pandas as pd
    from src.quantlib.risk import historical_var, historical_cvar, max_drawdown_analysis
    from src.quantlib.attribution import brinson_fachler, carino_link
    from .ledger import decimal
    parameters = request.parameters
    require(parameters, ['instruments', 'weights'])
    identifiers, weights = parameters['instruments'], parameters['weights']
    if not isinstance(identifiers, list) or not 2 <= len(identifiers) <= 8 or len(set(identifiers)) != len(identifiers) or request.instrument_id not in identifiers or any(key not in INSTRUMENTS for key in identifiers) or not isinstance(weights, list) or len(weights) != len(identifiers):
        raise ValueError('invalid portfolio')
    weights = [decimal(weight) for weight in weights]
    if sum(weights) != Decimal(1) or any(weight < 0 for weight in weights):
        raise ValueError('weights must sum exactly to one')
    if len({INSTRUMENTS[key]['quote_currency'] for key in identifiers}) != 1:
        raise NotRunnable('CURRENCY_MISMATCH')
    series = [loader(request, key) for key in identifiers]
    if len({value['provenance']['bar_timezone'] for value in series}) != 1 or any([bar['date'] for bar in value['bars']] != [bar['date'] for bar in series[0]['bars']] for value in series):
        raise NotRunnable('CALENDAR_MISMATCH')
    prices = pd.DataFrame({key: [bar['close'] for bar in value['bars']] for key, value in zip(identifiers, series)})
    returns = prices.pct_change(fill_method=None).iloc[1:]
    if len(returns) < 30:
        raise NotRunnable('INSUFFICIENT_HISTORY')
    weighted = returns.mul([float(weight) for weight in weights], axis=1)
    daily = weighted.sum(axis=1); nav = (1 + daily).cumprod()
    attribution = benchmark_return = None
    if 'benchmark_weights' in parameters:
        benchmark_weights = parameters['benchmark_weights']
        if not isinstance(benchmark_weights, list) or len(benchmark_weights) != len(identifiers):
            raise ValueError('benchmark weights required')
        benchmark_weights = [decimal(weight) for weight in benchmark_weights]
        if sum(benchmark_weights) != Decimal(1) or any(weight < 0 for weight in benchmark_weights):
            raise ValueError('benchmark weights must sum to one')
        portfolio_mapping = dict(zip(identifiers, [float(weight) for weight in weights]))
        benchmark_mapping = dict(zip(identifiers, [float(weight) for weight in benchmark_weights]))
        periods = [brinson_fachler(portfolio_mapping, benchmark_mapping, row.to_dict(), row.to_dict()) for _, row in returns.iterrows()]
        attribution = clean(carino_link(periods))
        benchmark_return = float((1 + returns.mul([float(weight) for weight in benchmark_weights], axis=1).sum(axis=1)).prod() - 1)
    return {'instruments': identifiers, 'weights': [str(weight) for weight in weights], 'currency': INSTRUMENTS[identifiers[0]]['quote_currency'], 'dates': [bar['date'] for bar in series[0]['bars']][1:], 'correlation': clean(returns.corr().to_dict()), 'risk': {'historical_var_95_daily': historical_var(daily), 'historical_cvar_95_daily': historical_cvar(daily), 'drawdown': max_drawdown_analysis(pd.concat([pd.Series([1.]), nav], ignore_index=True))}, 'arithmetic_return_contribution': clean(weighted.sum().to_dict()), 'attribution': attribution, 'benchmark_total_return': benchmark_return, 'total_return': float(nav.iloc[-1] - 1), 'calendar_policy': 'identical source day boundary and date grid; no filling', 'source_timezones': [value['provenance']['bar_timezone'] for value in series]}, [value['provenance'] for value in series]
