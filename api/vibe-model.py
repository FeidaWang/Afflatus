"""Public assumption-only models on the existing Vercel project."""
import importlib.util
import json
import os
import math
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('vibe_model_runtime', ROOT / 'services/vibe-model/runtime.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
limit_spec = importlib.util.spec_from_file_location('model_rate_limit', ROOT / 'services/vibe-model/rate_limit.py')
rate_limit = importlib.util.module_from_spec(limit_spec)
limit_spec.loader.exec_module(rate_limit)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result or key in {'__proto__', 'constructor', 'prototype'}:
            raise ValueError('INVALID_REQUEST')
        result[key] = value
    return result


class handler(BaseHTTPRequestHandler):
    def reply(self, status, value, retry_after=None):
        data = json.dumps(value, allow_nan=False, separators=(',', ':')).encode()
        self.send_response(status)
        for key, val in {'Content-Type': 'application/json; charset=utf-8',
                         'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store',
                         'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                         'Content-Length': str(len(data))}.items():
            self.send_header(key, val)
        if retry_after is not None:
            self.send_header('Retry-After', str(retry_after))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if os.getenv('VIBE_MODELS_ENABLED') != 'true':
            return self.reply(404, {'error': {'code': 'FEATURE_DISABLED'}})
        if urlsplit(self.path).query or self.headers.get_content_type() != 'application/json':
            return self.reply(400, {'error': {'code': 'INVALID_REQUEST'}})
        try:
            ip = rate_limit.client_ip(self.headers, self.client_address[0])
            for scope, identity, limit in [('model:ip', ip, 20), ('model:global', 'all', 120)]:
                allowed, reset_ms = rate_limit.check(scope, identity, limit)
                if not allowed:
                    return self.reply(429, {'error': {'code': 'RATE_LIMITED'}}, math.ceil(reset_ms / 1000))
        except rate_limit.Unavailable:
            return self.reply(503, {'error': {'code': 'RATE_LIMIT_UNAVAILABLE'}}, 5)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 32768:
                return self.reply(413, {'error': {'code': 'REQUEST_TOO_LARGE'}})
            body = json.loads(self.rfile.read(size), object_pairs_hook=unique_object,
                              parse_constant=lambda _: (_ for _ in ()).throw(ValueError('INVALID_REQUEST')))
            result = runtime.calculate(body)
        except (ValueError, TypeError, RecursionError, UnicodeError):
            return self.reply(400, {'error': {'code': 'INVALID_REQUEST'}})
        except Exception as error:
            # Class name only: never log the submitted assumptions.
            print(f'vibe-model: MODEL_UNAVAILABLE {type(error).__name__}', file=sys.stderr)
            return self.reply(503, {'error': {'code': 'MODEL_UNAVAILABLE'}})
        return self.reply(200, result)

    def do_GET(self):
        self.send_response(405)
        self.send_header('Allow', 'POST')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()

    do_DELETE = do_GET
    do_PUT = do_GET
    do_PATCH = do_GET
    do_OPTIONS = do_GET

    def log_message(self, *_args):
        pass  # No assumptions or submitted payloads in application logs.
