"""One fixed computation, filtered environment and bounded stdin/stdout."""
import contextlib
import json
import os
import sys
from pathlib import Path


def main():
    from .quant_models import QuantRequest
    payload = sys.stdin.buffer.read(32769)
    if len(payload) > 32768:
        raise ValueError('input too large')
    request = QuantRequest.model_validate_json(payload)
    from .upstream import verify_runtime_source
    verify_runtime_source(Path(os.environ['VIBE_UPSTREAM_AGENT']), quant=True)
    with contextlib.redirect_stdout(sys.stderr):
        from .quant import execute
        result = execute(request)
    output = json.dumps(result, allow_nan=False, separators=(',', ':'))
    if len(output.encode()) > 1048576:
        raise ValueError('output limit')
    print(output)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.stderr.write('VIBE_QUANT_UNAVAILABLE\n')
        raise SystemExit(2)
