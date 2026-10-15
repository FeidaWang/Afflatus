"""Atomic Redis quotas across Vercel instances; no request payloads are stored."""
import hashlib
import json
import os
import time
import threading
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.parse import urlsplit

SCRIPT = """
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
"""
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


urlopen = build_opener(NoRedirect).open
_local = {}
_lock = threading.Lock()


class Unavailable(Exception):
    pass


def check(scope, identity, limit, window_ms=60000):
    url = os.getenv('UPSTASH_REDIS_REST_URL') or os.getenv('KV_REST_API_URL')
    token = os.getenv('UPSTASH_REDIS_REST_TOKEN') or os.getenv('KV_REST_API_TOKEN')
    environment = os.getenv('VERCEL_ENV', 'development')
    key = f'afflatus:rl:v1:{environment}:{scope}:' + hashlib.sha256(identity.encode()).hexdigest()
    if not url and not token and environment != 'production' and not os.getenv('VERCEL'):
        with _lock:
            now = time.monotonic() * 1000
            for old in list(_local):
                if _local[old][1] <= now:
                    del _local[old]
            count, expires = _local.get(key, (0, now + window_ms))
            if key not in _local and len(_local) >= 10000:
                return False, window_ms
            _local[key] = (count + 1, expires)
            return count < limit, max(1, int(expires - now))
    try:
        parsed = urlsplit(url or '')
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or not token:
            raise Unavailable()
        request = Request(url.rstrip('/'), method='POST',
                          data=json.dumps(['EVAL', SCRIPT, '1', key, str(window_ms)]).encode(),
                          headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
        with urlopen(request, timeout=2) as response:
            data = json.loads(response.read(4096))
        result = data['result']
        if data.get('error') or not isinstance(result, list) or len(result) != 2:
            raise Unavailable()
        count, ttl = result
        if type(count) is not int or type(ttl) is not int or count < 1 or not 0 < ttl <= window_ms:
            raise Unavailable()
        return count <= limit, ttl
    except Exception:
        raise Unavailable('RATE_LIMIT_UNAVAILABLE') from None


def client_ip(headers, address):
    name = 'x-vercel-forwarded-for' if os.getenv('VERCEL') else 'x-forwarded-for'
    fallback = 'unknown' if os.getenv('VERCEL') else address
    return (headers.get(name) or fallback).split(',')[0].strip() or 'unknown'
