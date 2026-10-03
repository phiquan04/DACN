"""Per-caller request throttling for the expensive/abusable endpoints (LLM
calls, Whisper/BERT inference, sign-in).

In-process sliding window: this app runs as a single uvicorn process (see
Backend/Dockerfile), so a dict behind a lock is enough and avoids adding
Redis just for this. If the backend is ever scaled to several workers, each
worker keeps its own counters — swap the storage for a shared one then.

Callers are identified by user id when the request carries a valid Bearer
token, otherwise by client IP. Behind a reverse proxy `request.client.host`
is the proxy's address, so run uvicorn with `--proxy-headers` there.
"""
import threading
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import Depends, HTTPException, Request, status

from app.dependencies import get_optional_user_id

_lock = threading.Lock()
_hits: dict = defaultdict(deque)

# Drop idle callers' (now empty) buckets every so often so the dict can't
# grow without bound as new IPs come and go.
_SWEEP_EVERY_SECONDS = 300
_last_sweep = 0.0


def _sweep(now: float) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_EVERY_SECONDS:
        return
    _last_sweep = now
    for key in [k for k, hits in _hits.items() if not hits or hits[-1] <= now]:
        del _hits[key]


def rate_limit(scope: str, limit: int, window_seconds: int):
    """Dependency factory: at most `limit` requests per `window_seconds` for
    one caller within `scope`. Use as `dependencies=[Depends(rate_limit(...))]`
    on a route so the handler's own signature stays untouched."""

    def dependency(request: Request, user_id: Optional[int] = Depends(get_optional_user_id)) -> None:
        caller = f"user:{user_id}" if user_id is not None else f"ip:{request.client.host if request.client else 'unknown'}"
        key = f"{scope}:{caller}"
        now = time.monotonic()

        with _lock:
            _sweep(now)
            hits = _hits[key]
            # Each entry is the moment that hit leaves the window.
            while hits and hits[0] <= now:
                hits.popleft()
            if len(hits) >= limit:
                retry_after = max(1, int(hits[0] - now) + 1)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Bạn thao tác quá nhanh. Vui lòng thử lại sau {retry_after} giây.",
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now + window_seconds)

    return dependency
