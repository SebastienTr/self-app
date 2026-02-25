"""Tests for data_fetch.py — HTTP data fetching for module data sources.

Tests fetch_module_data with mocked httpx responses for:
  - Success: single source, multiple sources
  - Timeout: per-source timeout (NFR24)
  - Error: HTTP 4xx/5xx, network errors
  - Partial success: some sources ok, some failed
  - Unsupported type: non-http_json types log warning and skip
  - No data sources: returns None
"""

import pytest
import httpx

from app.data_fetch import fetch_module_data


def _make_module(data_sources, refresh_interval=3600):
    """Helper to build a module dict with data_sources."""
    return {
        "id": "mod-test-1",
        "name": "Test Module",
        "spec": {
            "name": "Test Module",
            "type": "metric",
            "data_sources": data_sources,
            "refresh_interval": refresh_interval,
        },
    }


def _http_json_source(source_id="src-1", url="https://api.example.com/data"):
    """Helper to build an http_json data source."""
    return {
        "id": source_id,
        "type": "http_json",
        "config": {"url": url, "method": "GET"},
    }


class TestFetchModuleDataSuccess:
    """Success scenarios for fetch_module_data."""

    @pytest.mark.asyncio
    async def test_single_source_returns_parsed_json(self):
        """Single http_json source returns parsed JSON data."""
        source = _http_json_source("weather", "https://api.example.com/weather")
        module = _make_module([source])

        async def mock_handler(request):
            return httpx.Response(200, json={"temperature": 22, "wind": 5})

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is not None
        assert result["weather"] == {"temperature": 22, "wind": 5}

    @pytest.mark.asyncio
    async def test_multiple_sources_merged(self):
        """Multiple http_json sources are merged into a single dict."""
        sources = [
            _http_json_source("weather", "https://api.example.com/weather"),
            _http_json_source("air", "https://api.example.com/air"),
        ]
        module = _make_module(sources)

        responses = {
            "https://api.example.com/weather": {"temp": 20},
            "https://api.example.com/air": {"aqi": 42},
        }

        async def mock_handler(request):
            url = str(request.url)
            return httpx.Response(200, json=responses.get(url, {}))

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is not None
        assert result["weather"] == {"temp": 20}
        assert result["air"] == {"aqi": 42}


class TestFetchModuleDataTimeout:
    """Timeout scenarios for fetch_module_data."""

    @pytest.mark.asyncio
    async def test_timeout_returns_none_for_timed_out_source(self):
        """A source that times out is treated as failed."""
        source = _http_json_source("slow", "https://api.example.com/slow")
        module = _make_module([source])

        async def mock_handler(request):
            raise httpx.ReadTimeout("timed out")

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport, timeout_seconds=1)

        # All sources failed → returns None
        assert result is None


class TestFetchModuleDataErrors:
    """Error scenarios for fetch_module_data."""

    @pytest.mark.asyncio
    async def test_http_500_returns_none(self):
        """HTTP 500 response treated as failure."""
        source = _http_json_source("api", "https://api.example.com/broken")
        module = _make_module([source])

        async def mock_handler(request):
            return httpx.Response(500, text="Internal Server Error")

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is None

    @pytest.mark.asyncio
    async def test_http_404_returns_none(self):
        """HTTP 404 response treated as failure."""
        source = _http_json_source("api", "https://api.example.com/missing")
        module = _make_module([source])

        async def mock_handler(request):
            return httpx.Response(404, text="Not Found")

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is None

    @pytest.mark.asyncio
    async def test_network_error_returns_none(self):
        """Network connectivity error treated as failure."""
        source = _http_json_source("api", "https://api.example.com/data")
        module = _make_module([source])

        async def mock_handler(request):
            raise httpx.ConnectError("Connection refused")

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_json_response_returns_none(self):
        """Non-JSON response body treated as failure."""
        source = _http_json_source("api", "https://api.example.com/data")
        module = _make_module([source])

        async def mock_handler(request):
            return httpx.Response(200, text="not json at all")

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is None


class TestFetchModuleDataPartial:
    """Partial success: some sources ok, some failed."""

    @pytest.mark.asyncio
    async def test_partial_success_returns_successful_data(self):
        """When some sources succeed and some fail, return the successful data."""
        sources = [
            _http_json_source("good", "https://api.example.com/good"),
            _http_json_source("bad", "https://api.example.com/bad"),
        ]
        module = _make_module(sources)

        async def mock_handler(request):
            url = str(request.url)
            if "good" in url:
                return httpx.Response(200, json={"value": 42})
            return httpx.Response(500, text="Error")

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is not None
        assert result["good"] == {"value": 42}
        assert "bad" not in result


class TestFetchModuleDataUnsupportedType:
    """Unsupported data source types."""

    @pytest.mark.asyncio
    async def test_unsupported_type_skipped(self):
        """Non-http_json types are skipped with a warning."""
        sources = [
            {"id": "rss", "type": "rss", "config": {"url": "https://example.com/feed"}},
        ]
        module = _make_module(sources)

        # No transport needed since no HTTP calls should be made
        result = await fetch_module_data(module)

        assert result is None

    @pytest.mark.asyncio
    async def test_mixed_types_only_fetches_supported(self):
        """Only http_json sources are fetched; others are skipped."""
        sources = [
            _http_json_source("json", "https://api.example.com/data"),
            {"id": "graphql", "type": "graphql", "config": {"url": "https://api.example.com/gql"}},
        ]
        module = _make_module(sources)

        async def mock_handler(request):
            return httpx.Response(200, json={"data": "ok"})

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is not None
        assert result["json"] == {"data": "ok"}
        assert "graphql" not in result


class TestFetchModuleDataRestApiType:
    """Support for rest_api type (used by LLM agent prompt)."""

    @pytest.mark.asyncio
    async def test_rest_api_type_is_supported(self):
        """rest_api data source type is treated same as http_json (GET + JSON)."""
        source = {
            "id": "openmeteo",
            "type": "rest_api",
            "config": {"url": "https://api.open-meteo.com/v1/forecast", "method": "GET"},
        }
        module = _make_module([source])

        async def mock_handler(request):
            return httpx.Response(200, json={"temperature": 22})

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is not None
        assert result["openmeteo"] == {"temperature": 22}

    @pytest.mark.asyncio
    async def test_rest_api_and_http_json_both_work(self):
        """Both rest_api and http_json types are supported simultaneously."""
        sources = [
            {"id": "s1", "type": "rest_api", "config": {"url": "https://api.example.com/a"}},
            {"id": "s2", "type": "http_json", "config": {"url": "https://api.example.com/b"}},
        ]
        module = _make_module(sources)

        responses = {
            "https://api.example.com/a": {"a": 1},
            "https://api.example.com/b": {"b": 2},
        }

        async def mock_handler(request):
            url = str(request.url)
            return httpx.Response(200, json=responses.get(url, {}))

        transport = httpx.MockTransport(mock_handler)
        result = await fetch_module_data(module, transport=transport)

        assert result is not None
        assert result["s1"] == {"a": 1}
        assert result["s2"] == {"b": 2}


class TestFetchModuleDataNoSources:
    """Edge case: no data sources."""

    @pytest.mark.asyncio
    async def test_empty_data_sources_returns_none(self):
        """Module with empty data_sources array returns None."""
        module = _make_module([])
        result = await fetch_module_data(module)
        assert result is None

    @pytest.mark.asyncio
    async def test_missing_data_sources_returns_none(self):
        """Module with no data_sources key returns None."""
        module = {"id": "mod-1", "name": "Test", "spec": {"name": "Test"}}
        result = await fetch_module_data(module)
        assert result is None
