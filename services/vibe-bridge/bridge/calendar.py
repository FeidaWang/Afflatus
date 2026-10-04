"""Selected US company calendar via the pinned quote-only OpenD adapter."""
import math
import os
from datetime import date, datetime, timezone

from .models import INSTRUMENTS
from .normalize import SourceUnavailable


def gateway_settings():
    """Operator configuration only. No user account or browser-supplied endpoint."""
    if os.getenv('VIBE_FUTU_CALENDAR_ENABLED') != 'true':
        return None
    host = os.getenv('VIBE_FUTU_CALENDAR_HOST', '')
    port = os.getenv('VIBE_FUTU_CALENDAR_PORT', '')
    if host not in ('127.0.0.1', 'localhost', '::1') or not port.isascii() or not port.isdigit() or not 1 <= int(port) <= 65535:
        return None
    return host, int(port)


def load_calendar(result, request):
    from .research import section
    settings = gateway_settings()
    if settings is None:
        raise SourceUnavailable('calendar gateway not configured')
    from src.trading.connectors.futu.sdk import FutuConfig, get_earnings_calendar
    config = FutuConfig(host=settings[0], port=settings[1], filter_trdmarket='US', timeout=10, readonly=True)
    begin, end = request.begin_date.isoformat(), request.end_date.isoformat()
    raw = get_earnings_calendar(config=config, market='US', begin_date=begin, end_date=end)
    if raw.get('status') != 'ok' or raw.get('market') != 'US' or raw.get('begin_date') != begin or raw.get('end_date') != end:
        raise SourceUnavailable('calendar source identity mismatch')
    events = raw.get('events')
    if hasattr(events, 'to_dict'):
        events = events.to_dict(orient='records')
    if not isinstance(events, list) or len(events) > 20000:
        raise SourceUnavailable('invalid calendar rows')
    symbol = INSTRUMENTS[request.instrument_id]['symbol']
    rows = []
    for event in events:
        if not isinstance(event, dict):
            raise SourceUnavailable('invalid calendar event')
        if event.get('code') != 'US.' + symbol:
            continue
        day = event.get('earnings_date')
        if not isinstance(day, str) or date.fromisoformat(day).isoformat() != day or not begin <= day <= end:
            raise SourceUnavailable('calendar date outside requested window')
        stamp = event.get('earnings_timestamp')
        release_at = None
        if isinstance(stamp, (int, float)) and not isinstance(stamp, bool) and math.isfinite(stamp) and stamp > 0:
            release_at = datetime.fromtimestamp(stamp, timezone.utc).isoformat()
        def text(key):
            value = event.get(key)
            return value if isinstance(value, str) and value not in ('', 'N/A') else None
        rows.append({'symbol': symbol, 'name': text('name'), 'earnings_date': day,
                     'release_at': release_at, 'publish_session': text('pub_type'), 'period': text('period_text')})
    rows.sort(key=lambda row: (row['earnings_date'], row['period'] or ''))
    section(result, 'events', rows)
    result['notes'] = ['SELECTED_COMPANY_CALENDAR', 'SCHEDULE_MAY_CHANGE', 'PROVIDER_TIME_UNKNOWN']
