"""Fixed read-only research requests; no upstream tool arguments or URLs."""
import json
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator
from .models import INSTRUMENTS

CONTRACT = json.loads(Path(__file__).with_name('research-contract.json').read_text())
MANAGERS = {'berkshire': '0001067983', 'bridgewater': '0001350694'}


class ResearchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    instrument_id: str
    module: Literal['profile', 'filings', 'financials', 'institutions', 'etf', 'news', 'screener', 'industry', 'orderbook', 'fear_greed', 'earnings']
    cadence: Literal['annual', 'quarter'] = 'annual'
    cutoff: date | None = None
    manager: Literal['berkshire', 'bridgewater'] = 'berkshire'
    begin_date: date | None = None
    end_date: date | None = None

    @model_validator(mode='after')
    def check_scope(self):
        item = INSTRUMENTS.get(self.instrument_id)
        if not item:
            raise ValueError('instrument not enabled')
        scope = CONTRACT['modules'][self.module]['scope']
        allowed = {'equity': ['us_equity'], 'etf': ['us_etf'], 'us': ['us_equity', 'us_etf'], 'crypto': ['crypto_spot']}
        if item['market'] not in allowed[scope]:
            raise ValueError('module not applicable to this market')
        if self.module != 'financials' and (self.cutoff is not None or self.cadence != 'annual'):
            raise ValueError('cadence and cutoff apply only to financials')
        if self.module != 'institutions' and self.manager != 'berkshire':
            raise ValueError('manager applies only to institutions')
        if self.cutoff and not date(1990, 1, 1) <= self.cutoff <= datetime.now(timezone.utc).date():
            raise ValueError('invalid filed cutoff')
        if self.module == 'earnings':
            today = datetime.now(timezone.utc).date()
            if self.begin_date is None or self.end_date is None or not 0 <= (self.end_date - self.begin_date).days <= 6:
                raise ValueError('calendar requires an inclusive window of at most seven days')
            if not today - timedelta(days=366) <= self.begin_date <= self.end_date <= today + timedelta(days=366):
                raise ValueError('calendar window out of bounds')
        elif self.begin_date is not None or self.end_date is not None:
            raise ValueError('calendar dates apply only to earnings')
        return self
