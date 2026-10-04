"""Reuse pinned upstream indicator math on validated, unsampled daily bars."""
from __future__ import annotations


def calculate_technical(result: dict) -> dict:
    import pandas as pd
    from src.tools.technical_indicator_tool import (
        _compute_rsi, _compute_macd, _compute_bollinger,
        _compute_sma, _compute_ema, _compute_volume_stats,
    )
    bars = result['bars']
    close = pd.Series([b['close'] for b in bars], index=pd.to_datetime([b['date'] for b in bars]), dtype=float)
    volume = pd.Series([b['volume'] for b in bars], index=close.index, dtype=float)
    calculations = {
        'rsi_14': (15, lambda: _compute_rsi(close)),
        'macd': (35, lambda: _compute_macd(close)),
        'bollinger': (20, lambda: _compute_bollinger(close)),
        'sma_20': (20, lambda: _compute_sma(close, 20)),
        'sma_50': (50, lambda: _compute_sma(close, 50)),
        'sma_200': (200, lambda: _compute_sma(close, 200)),
        'ema_20': (20, lambda: _compute_ema(close, 20)),
        'volume': (20, lambda: _compute_volume_stats(volume)),
    }
    indicators = {}
    for name, (minimum, calculate) in calculations.items():
        value = calculate() if len(close) >= minimum else None
        indicators[name] = {'minimum_bars': minimum, 'value': value,
                            'status': 'available' if value is not None else 'unavailable',
                            'reason': None if value is not None else 'INSUFFICIENT_BARS'}
    return {'upstream_commit': '251b094320c1f97d1486626d3618113526914d4c',
            'implementation': 'src.tools.technical_indicator_tool', 'bar_count': len(bars),
            'as_of': result['provenance']['last_bar_date'], 'source': result['provenance']['source'],
            'calculation_basis': 'all_validated_bars_before_display_sampling', 'indicators': indicators}
