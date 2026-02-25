"""HTTP data fetching for module data sources.

Iterates over a module's dataSources array and fetches each one.
For V1, only type 'http_json' (GET request, parse JSON) is supported.
Other types log a warning and skip.

Returns a merged dict keyed by data source id, or None if all fetches failed.
"""

import time

import httpx

from app.config import settings
from app.logging import log

# V1: Support both 'http_json' and 'rest_api' (agent LLM prompt uses 'rest_api')
_SUPPORTED_HTTP_TYPES = frozenset({"http_json", "rest_api"})


async def fetch_module_data(
    module: dict,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    timeout_seconds: int | None = None,
) -> dict | None:
    """Fetch data from all data sources defined in a module's spec.

    Args:
        module: Module dict with at least spec.data_sources.
        transport: Optional httpx transport for testing (MockTransport).
        timeout_seconds: Per-source HTTP timeout. Defaults to settings.self_refresh_timeout.

    Returns:
        Dict keyed by data source id with fetched data, or None if all failed.
        Partial success returns only the successful sources.
    """
    spec = module.get("spec", {})
    data_sources = spec.get("data_sources") or []
    module_id = module.get("id", "unknown")

    if not data_sources:
        log.info("data_fetch_no_sources", module_id=module_id)
        return None

    if timeout_seconds is None:
        timeout_seconds = settings.self_refresh_timeout

    results: dict = {}
    client_kwargs: dict = {"timeout": httpx.Timeout(timeout_seconds)}
    if transport is not None:
        client_kwargs["transport"] = transport

    async with httpx.AsyncClient(**client_kwargs) as client:
        for source in data_sources:
            source_id = source.get("id", "unknown")
            source_type = source.get("type", "")
            config = source.get("config", {})

            if source_type not in _SUPPORTED_HTTP_TYPES:
                log.warning(
                    "data_fetch_unsupported_type",
                    module_id=module_id,
                    data_source_id=source_id,
                    source_type=source_type,
                    agent_action=f"Data source type '{source_type}' not supported in V1. "
                    f"Supported types: {', '.join(sorted(_SUPPORTED_HTTP_TYPES))}.",
                )
                continue

            url = config.get("url", "")
            if not url:
                log.warning(
                    "data_fetch_no_url",
                    module_id=module_id,
                    data_source_id=source_id,
                    agent_action="Data source config missing 'url' field.",
                )
                continue

            start_ms = time.monotonic()
            log.info(
                "data_fetch_started",
                module_id=module_id,
                data_source_id=source_id,
                url=url,
            )

            try:
                response = await client.get(url)
                latency_ms = round((time.monotonic() - start_ms) * 1000)

                if response.status_code >= 400:
                    log.warning(
                        "data_fetch_failed",
                        module_id=module_id,
                        data_source_id=source_id,
                        http_status=response.status_code,
                        latency_ms=latency_ms,
                        error=f"HTTP {response.status_code}",
                        agent_action="Check data source URL and API availability.",
                    )
                    continue

                data = response.json()
                results[source_id] = data

                log.info(
                    "data_fetch_success",
                    module_id=module_id,
                    data_source_id=source_id,
                    latency_ms=latency_ms,
                )

            except httpx.TimeoutException as e:
                latency_ms = round((time.monotonic() - start_ms) * 1000)
                log.warning(
                    "data_fetch_failed",
                    module_id=module_id,
                    data_source_id=source_id,
                    latency_ms=latency_ms,
                    error=str(e),
                    agent_action="Data source timed out. Check NFR24 timeout config.",
                )

            except httpx.HTTPError as e:
                latency_ms = round((time.monotonic() - start_ms) * 1000)
                log.warning(
                    "data_fetch_failed",
                    module_id=module_id,
                    data_source_id=source_id,
                    latency_ms=latency_ms,
                    error=str(e),
                    agent_action="HTTP error during data fetch. Check network and URL.",
                )

            except ValueError as e:
                # JSON parse error
                latency_ms = round((time.monotonic() - start_ms) * 1000)
                log.warning(
                    "data_fetch_failed",
                    module_id=module_id,
                    data_source_id=source_id,
                    latency_ms=latency_ms,
                    error=f"JSON parse error: {e}",
                    agent_action="Data source returned non-JSON response.",
                )

    return results if results else None
