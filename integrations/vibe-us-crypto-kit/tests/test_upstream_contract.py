"""Opt-in offline tests against the actual pinned modules, not substitute math."""
import json
import os
from pathlib import Path
import shutil
import sys

import pytest

pytestmark = pytest.mark.skipif(not os.environ.get('VIBE_UPSTREAM_TEST_AGENT'), reason='pinned runtime required')


def series(count):
    return {'bars': [{'date': f'2025-01-{i+1:02d}', 'close': 100 + i * .7 + (i % 3), 'volume': 1000 + i} for i in range(count)],
            'provenance': {'last_bar_date': '2025-01-20', 'source': 'yahoo'}}


def test_technical_warmup_is_unavailable_without_filling():
    sys.path.insert(0, os.environ['VIBE_UPSTREAM_TEST_AGENT'])
    from bridge.technical import calculate_technical
    result = calculate_technical(series(14))
    assert all(v['status'] == 'unavailable' and v['value'] is None for v in result['indicators'].values())


def test_reuses_exact_pinned_rsi_and_bollinger_on_unsampled_bars():
    sys.path.insert(0, os.environ['VIBE_UPSTREAM_TEST_AGENT'])
    import pandas as pd
    from bridge.technical import calculate_technical
    from src.tools.technical_indicator_tool import _compute_rsi, _compute_bollinger
    data = series(20)
    close = pd.Series([b['close'] for b in data['bars']], dtype=float)
    result = calculate_technical(data)
    assert result['indicators']['rsi_14']['value'] == _compute_rsi(close)
    assert result['indicators']['bollinger']['value'] == _compute_bollinger(close)
    assert result['indicators']['sma_50']['value'] is None
    assert result['bar_count'] == 20


def test_runtime_blob_drift_stops_before_import(tmp_path):
    from bridge.upstream import verify_runtime_source
    agent = Path(os.environ['VIBE_UPSTREAM_TEST_AGENT'])
    lock = json.loads((Path(__file__).resolve().parents[3] / 'services/vibe-bridge/bridge/upstream-lock.json').read_text())
    for name in lock['sentinel_blobs']:
        destination = tmp_path / name; destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(agent.parent / name, destination)
    verify_runtime_source(tmp_path / 'agent')
    (tmp_path/'agent/src/market_data.py').write_text('tampered')
    with pytest.raises(RuntimeError, match='SOURCE_BLOB_MISMATCH'): verify_runtime_source(tmp_path / 'agent')
