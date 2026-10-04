from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

from .models import BarsRequest, INSTRUMENTS


class SourceUnavailable(RuntimeError):
    """Stable external error; upstream exception text is never returned."""


def _number(value: Any, *, nullable: bool = False) -> float | None:
    if value is None and nullable:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SourceUnavailable("invalid numeric bar field")
    value = float(value)
    if not math.isfinite(value):
        raise SourceUnavailable("non-finite bar field")
    return value


def normalize_payload(raw: dict[str, Any], request: BarsRequest) -> dict[str, Any]:
    """Adapt the inspected fetch_market_data contract without inventing quotes.

    Only complete daily bars are exposed. A date is a session/bar label, not an
    execution timestamp. No forward filling, downsampling, or currency conversion.
    """
    if not isinstance(raw, dict):
        raise SourceUnavailable("invalid payload")
    instrument = INSTRUMENTS[request.instrument_id]
    symbol = instrument["upstream_symbol"]
    records = raw.get(symbol)
    if not isinstance(records, list) or not records or len(records) > 400:
        # cap_rows returns an object when it samples: reject rather than chart it.
        raise SourceUnavailable("missing, sampled, or oversized series")
    metadata = raw.get("_provenance")
    if not isinstance(metadata, dict) or not isinstance(metadata.get(symbol), dict):
        raise SourceUnavailable("missing provenance")
    provenance = metadata[symbol]
    if provenance.get("fallback_used") not in (None, False):
        raise SourceUnavailable("unexpected source fallback")
    source = provenance.get("source")
    if source != instrument["source"]:
        raise SourceUnavailable("source identity changed")
    declared_currency = provenance.get("quote_currency")
    if declared_currency and declared_currency != instrument["quote_currency"]:
        raise SourceUnavailable("quote-currency mismatch")
    if provenance.get("resolved_symbol", symbol) != symbol:
        raise SourceUnavailable("instrument identity changed")
    rows: dict[str, dict[str, Any]] = {}
    for record in records:
        if not isinstance(record, dict):
            raise SourceUnavailable("invalid row")
        label = next((record[k] for k in ("trade_date", "date", "datetime", "timestamp", "time", "index")
                      if record.get(k) is not None), None)
        if not isinstance(label, str):
            raise SourceUnavailable("missing date label")
        try:
            timestamp = datetime.fromisoformat(label.replace("Z", "+00:00"))
            day = timestamp.date()
        except ValueError as exc:
            raise SourceUnavailable("invalid date label") from exc
        if instrument['market'] == 'crypto_spot':
            # Pinned OKX 1D opens at UTC+8 midnight = 16:00 UTC. The loader
            # may keep unconfirmed rows, so check the full 24-hour interval.
            if 'T' not in label and ' ' not in label:
                raise SourceUnavailable('missing crypto bar-open timestamp')
            opened = timestamp.replace(tzinfo=timezone.utc) if timestamp.tzinfo is None else timestamp.astimezone(timezone.utc)
            expected_hour = 16 if instrument['source'] == 'okx' else 0
            if opened.hour != expected_hour or opened.minute or opened.second or opened.microsecond:
                raise SourceUnavailable('unexpected exchange daily alignment')
            if opened + timedelta(days=1) > datetime.now(timezone.utc):
                continue
        if not request.start_date <= day < request.end_date:
            continue
        key = day.isoformat()
        if key in rows:
            raise SourceUnavailable("duplicate daily bars")
        values = {k: _number(record.get(k)) for k in ("open", "high", "low", "close")}
        if min(values.values()) <= 0:
            raise SourceUnavailable("nonpositive price")
        if not values["low"] <= min(values["open"], values["close"]) <= max(values["open"], values["close"]) <= values["high"]:
            raise SourceUnavailable("invalid OHLC ordering")
        volume = _number(record.get("volume"), nullable=True)
        if volume is not None and volume < 0:
            raise SourceUnavailable("negative volume")
        rows[key] = {"date": key, **values, "volume": volume}
        if instrument['market'] == 'crypto_spot':
            rows[key]['bar_open_at'] = opened.isoformat()
            rows[key]['bar_close_at'] = (opened + timedelta(days=1)).isoformat()
    bars = [rows[key] for key in sorted(rows)]
    if not bars:
        raise SourceUnavailable("no complete bars in range")
    return {
        "schema_version": 1,
        "instrument": {k: v for k, v in instrument.items() if k != "upstream_symbol"},
        "bars": bars,
        "provenance": {
            "source": source,
            "requested_source": instrument["source"],
            "quote_currency": instrument["quote_currency"],
            "currency_basis": "provider_declared" if declared_currency else "registered_instrument",
            "adjustment": provenance.get("adjustment", "unknown"),
            "volume_unit": provenance.get("volume_unit"),
            "bar_timezone": ("UTC+08:00" if source == 'okx' else "UTC") if instrument['market'] == 'crypto_spot' else "America/New_York",
            "date_label_basis": "UTC_bar_open_date" if instrument['market'] == 'crypto_spot' else "exchange_session_date",
            "quality": "complete_daily_bars",
            "interval": "1D",
            "bar_time_semantics": "provider_daily_bar_date_not_execution_timestamp",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "last_bar_date": bars[-1]["date"],
            "delay_status": "unknown",
            "is_realtime_quote": False,
            "fallback_used": False,
        },
    }
