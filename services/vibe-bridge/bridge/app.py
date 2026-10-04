from __future__ import annotations

import asyncio
import hmac
import os
import time
from collections import OrderedDict
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from .models import BarsRequest, INSTRUMENTS
from .limits import RequestBodyLimit
from .normalize import SourceUnavailable
from .provider import fetch_bars
from .research_models import ResearchRequest
from .research import envelope, sec_contact_valid
from .quant_models import QuantRequest
from .quant_jobs import QuantJobs

@asynccontextmanager
async def lifespan(_app):
    yield
    await quant_jobs.close()


app = FastAPI(title="Afflatus Vibe Market Bridge", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
# Single process only. Multiple replicas need a shared budget/cache before scaling.
slots = asyncio.Semaphore(2)
cache: OrderedDict[str, tuple[float, dict]] = OrderedDict()
inflight: dict[str, asyncio.Task] = {}
quant_jobs = QuantJobs(slots)


async def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("VIBE_BRIDGE_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(503, "SERVICE_NOT_CONFIGURED")
    supplied = (authorization or "").removeprefix("Bearer ")
    if not authorization or not authorization.startswith("Bearer ") or not hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(401, "UNAUTHORIZED")


@app.middleware("http")
async def response_security(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


app.add_middleware(RequestBodyLimit, maximum=4096)


@app.get("/healthz")
async def health():
    return {"ok": True, "service": "vibe-market-bridge", "scope": ["us_equity", "us_etf", "crypto_spot"]}


@app.get("/v1/instruments", dependencies=[Depends(require_token)])
async def instruments():
    return {"instruments": [{k: v for k, v in x.items() if k != "upstream_symbol"} for x in INSTRUMENTS.values()]}


async def _load(request, key: str, *, research=False) -> dict:
    async with slots:
        result = await fetch_bars(request, research=True) if research else await fetch_bars(request)
        cache[key] = (time.monotonic() + 60, result)
        cache.move_to_end(key)
        while len(cache) > 128:
            cache.popitem(last=False)
        return result


@app.post("/v1/bars", dependencies=[Depends(require_token)])
async def bars(request: BarsRequest):
    return await cached_operation(request, 'bars')


@app.post("/v1/research", dependencies=[Depends(require_token)])
async def research(request: ResearchRequest):
    # Fail before spawning/importing a network worker when contact is absent.
    if request.module in ('filings', 'financials', 'institutions', 'etf') and not sec_contact_valid(os.getenv('VIBE_TRADING_SEC_UA')):
        return envelope(request, 'SEC_CONTACT_REQUIRED')
    if request.module == 'earnings':
        from .calendar import gateway_settings
        if gateway_settings() is None:
            return envelope(request, 'US_CONNECTOR_REQUIRED')
    return await cached_operation(request, 'research')


@app.post('/v1/quant/jobs', dependencies=[Depends(require_token)], status_code=202)
async def start_quant_job(request: QuantRequest):
    return quant_jobs.submit(request)


@app.get('/v1/quant/jobs/{identifier}', dependencies=[Depends(require_token)])
async def read_quant_job(identifier: str):
    if len(identifier) != 32 or any(char not in '0123456789abcdef' for char in identifier):
        raise HTTPException(404, 'JOB_NOT_FOUND')
    return quant_jobs.view(identifier)


@app.delete('/v1/quant/jobs/{identifier}', dependencies=[Depends(require_token)])
async def cancel_quant_job(identifier: str):
    if len(identifier) != 32 or any(char not in '0123456789abcdef' for char in identifier):
        raise HTTPException(404, 'JOB_NOT_FOUND')
    return await quant_jobs.cancel(identifier)


async def cached_operation(request, operation):
    key = operation + ':' + request.model_dump_json()
    entry = cache.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    if key not in inflight:
        if len(inflight) >= 8:
            raise HTTPException(429, "SERVICE_BUSY", headers={"Retry-After": "10"})
        task = asyncio.create_task(_load(request, key, research=operation == 'research'))
        inflight[key] = task
        def finish(done):
            inflight.pop(key, None)
            if not done.cancelled():
                done.exception()  # Retrieve failure even when all clients disconnect.
        task.add_done_callback(finish)
    try:
        return await asyncio.shield(inflight[key])
    except SourceUnavailable:
        if operation == 'research': return envelope(request, 'SOURCE_UNAVAILABLE')
        return JSONResponse({"error": {"code": "SOURCE_UNAVAILABLE"}}, status_code=503)
