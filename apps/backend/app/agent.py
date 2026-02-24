"""Agent orchestration module — handles chat interactions with the LLM provider.

This module is the bridge between the WebSocket handler (main.py) and the LLM
provider layer (llm/). It manages the chat lifecycle:
  1. Sends status:thinking before calling provider
  2. Calls provider.execute(prompt=message) with module creation system prompt
  3. Parses LLM response for module spec JSON (code fence detection)
  4. If module spec found: validates, saves to DB, sends module_created
  5. If no spec: streams response as regular chat_stream
  6. Logs LLM usage to llm_usage table
  7. Sends status:idle in finally (always)
  8. On error: sends structured error message (NFR22)

Architecture mandates:
  - main.py is the ONLY file that touches the WebSocket object directly —
    agent.py receives ws: WebSocket as a parameter
  - No subdirectory — flat module in app/
  - Async-only (no sync I/O)
  - Per-request DB connections (never session-scoped — see fix(1-5))
"""

import asyncio
import json
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import WebSocket

from app.db import get_connection
from app.llm.base import LLMProvider, LLMResult
from app.logging import log
from app.modules import create_module

# ---------------------------------------------------------------------------
# SOUL.md — Agent Identity Persistence
# ---------------------------------------------------------------------------

_DEFAULT_SOUL_CONTENT = """\
# Self — Agent Identity

## Name
Self

## Personality
You are Self, a thoughtful and capable AI assistant. You are warm but concise, \
helpful but not overbearing. You speak naturally, like a knowledgeable friend \
who genuinely wants to help.

## Communication Style
- Be conversational and natural — avoid sounding robotic or formulaic
- Match the user's language (if they write in French, respond in French)
- Keep responses concise unless the user asks for detail
- Use a friendly, approachable tone
- Never start responses with "I" — vary your sentence openings
- Acknowledge the user's intent before jumping to solutions

## Knowledge & Capabilities
You can create native mobile modules (widgets) by discovering APIs and composing \
UI primitives. When a user describes a need that maps to a data module (weather, \
stocks, news, tracking, etc.), you create it autonomously.

For regular conversation, you are helpful, honest, and direct. You don't pretend \
to know things you don't.

## Values
- Respect the user's time — be efficient
- Be honest about limitations
- Prioritize the user's actual need over showing off
- Remember that every API call costs the user money (BYOK) — be mindful of \
token usage
"""


def _soul_path(data_dir: str) -> Path:
    """Return the path to the SOUL.md file.

    Args:
        data_dir: The data directory (e.g. "data").

    Returns:
        Path object pointing to SOUL.md inside data_dir.
    """
    return Path(data_dir) / "SOUL.md"


async def _ensure_default_soul(data_dir: str) -> str:
    """Write the default SOUL.md content to disk and return it.

    Creates the data directory if it does not exist.
    Note: This function does NOT log — callers (load_soul) handle logging
    before invoking this to distinguish first-creation vs regeneration.

    Args:
        data_dir: The data directory (e.g. "data").

    Returns:
        The default SOUL content string.
    """
    soul_file = _soul_path(data_dir)
    await asyncio.to_thread(soul_file.parent.mkdir, parents=True, exist_ok=True)
    await asyncio.to_thread(soul_file.write_text, _DEFAULT_SOUL_CONTENT, encoding="utf-8")
    return _DEFAULT_SOUL_CONTENT


async def load_soul(data_dir: str) -> str:
    """Load the agent's SOUL identity from disk.

    Reads data_dir/SOUL.md. If the file is missing, empty, or corrupted,
    regenerates the default SOUL.md and returns default content.

    This function is called on every chat message (no caching) so that
    live edits to the file take effect immediately.

    Args:
        data_dir: The data directory (e.g. "data").

    Returns:
        The SOUL.md content string.
    """
    soul_file = _soul_path(data_dir)
    try:
        content = await asyncio.to_thread(soul_file.read_text, encoding="utf-8")
        if not content.strip():
            log.warning(
                "soul_empty",
                agent_action="SOUL.md was empty, regenerating default identity",
            )
            return await _ensure_default_soul(data_dir)
        return content
    except FileNotFoundError:
        log.info(
            "soul_not_found",
            agent_action="Creating default SOUL.md for first boot",
        )
        return await _ensure_default_soul(data_dir)
    except (OSError, UnicodeDecodeError) as e:
        log.warning(
            "soul_read_failed",
            error=str(e),
            agent_action="SOUL.md corrupted, regenerating default identity",
        )
        return await _ensure_default_soul(data_dir)


# ---------------------------------------------------------------------------
# Module Spec Extraction & Prompt Assembly
# ---------------------------------------------------------------------------

# Required fields for a valid module spec from the LLM
_REQUIRED_SPEC_FIELDS = {"name", "type", "template", "data_sources", "refresh_interval", "schema_version", "accessible_label"}

# Regex to extract JSON from a markdown code fence
_JSON_CODE_FENCE_RE = re.compile(r"```json\s*\n(.*?)\n\s*```", re.DOTALL)


class _SpecResult:
    """Result of module spec extraction attempt."""

    __slots__ = ("spec", "error", "has_code_fence")

    def __init__(self, spec: dict | None, error: str | None, has_code_fence: bool):
        self.spec = spec
        self.error = error
        self.has_code_fence = has_code_fence


def _extract_module_spec(content: str) -> dict | None:
    """Extract and validate a module spec from LLM response content.

    Looks for a JSON code block (```json ... ```) in the response.
    If found, parses the JSON and validates required fields.

    Args:
        content: The full LLM response text.

    Returns:
        Parsed module spec dict if valid, None otherwise.
    """
    result = _try_extract_module_spec(content)
    return result.spec


def _try_extract_module_spec(content: str) -> _SpecResult:
    """Try to extract a module spec, returning detailed result with error info.

    Used internally to distinguish between:
    - No JSON code fence found (regular chat)
    - JSON code fence found but invalid (error)
    - Valid module spec found (success)

    Args:
        content: The full LLM response text.

    Returns:
        _SpecResult with spec, error message, and whether a code fence was found.
    """
    match = _JSON_CODE_FENCE_RE.search(content)
    if not match:
        return _SpecResult(spec=None, error=None, has_code_fence=False)

    json_str = match.group(1).strip()
    try:
        spec = json.loads(json_str)
    except json.JSONDecodeError as e:
        return _SpecResult(spec=None, error=f"Invalid JSON in module spec: {e}", has_code_fence=True)

    if not isinstance(spec, dict):
        return _SpecResult(spec=None, error="Module spec must be a JSON object", has_code_fence=True)

    missing = _REQUIRED_SPEC_FIELDS - spec.keys()
    if missing:
        return _SpecResult(
            spec=None,
            error=f"Module spec missing required fields: {', '.join(sorted(missing))}",
            has_code_fence=True,
        )

    return _SpecResult(spec=spec, error=None, has_code_fence=True)


def _extract_chat_text(content: str) -> str:
    """Extract the conversational text from LLM response (everything outside the JSON block).

    Args:
        content: The full LLM response text.

    Returns:
        The text portion with the JSON code block removed and stripped.
    """
    # Remove the JSON code fence block
    text = _JSON_CODE_FENCE_RE.sub("", content).strip()
    return text


def _build_module_prompt(message: str, soul_content: str) -> str:
    """Build the prompt for the LLM that enables module creation.

    Includes the agent's SOUL identity, system instructions for module creation,
    schema requirements, and examples. The LLM will respond with both
    conversational text and a JSON module spec code block when appropriate.

    Args:
        message:      The user's chat message.
        soul_content: The SOUL.md content for agent identity.

    Returns:
        The full prompt string for the LLM provider.
    """
    return f"""# Agent Identity

{soul_content}

# Instructions

You are Self, an AI agent that creates native mobile modules. When the user describes a need that can be fulfilled by a data module (data tracking, monitoring, dashboards, weather, stocks, news, etc.), respond with BOTH:
1. A conversational acknowledgment (friendly, brief)
2. A valid module spec JSON block wrapped in ```json ... ```

If the user's message is just conversation (greeting, question, etc.) and NOT a module request, respond normally without any JSON block.

MODULE SPEC REQUIREMENTS:
The JSON block must contain these metadata fields:
- "name": string — display name for the module
- "type": one of "metric", "list", "text", "card"
- "template": one of "metric-dashboard", "data-card", "simple-list"
- "data_sources": array of objects, each with "id" (string), "type" (string, e.g. "rest_api"), "config" (object with "url" and "method")
- "refresh_interval": integer (seconds) — weather: 3600, stocks: 300, news: 1800
- "schema_version": always 1
- "accessible_label": string — accessibility description of the module

DISPLAY CONTENT (required — this is what the user sees on screen):
Depending on "type", you MUST include initial display content:

If type is "metric":
- "value": string or number — the main displayed value (use a realistic placeholder, e.g. "22°C")
- "label": string — short description shown below the value (e.g. "Temperature actuelle")
- "unit": string — unit displayed next to value (e.g. "°C", "km/h", "%")
- "trend": one of "up", "down", "stable" — optional trend indicator

If type is "list":
- "items": array of objects, each with "title" (string), "subtitle" (string, optional), "trailing" (string, optional — right-aligned text like a value or time)

If type is "text":
- "text": string — the text content to display

If type is "card":
- "title": string — card header
- "children": array of primitive objects, each with "type" and its own content fields

IMPORTANT:
- Use snake_case for ALL JSON field names (data_sources, refresh_interval, schema_version, accessible_label)
- Do NOT include an "id" field — the server generates UUIDs
- Find publicly available free APIs (like Open-Meteo for weather, no API key required)
- The JSON must be valid and parseable
- Always include realistic placeholder content — modules must look good immediately

EXAMPLE (weather metric):
```json
{{
  "name": "Météo Paris",
  "type": "metric",
  "template": "metric-dashboard",
  "value": "18°C",
  "label": "Température actuelle",
  "unit": "°C",
  "trend": "stable",
  "data_sources": [
    {{
      "id": "openmeteo-paris",
      "type": "rest_api",
      "config": {{
        "url": "https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current=temperature_2m,wind_speed_10m",
        "method": "GET"
      }}
    }}
  ],
  "refresh_interval": 3600,
  "schema_version": 1,
  "accessible_label": "Météo Paris indiquant la température et le vent actuels"
}}
```

EXAMPLE (news list):
```json
{{
  "name": "Tech News",
  "type": "list",
  "template": "simple-list",
  "items": [
    {{"title": "Loading latest news...", "subtitle": "Refreshing", "trailing": "now"}}
  ],
  "data_sources": [
    {{
      "id": "hackernews-top",
      "type": "rest_api",
      "config": {{
        "url": "https://hacker-news.firebaseio.com/v0/topstories.json?limitToFirst=10&orderBy=%22$key%22",
        "method": "GET"
      }}
    }}
  ],
  "refresh_interval": 1800,
  "schema_version": 1,
  "accessible_label": "Latest technology news headlines"
}}
```

User message: {message}"""


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


async def _handle_module_creation(
    ws: WebSocket,
    result: LLMResult,
    module_spec: dict,
    db_path: str,
) -> None:
    """Handle the module creation pipeline after a module spec is detected.

    Sends status updates, saves to DB, sends module_created message.
    Called from handle_chat when _extract_module_spec finds a valid spec.

    Status sequence: discovering -> composing -> module_created
    (thinking is sent before this, idle is sent after in handle_chat's finally)

    Args:
        ws:          WebSocket connection.
        result:      LLM result (for text extraction).
        module_spec: Validated module spec dict from LLM.
        db_path:     Path to SQLite database.
    """
    # Send conversational text as chat_stream (before module_created)
    chat_text = _extract_chat_text(result.content)
    if chat_text:
        await ws.send_json({
            "type": "chat_stream",
            "payload": {"delta": chat_text, "done": False},
        })
    await ws.send_json({
        "type": "chat_stream",
        "payload": {"delta": "", "done": True},
    })

    # Status: discovering (after parsing LLM response)
    await ws.send_json({"type": "status", "payload": {"state": "discovering"}})

    # Status: composing (during DB save)
    await ws.send_json({"type": "status", "payload": {"state": "composing"}})

    # Save module to database
    module_name = module_spec.get("name", "Unnamed Module")
    # Enforce reasonable name length (LLM output can be unpredictable)
    if len(module_name) > 200:
        module_name = module_name[:200]
    saved = await create_module(db_path, module_name, module_spec)

    # Build the wire-format payload (snake_case) with server-generated id
    wire_spec = {**module_spec, "module_id": saved["id"]}

    # Send module_created message — module is already persisted at this point,
    # so WS send failure should not be reported as MODULE_CREATION_FAILED
    try:
        await ws.send_json({
            "type": "module_created",
            "payload": wire_spec,
        })
    except Exception as ws_err:
        log.warning(
            "module_created_ws_send_failed",
            module_id=saved["id"],
            module_name=module_name,
            error=str(ws_err),
            agent_action="Module was saved to DB but the WS notification failed. "
            "The module will appear on next sync.",
        )
        # Don't re-raise — the module IS created, just the notification failed

    log.info(
        "module_creation_complete",
        module_id=saved["id"],
        module_name=module_name,
    )


async def handle_chat(
    ws: WebSocket,
    message: str,
    provider: LLMProvider,
    db_path: str,
) -> None:
    """Handle a chat message: call LLM provider and stream response back.

    Detects module creation intent from LLM response (JSON code fence).
    If module spec found: validates, saves to DB, sends module_created.
    If no spec found: sends response as regular chat_stream.

    Status sequence:
      - Regular chat: thinking -> chat_stream -> idle
      - Module creation: thinking -> discovering -> composing -> module_created -> idle
      - Error: thinking -> error -> idle

    Sends status:idle in finally block (always, even on error).

    Args:
        ws:       WebSocket — the sole communication channel (from main.py)
        message:  The user's chat message text
        provider: LLM provider instance (obtained via get_provider() in main.py)
        db_path:  Path to SQLite database for llm_usage logging
    """
    # Always notify thinking state before calling provider
    await ws.send_json({"type": "status", "payload": {"state": "thinking"}})

    try:
        # Load agent identity from SOUL.md (read on every request, no caching)
        data_dir = str(Path(db_path).parent)
        soul_content = await load_soul(data_dir)

        # Build prompt with SOUL identity and module creation instructions
        prompt = _build_module_prompt(message, soul_content)

        # Call provider with the enriched prompt
        result = await provider.execute(prompt=prompt)

        # Check if response contains a module spec
        spec_result = _try_extract_module_spec(result.content)

        if spec_result.spec is not None:
            # Module creation pipeline — valid spec found
            try:
                await _handle_module_creation(ws, result, spec_result.spec, db_path)
            except Exception as e:
                log.error(
                    "module_creation_failed",
                    module_name=spec_result.spec.get("name", "unknown"),
                    error=str(e),
                    agent_action="Check LLM output format. Expected valid JSON with fields: "
                    "name, type, template, data_sources, refresh_interval, schema_version, accessible_label",
                )
                await ws.send_json({
                    "type": "error",
                    "payload": {
                        "code": "MODULE_CREATION_FAILED",
                        "message": f"Module creation failed: {e}",
                        "agent_action": "Check LLM output format. Expected valid JSON with fields: "
                        "name, type, template, data_sources, refresh_interval, schema_version, accessible_label",
                    },
                })
        elif spec_result.has_code_fence and spec_result.error:
            # JSON code fence found but invalid — this is a module creation failure
            log.error(
                "module_creation_failed",
                error=spec_result.error,
                agent_action="Check LLM output format. Expected valid JSON with fields: "
                "name, type, template, data_sources, refresh_interval, schema_version, accessible_label",
            )
            # Still send the conversational text portion
            chat_text = _extract_chat_text(result.content)
            if chat_text:
                await ws.send_json({
                    "type": "chat_stream",
                    "payload": {"delta": chat_text, "done": False},
                })
                await ws.send_json({
                    "type": "chat_stream",
                    "payload": {"delta": "", "done": True},
                })
            await ws.send_json({
                "type": "error",
                "payload": {
                    "code": "MODULE_CREATION_FAILED",
                    "message": f"Module spec validation failed: {spec_result.error}",
                    "agent_action": "Check LLM output format. Expected valid JSON with fields: "
                    "name, type, template, data_sources, refresh_interval, schema_version, accessible_label",
                },
            })
        else:
            # Regular chat — no JSON code fence, send full response as stream
            await ws.send_json({
                "type": "chat_stream",
                "payload": {"delta": result.content, "done": False},
            })
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
            has_module=spec_result.spec is not None,
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
