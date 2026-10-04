"""Host adapter regressions. Synthetic data here is never a production fallback."""
from datetime import datetime, timezone
import os

import pytest
from bridge.models import BarsRequest
from bridge.normalize import normalize_payload, SourceUnavailable
import bridge.normalize as module

pytestmark = pytest.mark.skipif(not os.environ.get('VIBE_TEST_HOST_ROOT'), reason='host adapter only')


def raw(symbol, timestamp, source):
    return {symbol: [dict(trade_date=timestamp, open=100, high=105, low=99, close=103, volume=1000)],
            '_provenance': {symbol: dict(source=source, fallback_used=False, adjustment='unknown', volume_unit=None)}}


def test_actual_upstream_trade_date_field():
    req = BarsRequest(instrument_id='US:AAPL', start_date='2025-01-01', end_date='2025-01-10')
    result = normalize_payload(raw('AAPL.US', '2025-01-02T00:00:00', 'yahoo'), req)
    assert result['bars'][0]['date'] == '2025-01-02'
    assert result['provenance']['quality'] == 'complete_daily_bars'


def test_crypto_keeps_absolute_open_close_and_unknown_unit():
    req = BarsRequest(instrument_id='CRYPTO:OKX:BTC-USDT:SPOT', start_date='2025-01-01', end_date='2025-01-10')
    result = normalize_payload(raw('BTC-USDT', '2025-01-02T16:00:00', 'okx'), req)
    assert result['bars'][0]['bar_close_at'] == '2025-01-03T16:00:00+00:00'
    assert result['provenance']['bar_timezone'] == 'UTC+08:00'
    assert result['provenance']['volume_unit'] is None


@pytest.mark.parametrize('label', ['2025-01-02', '2025-01-02T00:00:00'])
def test_crypto_ambiguous_day_or_wrong_alignment_is_rejected(label):
    req = BarsRequest(instrument_id='CRYPTO:OKX:BTC-USDT:SPOT', start_date='2025-01-01', end_date='2025-01-10')
    with pytest.raises(SourceUnavailable): normalize_payload(raw('BTC-USDT', label, 'okx'), req)


def test_yesterdays_label_can_still_be_an_incomplete_crypto_bar(monkeypatch):
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None): return datetime(2025,1,3,8,0,tzinfo=timezone.utc)
    monkeypatch.setattr(module, 'datetime', Clock)
    req = BarsRequest(instrument_id='CRYPTO:OKX:BTC-USDT:SPOT', start_date='2025-01-01', end_date='2025-01-04')
    with pytest.raises(SourceUnavailable):
        normalize_payload(raw('BTC-USDT', '2025-01-02T16:00:00', 'okx'), req)
