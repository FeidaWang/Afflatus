"""Ephemeral fixed-market jobs, single process. No personal artifact storage."""
import asyncio
import secrets
import time
from datetime import datetime, timezone

from fastapi import HTTPException
from .provider import fetch_bars
from .quant_models import CONTRACT


class QuantJobs:
    def __init__(self, slots, worker=None, clock=time.monotonic):
        self.slots, self.worker, self.clock = slots, worker or self._worker, clock
        self.jobs, self.tasks = {}, {}

    async def _worker(self, request):
        return await fetch_bars(request, quant=True)

    def prune(self):
        for identifier in list(self.jobs):
            if identifier not in self.tasks and self.jobs[identifier]['expires'] <= self.clock():
                del self.jobs[identifier]
        while len(self.jobs) >= 32:
            expired = next((key for key in self.jobs if key not in self.tasks), None)
            if expired is None:
                break
            del self.jobs[expired]

    def view(self, identifier):
        self.prune()
        job = self.jobs.get(identifier)
        if job is None:
            raise HTTPException(404, 'JOB_NOT_FOUND')
        return {key: value for key, value in job.items() if key != 'expires'}

    def submit(self, request):
        if CONTRACT['modules'][request.module]['local_only']:
            raise HTTPException(403, 'OWNER_REQUIRED')
        self.prune()
        if len(self.tasks) >= 4:
            raise HTTPException(429, 'SERVICE_BUSY', headers={'Retry-After': '10'})
        identifier = secrets.token_hex(16)
        self.jobs[identifier] = {'schema_version': 1, 'id': identifier, 'module': request.module, 'instrument_id': request.instrument_id, 'status': 'queued', 'created_at': datetime.now(timezone.utc).isoformat(), 'result': None, 'error': None, 'expires': self.clock() + 600}
        task = asyncio.create_task(self.run(identifier, request))
        self.tasks[identifier] = task
        task.add_done_callback(lambda done: self.tasks.pop(identifier, None))
        return self.view(identifier)

    async def run(self, identifier, request):
        job = self.jobs[identifier]
        try:
            # Queue time is part of the limit; callers never hold a long HTTP request.
            async def computation():
                async with self.slots:
                    job['status'] = 'running'
                    return await self.worker(request)
            job['result'] = await asyncio.wait_for(computation(), timeout=150)
            job['status'] = 'complete'
        except asyncio.CancelledError:
            job.update(status='cancelled', result=None, error=None)
            raise
        except Exception:
            job.update(status='failed', result=None, error='SOURCE_UNAVAILABLE')
        finally:
            job['expires'] = self.clock() + 600

    async def cancel(self, identifier):
        self.view(identifier)
        task = self.tasks.get(identifier)
        if task is not None:
            self.jobs[identifier].update(status='cancelled', result=None, error=None)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        return self.view(identifier)

    async def close(self):
        for task in list(self.tasks.values()):
            task.cancel()
        await asyncio.gather(*list(self.tasks.values()), return_exceptions=True)
