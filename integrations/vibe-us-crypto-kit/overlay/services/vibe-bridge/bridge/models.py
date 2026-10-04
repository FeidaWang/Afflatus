from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

INSTRUMENTS = {item["id"]: item for item in json.loads(
    Path(__file__).with_name("instruments.json").read_text(encoding="utf-8"))}


class BarsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    instrument_id: str
    start_date: date
    end_date: date
    interval: Literal["1D"] = "1D"

    @model_validator(mode="after")
    def check_scope(self) -> "BarsRequest":
        if self.instrument_id not in INSTRUMENTS:
            raise ValueError("instrument is not in the deployed US/crypto allowlist")
        days = (self.end_date - self.start_date).days
        if not 1 <= days <= 366:
            raise ValueError("date range must be 1..366 days; end is exclusive")
        if self.end_date > datetime.now(timezone.utc).date():
            raise ValueError("future or incomplete current-day bars are not served")
        return self
