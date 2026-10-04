"""Bounded research computations. No code, files, owners or connector arguments."""
from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator
from .models import BarsRequest, INSTRUMENTS

CONTRACT = json.loads(Path(__file__).with_name('quant-contract.json').read_text())


def bounded_value(value, depth=0):
    if depth > 8:
        raise ValueError('input nesting limit')
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, (int, float)):
        if not math.isfinite(value) or abs(value) > 1e15:
            raise ValueError('invalid number')
    elif isinstance(value, str):
        if len(value) > 12000:
            raise ValueError('text limit')
    elif isinstance(value, list):
        if len(value) > 400:
            raise ValueError('array limit')
        for item in value:
            bounded_value(item, depth + 1)
    elif isinstance(value, dict):
        if len(value) > 40 or any(not isinstance(k, str) or len(k) > 64 for k in value):
            raise ValueError('object limit')
        for item in value.values():
            bounded_value(item, depth + 1)
    else:
        raise ValueError('JSON values only')


class QuantRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    instrument_id: str
    module: Literal['backtest', 'options_chain', 'option_model', 'option_payoff', 'dcf', 'comps', 'three_statement', 'factors', 'portfolio', 'catalogue', 'perpetual', 'cashflows', 'rigor', 'audit', 'decay', 'reconcile']
    start_date: date | None = None
    end_date: date | None = None
    parameters: dict = {}

    @model_validator(mode='after')
    def check_scope(self):
        item = INSTRUMENTS.get(self.instrument_id)
        if not item:
            raise ValueError('instrument not enabled')
        spec = CONTRACT['modules'][self.module]
        if item['market'] not in spec['markets']:
            raise ValueError('module not applicable')
        if spec['history']:
            if self.start_date is None or self.end_date is None:
                raise ValueError('history range required')
            BarsRequest(instrument_id=self.instrument_id, start_date=self.start_date, end_date=self.end_date)
        elif self.start_date is not None or self.end_date is not None:
            raise ValueError('unexpected history range')
        if set(self.parameters) - set(spec['parameters']):
            raise ValueError('unknown calculation parameter')
        bounded_value(self.parameters)
        if len(json.dumps(self.parameters).encode()) > 24000:
            raise ValueError('input byte limit')
        return self


class NotRunnable(ValueError):
    def __init__(self, reason, missing=()):
        self.reason, self.missing = reason, list(missing)
        super().__init__(reason)
