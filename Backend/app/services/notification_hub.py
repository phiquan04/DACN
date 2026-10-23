"""In-process pub/sub that pushes notification events to open SSE streams
(see GET /api/notifications/stream in app/routes/notifications.py).

Producers don't call this module directly: a Notification row inserted
anywhere (vocabulary/learning.py, services/email_verification.py, ...) is
picked up by the SQLAlchemy hooks at the bottom of this file and published
only once its transaction commits — a rolled-back insert never reaches a
client. Routes that change read state publish an "unread_count" signal
explicitly so every open tab resyncs its badge.

Subscribers live in this process's memory, which is enough while the backend
runs as a single uvicorn process (see Backend/Dockerfile). Running several
workers would need a cross-process channel instead (e.g. Postgres
LISTEN/NOTIFY), since a commit in one worker can't see the queues of another.
"""
import asyncio
import signal
from collections import defaultdict
from typing import Dict, Optional, Set, Tuple

from sqlalchemy import event
from sqlalchemy.orm import object_session

from app.models.base import SessionLocal
from app.models.notification import Notification
from app.schemas.notification import NotificationOut

# Caps how many tabs/devices one account can hold a stream open from, so a
# runaway client can't pin an unbounded number of queues in memory.
MAX_STREAMS_PER_USER = 5
# A slow consumer whose queue fills up just drops events: every event makes
# the stream re-read the unread count from the DB, so the badge self-heals on
# the next one that does get through.
QUEUE_MAX_SIZE = 100

# (event name, payload) — payload is None for pure signals like "unread_count".
StreamEvent = Tuple[str, Optional[dict]]
# Put on a queue to tell its stream to end (server shutting down).
CLOSE = None


class TooManyStreams(Exception):
    pass


class NotificationHub:
    def __init__(self) -> None:
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._subscribers: Dict[int, Set[asyncio.Queue]] = defaultdict(set)

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        """Called from the app's lifespan startup, on the server's event loop."""
        self._loop = loop
        _close_streams_on_exit_signal(self)

    def has_capacity(self, user_id: int) -> bool:
        """Event-loop thread only."""
        return len(self._subscribers.get(user_id, ())) < MAX_STREAMS_PER_USER

    def subscribe(self, user_id: int) -> asyncio.Queue:
        """Event-loop thread only."""
        if not self.has_capacity(user_id):
            raise TooManyStreams()
        queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAX_SIZE)
        self._subscribers[user_id].add(queue)
        return queue

    def unsubscribe(self, user_id: int, queue: asyncio.Queue) -> None:
        """Event-loop thread only."""
        queues = self._subscribers.get(user_id)
        if not queues:
            return
        queues.discard(queue)
        if not queues:
            del self._subscribers[user_id]

    def publish(self, user_id: int, event_name: str, payload: Optional[dict] = None) -> None:
        """Safe to call from any thread — sync routes run in the threadpool,
        the reminder scheduler in its own thread — so delivery is always
        handed over to the event loop rather than touching queues here."""
        self._call_on_loop(self._deliver, user_id, (event_name, payload))

    def close_all(self) -> None:
        self._call_on_loop(self._close_all)

    def _call_on_loop(self, fn, *args) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        try:
            loop.call_soon_threadsafe(fn, *args)
        except RuntimeError:
            pass  # loop shut down between the check and the call

    def _deliver(self, user_id: int, item: StreamEvent) -> None:
        for queue in list(self._subscribers.get(user_id, ())):
            try:
                queue.put_nowait(item)
            except asyncio.QueueFull:
                pass

    def _close_all(self) -> None:
        for queues in self._subscribers.values():
            for queue in queues:
                try:
                    queue.put_nowait(CLOSE)
                except asyncio.QueueFull:
                    # Make room: ending the stream matters more than whatever is queued.
                    queue.get_nowait()
                    queue.put_nowait(CLOSE)


notification_hub = NotificationHub()


def _close_streams_on_exit_signal(hub: NotificationHub) -> None:
    """uvicorn's graceful shutdown (Ctrl+C, and every `--reload` restart)
    waits for all open connections to finish before stopping — an SSE stream
    never finishes on its own, so without this the server hangs at "Waiting
    for connections to close". Wrap the handlers uvicorn installed so the
    same signal first tells every stream to end. Lifespan shutdown would be
    too late: uvicorn only runs it after the connections have closed."""
    import threading
    if threading.current_thread() is not threading.main_thread():
        return

    signals = [signal.SIGINT, signal.SIGTERM]
    if hasattr(signal, "SIGBREAK"):
        signals.append(signal.SIGBREAK)  # Windows: Ctrl+Break / reloader restarts

    for sig in signals:
        previous = signal.getsignal(sig)
        if not callable(previous):
            continue

        def handler(signum, frame, _previous=previous):
            hub.close_all()
            _previous(signum, frame)

        signal.signal(sig, handler)


# --- Publish newly inserted Notification rows once their transaction commits ---

_PENDING_KEY = "pending_notification_events"


@event.listens_for(Notification, "after_insert")
def _queue_inserted_notification(mapper, connection, target: Notification) -> None:
    session = object_session(target)
    if session is None:
        return
    # Serialize now: after commit the instance is expired, and reading its
    # attributes there would trigger a refresh query inside the commit hook.
    payload = NotificationOut(
        id=target.id, type=target.type, title=target.title, message=target.message,
        link=target.link, is_read=target.is_read, created_at=target.created_at,
    ).model_dump(mode="json")
    session.info.setdefault(_PENDING_KEY, []).append((target.user_id, payload))


@event.listens_for(SessionLocal, "after_commit")
def _publish_committed_notifications(session) -> None:
    for user_id, payload in session.info.pop(_PENDING_KEY, ()):
        notification_hub.publish(user_id, "notification", payload)


@event.listens_for(SessionLocal, "after_rollback")
def _discard_rolled_back_notifications(session) -> None:
    session.info.pop(_PENDING_KEY, None)
