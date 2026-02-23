"""Agent orchestration module — handles chat interactions with the LLM provider.

This module is the bridge between the WebSocket handler (main.py) and the LLM
provider layer (llm/). It manages the chat lifecycle:
  1. Sends status:thinking before calling provider
  2. Calls provider.execute(prompt=message)
  3. Streams response back as chat_stream messages
  4. Logs LLM usage to llm_usage table
  5. Sends status:idle in finally (always)
  6. On error: sends structured error message (NFR22)

Architecture mandates:
  - main.py is the ONLY file that touches the WebSocket object directly —
    agent.py receives ws: WebSocket as a parameter
  - No subdirectory — flat module in app/
  - Async-only (no sync I/O)
  - Per-request DB connections (never session-scoped — see fix(1-5))
"""

import uuid
from datetime import UTC, datetime

from fastapi import WebSocket

from app.db import get_connection
from app.llm.base import LLMProvider, LLMResult
from app.logging import log


async def _log_llm_usage(result: LLMResult, db_path: str) -> None:
    """Insert LLM usage record into llm_usage table.

    Uses a per-request DB connection (not session-scoped — critical pattern).
    Silently logs and skips if DB error to avoid breaking the chat flow.
    """
    try:
        db = await get_connection(db_path)
        try:
            await db.execute(
                "INSERT INTO llm_usage (id, provider, model, tokens_in, tokens_out, cost_estimate, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    result.provider,
                    result.model,
                    result.tokens_in,
                    result.tokens_out,
                    result.cost_estimate,
                    datetime.now(UTC).isoformat(),
                ),
            )
            await db.commit()
            log.info(
                "llm_usage_logged",
                provider=result.provider,
                model=result.model,
                tokens_in=result.tokens_in,
                tokens_out=result.tokens_out,
                latency_ms=result.latency_ms,
            )
        finally:
            await db.close()
    except Exception as e:
        log.warning(
            "llm_usage_log_failed",
            error=str(e),
            agent_action="LLM usage record could not be saved. Chat still succeeded.",
        )


async def handle_chat(
    ws: WebSocket,
    message: str,
    provider: LLMProvider,
    db_path: str,
) -> None:
    """Handle a chat message: call LLM provider and stream response back.

    Sends status:thinking before calling provider.
    Sends full response as a single chat_stream delta, then done:True.
    Sends status:idle in finally block (always, even on error).
    On error: sends structured error message (NFR22, LLM_CHAT_FAILED).

    First Light streaming pattern: full response as single chunk, then done:True.
    True token-by-token streaming is deferred to MVP (AnthropicAPI with stream=True).

    Args:
        ws:       WebSocket — the sole communication channel (from main.py)
        message:  The user's chat message text
        provider: LLM provider instance (obtained via get_provider() in main.py)
        db_path:  Path to SQLite database for llm_usage logging
    """
    # Always notify thinking state before calling provider
    await ws.send_json({"type": "status", "payload": {"state": "thinking"}})

    try:
        # Call provider with the user's message as the prompt
        result = await provider.execute(prompt=message)

        # Send full response as a single stream chunk (First Light pattern)
        await ws.send_json({
            "type": "chat_stream",
            "payload": {"delta": result.content, "done": False},
        })

        # Signal stream completion
        await ws.send_json({
            "type": "chat_stream",
            "payload": {"delta": "", "done": True},
        })

        # Log LLM usage asynchronously (per-request connection)
        await _log_llm_usage(result, db_path)

        log.info(
            "chat_handled",
            provider=provider.name,
            latency_ms=result.latency_ms,
        )

    except Exception as e:
        log.error(
            "chat_failed",
            error=str(e),
            provider=provider.name,
            agent_action=f"Check provider logs: {provider.name}",
        )
        await ws.send_json({
            "type": "error",
            "payload": {
                "code": "LLM_CHAT_FAILED",
                "message": "I encountered an error generating a response. Please try again.",
                "agent_action": f"Check provider logs: {provider.name}",
            },
        })

    finally:
        # Always reset to idle, even on error
        await ws.send_json({"type": "status", "payload": {"state": "idle"}})
