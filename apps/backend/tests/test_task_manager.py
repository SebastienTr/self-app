"""Tests for AgentTaskManager — Story 4.0, Task 2.

Tests:
  - PendingMessage dataclass
  - buffer_message adds to session buffer with monotonic seq
  - drain_buffer returns messages after given seq
  - ack_messages prunes acknowledged messages
  - TTL eviction drops messages older than 300s
  - Multi-session isolation
  - Per-session message queue for concurrent chat messages
"""

import asyncio
import time
from unittest.mock import patch

import pytest

from app.task_manager import AgentTaskManager, PendingMessage


class TestPendingMessage:
    """Tests for PendingMessage dataclass."""

    def test_has_required_fields(self):
        """PendingMessage has seq, payload, and created_at fields."""
        msg = PendingMessage(seq=1, payload={"type": "test"}, created_at=time.monotonic())
        assert msg.seq == 1
        assert msg.payload == {"type": "test"}
        assert isinstance(msg.created_at, float)


class TestBufferMessage:
    """Tests for buffer_message method."""

    def test_buffer_message_returns_seq(self):
        """buffer_message returns the assigned sequence number."""
        mgr = AgentTaskManager()
        seq = mgr.buffer_message("session-1", {"type": "chat_stream"})
        assert seq == 1

    def test_buffer_message_monotonic_seq(self):
        """Sequence numbers are monotonically increasing per session."""
        mgr = AgentTaskManager()
        s1 = mgr.buffer_message("session-1", {"type": "a"})
        s2 = mgr.buffer_message("session-1", {"type": "b"})
        s3 = mgr.buffer_message("session-1", {"type": "c"})
        assert s1 == 1
        assert s2 == 2
        assert s3 == 3

    def test_buffer_message_separate_sessions_have_own_counters(self):
        """Different sessions have independent sequence counters."""
        mgr = AgentTaskManager()
        sa = mgr.buffer_message("session-a", {"type": "a"})
        sb = mgr.buffer_message("session-b", {"type": "b"})
        assert sa == 1
        assert sb == 1

    def test_buffer_message_stores_payload(self):
        """Buffered messages store the correct payload."""
        mgr = AgentTaskManager()
        mgr.buffer_message("s1", {"type": "status", "payload": {"state": "thinking"}})
        messages = mgr.drain_buffer("s1", after_seq=0)
        assert len(messages) == 1
        assert messages[0].payload == {"type": "status", "payload": {"state": "thinking"}}


class TestDrainBuffer:
    """Tests for drain_buffer method."""

    def test_drain_buffer_returns_all_after_seq(self):
        """drain_buffer returns all messages with seq > after_seq."""
        mgr = AgentTaskManager()
        mgr.buffer_message("s1", {"type": "a"})
        mgr.buffer_message("s1", {"type": "b"})
        mgr.buffer_message("s1", {"type": "c"})

        messages = mgr.drain_buffer("s1", after_seq=1)
        assert len(messages) == 2
        assert messages[0].seq == 2
        assert messages[1].seq == 3

    def test_drain_buffer_returns_empty_for_current_seq(self):
        """drain_buffer returns empty list when after_seq is current."""
        mgr = AgentTaskManager()
        mgr.buffer_message("s1", {"type": "a"})

        messages = mgr.drain_buffer("s1", after_seq=1)
        assert len(messages) == 0

    def test_drain_buffer_returns_empty_for_unknown_session(self):
        """drain_buffer returns empty list for unknown session."""
        mgr = AgentTaskManager()
        messages = mgr.drain_buffer("unknown", after_seq=0)
        assert len(messages) == 0

    def test_drain_buffer_after_seq_zero_returns_all(self):
        """drain_buffer with after_seq=0 returns all messages."""
        mgr = AgentTaskManager()
        mgr.buffer_message("s1", {"type": "a"})
        mgr.buffer_message("s1", {"type": "b"})

        messages = mgr.drain_buffer("s1", after_seq=0)
        assert len(messages) == 2


class TestAckMessages:
    """Tests for ack_messages method."""

    def test_ack_prunes_messages_up_to_seq(self):
        """ack_messages removes messages with seq <= up_to_seq."""
        mgr = AgentTaskManager()
        mgr.buffer_message("s1", {"type": "a"})  # seq 1
        mgr.buffer_message("s1", {"type": "b"})  # seq 2
        mgr.buffer_message("s1", {"type": "c"})  # seq 3

        mgr.ack_messages("s1", up_to_seq=2)
        remaining = mgr.drain_buffer("s1", after_seq=0)
        assert len(remaining) == 1
        assert remaining[0].seq == 3

    def test_ack_unknown_session_no_error(self):
        """ack_messages on unknown session does not raise."""
        mgr = AgentTaskManager()
        mgr.ack_messages("unknown", up_to_seq=5)  # Should not raise

    def test_ack_all_messages_leaves_empty_buffer(self):
        """ack_messages for all messages leaves empty buffer."""
        mgr = AgentTaskManager()
        mgr.buffer_message("s1", {"type": "a"})
        mgr.buffer_message("s1", {"type": "b"})

        mgr.ack_messages("s1", up_to_seq=2)
        remaining = mgr.drain_buffer("s1", after_seq=0)
        assert len(remaining) == 0


class TestTTLEviction:
    """Tests for TTL-based message eviction."""

    def test_evict_expired_removes_old_messages(self):
        """Messages older than TTL are removed by evict_expired."""
        mgr = AgentTaskManager(ttl_seconds=300)

        # Add messages with fake old timestamps
        mgr.buffer_message("s1", {"type": "a"})
        mgr.buffer_message("s1", {"type": "b"})

        # Manually set created_at to be old
        for msg in mgr._buffers["s1"]:
            msg.created_at = time.monotonic() - 400  # older than 300s TTL

        # Add a fresh message
        mgr.buffer_message("s1", {"type": "c"})

        mgr.evict_expired()

        remaining = mgr.drain_buffer("s1", after_seq=0)
        assert len(remaining) == 1
        assert remaining[0].payload == {"type": "c"}

    def test_evict_expired_keeps_fresh_messages(self):
        """evict_expired does not remove messages within TTL."""
        mgr = AgentTaskManager(ttl_seconds=300)
        mgr.buffer_message("s1", {"type": "a"})
        mgr.buffer_message("s1", {"type": "b"})

        mgr.evict_expired()

        remaining = mgr.drain_buffer("s1", after_seq=0)
        assert len(remaining) == 2


class TestMultiSessionIsolation:
    """Tests for multi-session buffer isolation."""

    def test_sessions_have_independent_buffers(self):
        """Messages in one session don't appear in another."""
        mgr = AgentTaskManager()
        mgr.buffer_message("s1", {"type": "a"})
        mgr.buffer_message("s2", {"type": "b"})

        s1_msgs = mgr.drain_buffer("s1", after_seq=0)
        s2_msgs = mgr.drain_buffer("s2", after_seq=0)

        assert len(s1_msgs) == 1
        assert s1_msgs[0].payload == {"type": "a"}
        assert len(s2_msgs) == 1
        assert s2_msgs[0].payload == {"type": "b"}

    def test_ack_in_one_session_doesnt_affect_another(self):
        """Acking messages in one session doesn't touch another."""
        mgr = AgentTaskManager()
        mgr.buffer_message("s1", {"type": "a"})
        mgr.buffer_message("s2", {"type": "b"})

        mgr.ack_messages("s1", up_to_seq=1)

        assert len(mgr.drain_buffer("s1", after_seq=0)) == 0
        assert len(mgr.drain_buffer("s2", after_seq=0)) == 1


class TestMessageQueue:
    """Tests for per-session message queue (sequential processing)."""

    @pytest.mark.asyncio
    async def test_enqueue_creates_queue_for_session(self):
        """enqueue_chat creates a per-session asyncio queue."""
        mgr = AgentTaskManager()
        mgr.enqueue_chat("s1", "Hello")
        assert "s1" in mgr._queues

    @pytest.mark.asyncio
    async def test_dequeue_chat_returns_messages_in_order(self):
        """Messages are dequeued in FIFO order."""
        mgr = AgentTaskManager()
        mgr.enqueue_chat("s1", "First")
        mgr.enqueue_chat("s1", "Second")

        msg1 = await mgr.dequeue_chat("s1")
        msg2 = await mgr.dequeue_chat("s1")

        assert msg1 == "First"
        assert msg2 == "Second"

    @pytest.mark.asyncio
    async def test_dequeue_chat_creates_queue_if_missing(self):
        """dequeue_chat creates queue for unknown session (blocks until item)."""
        mgr = AgentTaskManager()

        # Enqueue after a tiny delay so dequeue has a queue to wait on
        async def enqueue_later():
            await asyncio.sleep(0.01)
            mgr.enqueue_chat("s1", "Delayed")

        task = asyncio.create_task(enqueue_later())
        msg = await asyncio.wait_for(mgr.dequeue_chat("s1"), timeout=1.0)
        assert msg == "Delayed"
        await task

    @pytest.mark.asyncio
    async def test_separate_sessions_have_separate_queues(self):
        """Different sessions have independent message queues."""
        mgr = AgentTaskManager()
        mgr.enqueue_chat("s1", "A")
        mgr.enqueue_chat("s2", "B")

        msg_s1 = await mgr.dequeue_chat("s1")
        msg_s2 = await mgr.dequeue_chat("s2")

        assert msg_s1 == "A"
        assert msg_s2 == "B"


class TestNotifyWriter:
    """Tests for the writer notification mechanism."""

    @pytest.mark.asyncio
    async def test_get_writer_queue_returns_asyncio_queue(self):
        """get_writer_queue returns an asyncio.Queue for the session."""
        mgr = AgentTaskManager()
        q = mgr.get_writer_queue("s1")
        assert isinstance(q, asyncio.Queue)

    @pytest.mark.asyncio
    async def test_notify_writer_puts_sentinel_on_queue(self):
        """notify_writer puts a sentinel on the writer queue."""
        mgr = AgentTaskManager()
        q = mgr.get_writer_queue("s1")
        await mgr.notify_writer("s1")
        item = await asyncio.wait_for(q.get(), timeout=1.0)
        assert item is True  # sentinel value

    @pytest.mark.asyncio
    async def test_buffer_and_notify_combines_both(self):
        """buffer_and_notify buffers message and notifies writer."""
        mgr = AgentTaskManager()
        q = mgr.get_writer_queue("s1")
        seq = await mgr.buffer_and_notify("s1", {"type": "test"})
        assert seq >= 1
        item = await asyncio.wait_for(q.get(), timeout=1.0)
        assert item is True
