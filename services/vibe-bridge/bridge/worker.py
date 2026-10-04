"""One read-only upstream operation per process; no shell or arbitrary tool name."""
from __future__ import annotations

import contextlib
import json
import sys
from pathlib import Path
import os


def main() -> None:
    from .models import BarsRequest, INSTRUMENTS

    payload = sys.stdin.buffer.read(4097)
    research = os.getenv('VIBE_WORKER_OPERATION') == 'research'
    if research:
        from .research_models import ResearchRequest
        request = ResearchRequest.model_validate_json(payload)
    else:
        request = BarsRequest.model_validate_json(payload)
    instrument = INSTRUMENTS[request.instrument_id]
    from .upstream import verify_runtime_source
    verify_runtime_source(Path(os.environ['VIBE_UPSTREAM_AGENT']), quant=research and request.module == 'earnings')
    # Keep dependency print statements out of the machine-readable stdout.
    with contextlib.redirect_stdout(sys.stderr):
        if research:
            from .research import load_research
            print_result = load_research(request)
        else:
            print_result = load_bars(request, instrument)
    print(json.dumps(print_result, allow_nan=False, separators=(",", ":")))


def load_bars(request, instrument):
    from .normalize import normalize_payload
    from src.market_data import fetch_market_data, get_loader

    def strict_resolver(source: str):
        if source != instrument["source"]:
            raise ValueError("provider not enabled")
        cls = get_loader(source)
        if getattr(cls, "name", None) != source:
            raise ValueError("implicit fallback provider is not enabled")
        return cls

    raw = fetch_market_data(
        codes=[instrument["upstream_symbol"]],
        start_date=request.start_date.isoformat(),
        end_date=request.end_date.isoformat(),
        source=instrument["source"], interval="1D", max_rows=0,
        include_provenance=True, max_fallback_attempts=1,
        loader_resolver=strict_resolver,
        fallback_chain_provider=lambda _source: [instrument["source"]],
    )
    result = normalize_payload(raw, request)
    from .technical import calculate_technical
    result['technical'] = calculate_technical(result)
    from .patterns import calculate_patterns
    result['patterns'] = calculate_patterns(result)
    return result

if __name__ == "__main__":
    try:
        main()
    except Exception:
        # No stack, local path, API secret, upstream text, or session state leaks.
        sys.stderr.write("VIBE_SOURCE_UNAVAILABLE\n")
        raise SystemExit(2)
