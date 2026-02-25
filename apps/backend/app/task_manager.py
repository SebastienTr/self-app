"""Agent task manager — decouples agent work from WebSocket lifecycle.

Provides:
  - Per-session message buffer with monotonic sequence numbers
  - TTL eviction for stale messages (default 300s)
  - Per-session asyncio.Queue for chat message queuing (sequential processing)
  - Writer notification via asyncio.Queue (push-based, no polling)

Design decisions (Story 4.0):
  - In-memory buffer (not SQLite) — simple for V1, full-sync fallback on restart
  - Sequence numbers are per-session, not global
  - At-least-once delivery — client deduplicates by seq
  - Concurrent messages are queued, not cancelled
"""

import asyncio
import time
from dataclasses import dataclass

from app.logging import log


@dataclass
class PendingMessage:
    """A buffered message awaiting delivery or acknowledgment."""

    seq: int
    payload: dict
    created_at: float


class AgentTaskManager:
    """Manages per-session message buffers and chat message queues.

    Thread-safety: designed for single-event-loop usage (asyncio).
    No locks needed — all access is from the same event loop.
    """

    def __init__(self, ttl_seconds: float = 300.0):
        self._ttl_seconds = ttl_seconds
        # Per-session message buffers: session_id -> list[PendingMessage]
        self._buffers: dict[str, list[PendingMessage]] = {}
        # Per-session sequence counters: session_id -> int
        self._seq_counters: dict[str, int] = {}
        # Per-session chat message queues: session_id -> asyncio.Queue
        self._queues: dict[str, asyncio.Queue] = {}
        # Per-session writer notification queues: session_id -> asyncio.Queue
        self._writer_queues: dict[str, asyncio.Queue] = {}
        # Per-session chat worker tasks (background processors)
        self._chat_workers: dict[str, asyncio.Task] = {}

    def buffer_message(self, session_id: str, payload: dict) -> int:
        """Append a message to the session's buffer with a monotonic seq.

        Args:
            session_id: The WebSocket session identifier.
            payload: The message payload dict to buffer.

        Returns:
            The assigned sequence number.
        """
        if session_id not in self._seq_counters:
            self._seq_counters[session_id] = 0
            self._buffers[session_id] = []

        self._seq_counters[session_id] += 1
        seq = self._seq_counters[session_id]

        msg = PendingMessage(
            seq=seq,
            payload=payload,
            created_at=time.monotonic(),
        )
        self._buffers[session_id].append(msg)
        return seq

    def drain_buffer(
        self, session_id: str, after_seq: int
    ) -> list[PendingMessage]:
        """Return messages with seq > after_seq for the session.

        Does NOT remove messages from the buffer (they remain until acked
        or TTL-evicted). This allows re-delivery on reconnect.

        Args:
            session_id: The WebSocket session identifier.
            after_seq: Return messages with sequence numbers after this value.

        Returns:
            List of PendingMessage objects, ordered by seq.
        """
        buffer = self._buffers.get(session_id, [])
        return [m for m in buffer if m.seq > after_seq]

    def ack_messages(self, session_id: str, up_to_seq: int) -> None:
        """Prune messages with seq <= up_to_seq from the session buffer.

        Args:
            session_id: The WebSocket session identifier.
            up_to_seq: Remove messages up to and including this seq.
        """
        if session_id not in self._buffers:
            return
        self._buffers[session_id] = [
            m for m in self._buffers[session_id] if m.seq > up_to_seq
        ]

    def evict_expired(self) -> None:
        """Remove messages older than TTL from all session buffers."""
        now = time.monotonic()
        cutoff = now - self._ttl_seconds
        for session_id in list(self._buffers.keys()):
            self._buffers[session_id] = [
                m for m in self._buffers[session_id]
                if m.created_at > cutoff
            ]

    def enqueue_chat(self, session_id: str, message: str) -> None:
        """Enqueue a chat message for sequential processing.

        Args:
            session_id: The WebSocket session identifier.
            message: The chat message text.
        """
        if session_id not in self._queues:
            self._queues[session_id] = asyncio.Queue()
        self._queues[session_id].put_nowait(message)

    async def dequeue_chat(self, session_id: str) -> str:
        """Dequeue the next chat message for the session (blocks until available).

        Args:
            session_id: The WebSocket session identifier.

        Returns:
            The chat message text.
        """
        if session_id not in self._queues:
            self._queues[session_id] = asyncio.Queue()
        return await self._queues[session_id].get()

    def try_dequeue_chat_nowait(self, session_id: str) -> str | None:
        """Dequeue a chat message immediately, or return None if the queue is empty."""
        if session_id not in self._queues:
            self._queues[session_id] = asyncio.Queue()
        try:
            return self._queues[session_id].get_nowait()
        except asyncio.QueueEmpty:
            return None

    def has_pending_chat(self, session_id: str) -> bool:
        """Return True if the session chat queue currently has queued messages."""
        q = self._queues.get(session_id)
        return bool(q is not None and not q.empty())

    def get_writer_queue(self, session_id: str) -> asyncio.Queue:
        """Get or create the writer notification queue for a session.

        The writer loop awaits on this queue. When a message is buffered,
        a sentinel is put on this queue to wake the writer.

        Args:
            session_id: The WebSocket session identifier.

        Returns:
            The asyncio.Queue for writer notifications.
        """
        if session_id not in self._writer_queues:
            self._writer_queues[session_id] = asyncio.Queue()
        return self._writer_queues[session_id]

    def reset_writer_queue(self, session_id: str) -> asyncio.Queue:
        """Replace the writer queue with a fresh one for reconnection.

        Avoids stale asyncio.Queue state when a session reconnects
        (previous get() cancellation can leave the queue unable to
        wake new waiters on Python 3.14).

        Args:
            session_id: The WebSocket session identifier.

        Returns:
            A fresh asyncio.Queue for writer notifications.
        """
        self._writer_queues[session_id] = asyncio.Queue()
        return self._writer_queues[session_id]

    async def notify_writer(self, session_id: str) -> None:
        """Notify the writer loop that new messages are available.

        Puts a True sentinel on the writer queue.

        Args:
            session_id: The WebSocket session identifier.
        """
        q = self.get_writer_queue(session_id)
        await q.put(True)

    async def buffer_and_notify(
        self, session_id: str, payload: dict
    ) -> int:
        """Buffer a message and notify the writer loop.

        Convenience method combining buffer_message + notify_writer.

        Args:
            session_id: The WebSocket session identifier.
            payload: The message payload dict to buffer.

        Returns:
            The assigned sequence number.
        """
        seq = self.buffer_message(session_id, payload)
        await self.notify_writer(session_id)
        return seq

    def active_session_ids(self) -> list[str]:
        """Return a snapshot of all session IDs that have active writer queues.

        Used by the refresh scheduler to push updates to all connected clients.

        Returns:
            List of session ID strings.
        """
        return list(self._writer_queues.keys())

    def cleanup_session(self, session_id: str) -> None:
        """Remove all state for a session (on disconnect).

        Args:
            session_id: The WebSocket session identifier.
        """
        self._buffers.pop(session_id, None)
        self._seq_counters.pop(session_id, None)
        self._queues.pop(session_id, None)
        self._writer_queues.pop(session_id, None)
        worker = self._chat_workers.get(session_id)
        if worker and worker.done():
            self._chat_workers.pop(session_id, None)

    def get_chat_worker(self, session_id: str) -> asyncio.Task | None:
        """Return the active chat worker for a session, if any.

        Completed workers are pruned lazily.
        """
        worker = self._chat_workers.get(session_id)
        if worker and worker.done():
            self._chat_workers.pop(session_id, None)
            return None
        return worker

    def set_chat_worker(self, session_id: str, worker: asyncio.Task) -> None:
        """Register the background chat worker task for a session."""
        self._chat_workers[session_id] = worker

    def clear_chat_worker(
        self, session_id: str, worker: asyncio.Task | None = None
    ) -> None:
        """Clear a session's worker registration.

        If `worker` is provided, clears only when it matches the current task.
        """
        current = self._chat_workers.get(session_id)
        if current is None:
            return
        if worker is None or current is worker:
            self._chat_workers.pop(session_id, None)

    async def cancel_all_workers(self) -> None:
        """Cancel all registered chat workers (application shutdown)."""
        workers = list(self._chat_workers.values())
        self._chat_workers.clear()
        for worker in workers:
            if not worker.done():
                worker.cancel()
        for worker in workers:
            try:
                await asyncio.wait_for(worker, timeout=0.5)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
            except Exception:
                pass


# Singleton instance — shared across the application
task_manager = AgentTaskManager()
