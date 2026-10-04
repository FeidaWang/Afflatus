from __future__ import annotations

import asyncio
from starlette.responses import JSONResponse


class RequestBodyLimit:
    """Bound bytes before JSON parsing, including chunked bodies without a length."""
    def __init__(self, app, maximum: int = 4096):
        self.app, self.maximum = app, maximum

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") != "/v1/bars" or scope.get("method") != "POST":
            return await self.app(scope, receive, send)

        async def reject(status: int, code: str):
            await JSONResponse({"error": {"code": code}}, status_code=status, headers={
                "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
            })(scope, receive, send)

        lengths = [v for k, v in scope.get("headers", []) if k.lower() == b"content-length"]
        if lengths:
            if len(lengths) != 1 or not lengths[0].isdigit():
                return await reject(400, "INVALID_CONTENT_LENGTH")
            if len(lengths[0]) > 8 or int(lengths[0]) > self.maximum:
                return await reject(413, "REQUEST_TOO_LARGE")

        async def read_all():
            pieces, total = [], 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return None
                data = message.get("body", b"")
                total += len(data)
                if total > self.maximum:
                    raise OverflowError
                pieces.append(data)
                if not message.get("more_body", False):
                    return b"".join(pieces)
        try:
            body = await asyncio.wait_for(read_all(), timeout=5)
        except OverflowError:
            return await reject(413, "REQUEST_TOO_LARGE")
        except asyncio.TimeoutError:
            return await reject(408, "REQUEST_TIMEOUT")
        if body is None:
            return
        delivered = False
        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()
        return await self.app(scope, replay, send)
