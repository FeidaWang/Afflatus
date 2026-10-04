"""Local operator calculators. Personal inputs never mount on the shared BFF."""
from __future__ import annotations

import ast
from decimal import Decimal

from .quant import clean, number, require
from .quant_models import NotRunnable
from .ledger import decimal


def calculate_local(module, parameters):
    if module == 'reconcile':
        import pandas as pd
        from .quant import shape_dataclass
        from backtest.binance_account_reconciliation import BinanceAccountSnapshot, BinancePositionSnapshot, ReconciliationTolerance, reconcile_binance_account
        from backtest.perpetual_risk import AccountState, PositionState, RiskSnapshot, PositionRisk
        require(parameters, ['account', 'risk', 'observed', 'expected_timestamp', 'tolerance'])
        def account(value):
            value = dict(value)
            value['observed_at'] = pd.Timestamp(value['observed_at'])
            value['positions'] = tuple(shape_dataclass(BinancePositionSnapshot, position) for position in value['positions'])
            value['fidelity_flags'] = tuple(value.get('fidelity_flags', ()))
            return shape_dataclass(BinanceAccountSnapshot, value)
        state = dict(parameters['account']); state['positions'] = tuple(shape_dataclass(PositionState, position) for position in state['positions'])
        risk = dict(parameters['risk']); risk['per_position'] = tuple(shape_dataclass(PositionRisk, position) for position in risk['per_position'])
        for key in ['liquidation_targets', 'fidelity_flags']: risk[key] = tuple(risk[key])
        report = reconcile_binance_account(shape_dataclass(AccountState, state), shape_dataclass(RiskSnapshot, risk), account(parameters['observed']), expected_timestamp=pd.Timestamp(parameters['expected_timestamp']), tolerance=shape_dataclass(ReconciliationTolerance, parameters['tolerance']))
        return {'reconciliation': clean(report), 'scope': 'local supplied snapshots only; no account connector, persistence or orders'}
    if module == 'cashflows':
        return cashflows(parameters)
    if module == 'rigor':
        return rigor(parameters)
    if module == 'audit':
        from src.tools.report_audit_tool import extract_data_points, sample_points, render_verdict
        require(parameters, ['text', 'seed', 'sample_rate', 'checks'])
        if not isinstance(parameters['text'], str) or type(parameters['seed']) is not int or not isinstance(parameters['checks'], list):
            raise ValueError('invalid report audit')
        number(parameters['sample_rate'], .01, 1)
        extraction = sample_points(extract_data_points(parameters['text']), ratio=parameters['sample_rate'], seed=parameters['seed'])
        # Sources are supplied by the operator. This is a numerical audit, not fact verification.
        return {'extraction': extraction, 'verdict': render_verdict(parameters['checks']) if parameters['checks'] else None, 'sampling_seed': parameters['seed']}
    if module == 'decay':
        from src.strategy_store.decay import DecayEvaluator
        from src.strategy_store.models import ArtifactStatus, DecaySignal
        require(parameters, ['current_status', 'prior_signals'])
        metrics = {key: parameters[key] for key in ['ic_ratio', 'ir', 'ic_positive_ratio', 'sharpe'] if key in parameters}
        if not metrics or not isinstance(parameters['prior_signals'], list) or len(parameters['prior_signals']) > 30:
            raise ValueError('decay evidence required')
        for value in metrics.values(): number(value)
        signal, transition = DecayEvaluator().evaluate_and_transition(ArtifactStatus(parameters['current_status']), **metrics, prior_signals=[DecaySignal(value) for value in parameters['prior_signals']])
        return {'evaluation': {'signal': signal.value, 'suggested_status': transition.value if transition else None}, 'persistence': 'disabled; owner identity required for hypotheses and strategy writes'}
    raise ValueError('unknown local calculator')


def cashflows(parameters):
    from src.entities.cashflow import CashFlow, CashFlowSeries
    from src.quantlib.fundmath import fund_multiples, xirr, XIRRError
    from src.quantlib.performance import time_weighted_return, modified_dietz_return, money_weighted_return, UnsolvableRateError
    require(parameters, ['currency', 'flows', 'valuations', 'flow_timing'])
    if parameters['currency'] not in ('USD', 'USDT') or parameters['flow_timing'] not in ('start', 'end'):
        raise ValueError('explicit currency and timing required')
    if not isinstance(parameters['flows'], list) or not 1 <= len(parameters['flows']) <= 200 or not isinstance(parameters['valuations'], list) or not 2 <= len(parameters['valuations']) <= 200:
        raise ValueError('cashflow count limit')
    flows = []
    for row in parameters['flows']:
        if set(row) != {'date', 'amount', 'kind', 'currency'} or row['currency'] != parameters['currency']:
            raise NotRunnable('CURRENCY_MISMATCH')
        amount = decimal(row['amount'])
        flows.append(CashFlow(date=row['date'], amount=float(amount), kind=row['kind'], currency=row['currency']))
    series = CashFlowSeries(flows=tuple(flows), currency=parameters['currency'])
    valuations = []
    for row in parameters['valuations']:
        if set(row) != {'date', 'value'}:
            raise ValueError('invalid valuation')
        value = decimal(row['value'])
        if value <= 0:
            raise ValueError('positive valuation required')
        valuations.append((row['date'], float(value)))
    def available(function):
        try:
            return clean(function())
        except (ValueError, XIRRError, UnsolvableRateError):
            return {'status': 'unavailable', 'reason': 'not_identifiable_from_supplied_flows'}
    return {'fund_multiples': available(lambda: fund_multiples(series)), 'xirr': available(lambda: xirr(series)), 'time_weighted_return': available(lambda: time_weighted_return(valuations, series, flow_timing=parameters['flow_timing'])), 'modified_dietz_return': available(lambda: modified_dietz_return(valuations, series)), 'money_weighted_return': available(lambda: money_weighted_return(valuations, series)), 'currency': parameters['currency'], 'precision': 'source decimal strings; pinned analytical routines use float, not an asset ledger', 'sign_convention': 'holder perspective: contribution negative, distribution positive; NAV is not cash'}


def rigor(parameters):
    from src.tools import financial_rigor_tool as source
    require(parameters, ['operation', 'values'])
    allowed = {'market_cap': source.verify_market_cap, 'valuation': source.verify_valuation,
               'cross_validate': source.cross_validate, 'benford': source.benford_check,
               'calc': source.exact_calc, 'three_scenario': source.three_scenario_valuation}
    function = allowed.get(parameters['operation'])
    if function is None or not isinstance(parameters['values'], dict):
        raise ValueError('fixed rigor operation required')
    values = parameters['values']
    if parameters['operation'] == 'market_cap' and decimal(values['reported_cap']) <= 0:
        raise ValueError('reported capitalization must be positive')
    if parameters['operation'] == 'calc':
        expression = values.get('expr')
        if not isinstance(expression, str) or len(expression) > 1000 or len(list(ast.walk(ast.parse(expression, mode='eval')))) > 128:
            raise ValueError('arithmetic expression limit')
        verification = {**clean(function(**values)), 'exact_result': str(source._safe_arith(expression))}
    else:
        verification = clean(function(**values))
    return {'verification': verification, 'precision': 'pinned 28 digit Decimal routines; display fields may be rounded floats'}
