"""Pinned pattern math, explicitly retrospective where pivots need future bars."""
from .research_models import CONTRACT


def calculate_patterns(series):
    import pandas as pd
    from src.tools.pattern_tool import (candlestick_patterns, support_resistance, trend_line_slope,
                                       head_and_shoulders, double_top_bottom, triangle, broadening)
    bars = series['bars']; count = len(bars)
    frame = pd.DataFrame(bars).set_index('date')
    close = frame['close']
    functions = {
        'candlestick': (2, lambda: candlestick_patterns(frame.open, frame.high, frame.low, close)),
        'head_and_shoulders': (21, lambda: head_and_shoulders(close, window=10)),
        'double_top_bottom': (21, lambda: double_top_bottom(close, window=10)),
        'triangle': (21, lambda: triangle(close, window=20)),
        'broadening': (21, lambda: broadening(close, window=20)),
    }
    output = {}
    for name, (minimum, calculate) in functions.items():
        events = []
        if count >= minimum:
            signals = calculate()
            events = [{'date': str(day), 'value': int(v),
                       'confirmed_at': bars[-1]['date'] if name in ('head_and_shoulders', 'double_top_bottom') else str(day)}
                      for i, (day, v) in enumerate(signals.items()) if v != 0]
        output[name] = {'minimum_bars': minimum, 'status': 'available' if count >= minimum else 'unavailable',
                        'reason': None if count >= minimum else 'INSUFFICIENT_BARS', 'events': events}
    levels = support_resistance(close, window=20) if count >= 41 else None
    slope = float(trend_line_slope(close, window=20).iloc[-1]) if count >= 20 else None
    return {'upstream_commit': CONTRACT['commit'], 'implementation': 'src.tools.pattern_tool',
            'source': series['provenance']['source'], 'as_of': series['provenance']['last_bar_date'],
            'bar_count': count, 'calculation_basis': 'all_validated_bars_before_display_sampling',
            'interpretation': 'retrospective_patterns_not_tradable_signals', 'patterns': output,
            'support_resistance': levels, 'trend_slope_20': slope}
