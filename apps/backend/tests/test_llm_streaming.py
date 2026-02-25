"""Tests for LLM streaming support — Story 4.0, Task 1.

Tests:
  - LLMStreamChunk dataclass fields
  - CLIProvider default stream() yields single chunk from execute()
  - AnthropicAPI.stream() yields chunks (mocked SDK)
  - DeepSeekAPI.stream() yields chunks (mocked SDK)
  - Accumulated text tracking across chunks
  - Final metadata on last chunk (done=True)
  - Fallback behavior: CLI providers yield exactly one chunk
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.llm.base import CLIProvider, LLMResult, LLMStreamChunk


class TestLLMStreamChunk:
    """Tests for LLMStreamChunk dataclass."""

    def test_chunk_has_required_fields(self):
        """LLMStreamChunk has delta, accumulated, and done fields."""
        chunk = LLMStreamChunk(delta="Hello", accumulated="Hello", done=False)
        assert chunk.delta == "Hello"
        assert chunk.accumulated == "Hello"
        assert chunk.done is False

    def test_final_chunk_has_metadata(self):
        """Final chunk (done=True) carries metadata fields."""
        chunk = LLMStreamChunk(
            delta="",
            accumulated="Full response",
            done=True,
            tokens_in=10,
            tokens_out=20,
            model="test-model",
            provider="test-provider",
            latency_ms=500,
        )
        assert chunk.done is True
        assert chunk.tokens_in == 10
        assert chunk.tokens_out == 20
        assert chunk.model == "test-model"
        assert chunk.provider == "test-provider"
        assert chunk.latency_ms == 500

    def test_non_final_chunk_has_none_metadata(self):
        """Non-final chunks have None metadata by default."""
        chunk = LLMStreamChunk(delta="Hi", accumulated="Hi", done=False)
        assert chunk.tokens_in is None
        assert chunk.tokens_out is None
        assert chunk.model is None
        assert chunk.provider is None
        assert chunk.latency_ms is None


class _StubCLIProvider(CLIProvider):
    """Concrete CLIProvider for testing default stream()."""

    name = "stub-cli"
    _cli_binary = "echo"
    _timeout = 5

    def _build_command(self, prompt: str) -> list[str]:
        return ["echo", prompt]

    def _parse_output(self, stdout: str) -> LLMResult:
        return LLMResult(
            content=stdout.strip(),
            provider=self.name,
            model="stub-model",
            tokens_in=5,
            tokens_out=10,
            latency_ms=0,
            cost_estimate=None,
        )


class TestCLIProviderDefaultStream:
    """Tests for CLIProvider.stream() default implementation."""

    @pytest.mark.asyncio
    async def test_stream_yields_single_chunk(self):
        """Default stream() yields exactly one chunk from execute()."""
        provider = _StubCLIProvider()
        provider.execute = AsyncMock(
            return_value=LLMResult(
                content="CLI response text",
                provider="stub-cli",
                model="stub-model",
                tokens_in=5,
                tokens_out=10,
                latency_ms=42,
                cost_estimate=None,
            )
        )

        chunks = []
        async for chunk in provider.stream("test prompt"):
            chunks.append(chunk)

        assert len(chunks) == 1
        assert chunks[0].delta == "CLI response text"
        assert chunks[0].accumulated == "CLI response text"
        assert chunks[0].done is True

    @pytest.mark.asyncio
    async def test_stream_final_chunk_has_metadata(self):
        """Default stream() final chunk carries metadata from execute() result."""
        provider = _StubCLIProvider()
        provider.execute = AsyncMock(
            return_value=LLMResult(
                content="Response",
                provider="stub-cli",
                model="stub-model",
                tokens_in=15,
                tokens_out=25,
                latency_ms=100,
                cost_estimate=0.001,
            )
        )

        chunks = []
        async for chunk in provider.stream("prompt"):
            chunks.append(chunk)

        final = chunks[0]
        assert final.tokens_in == 15
        assert final.tokens_out == 25
        assert final.model == "stub-model"
        assert final.provider == "stub-cli"
        assert final.latency_ms == 100

    @pytest.mark.asyncio
    async def test_stream_backward_compatible_with_execute(self):
        """stream() and execute() produce equivalent content for CLI providers."""
        provider = _StubCLIProvider()
        expected_content = "Backward compatible content"
        provider.execute = AsyncMock(
            return_value=LLMResult(
                content=expected_content,
                provider="stub-cli",
                model="stub-model",
                tokens_in=5,
                tokens_out=10,
                latency_ms=42,
                cost_estimate=None,
            )
        )

        chunks = []
        async for chunk in provider.stream("test"):
            chunks.append(chunk)

        assert chunks[0].accumulated == expected_content


class TestAnthropicAPIStream:
    """Tests for AnthropicAPI.stream() method."""

    @pytest.mark.asyncio
    async def test_stream_yields_chunks(self):
        """AnthropicAPI.stream() yields chunks from SDK stream."""
        mock_client = MagicMock()

        # Mock text_stream as async iterator
        async def fake_text_stream():
            yield "Hello"
            yield " world"
            yield "!"

        # Mock final message with usage
        mock_final_message = MagicMock()
        mock_final_message.usage.input_tokens = 10
        mock_final_message.usage.output_tokens = 20
        mock_final_message.model = "claude-sonnet-4-20250514"

        # Build async context manager for stream
        mock_stream_obj = MagicMock()
        mock_stream_obj.text_stream = fake_text_stream()
        mock_stream_obj.get_final_message.return_value = mock_final_message

        class FakeStreamCM:
            async def __aenter__(self):
                return mock_stream_obj

            async def __aexit__(self, *args):
                return False

        mock_client.messages.stream.return_value = FakeStreamCM()

        from app.llm.api_anthropic import AnthropicAPI
        provider = AnthropicAPI.__new__(AnthropicAPI)
        provider._client = mock_client
        provider._model = "claude-sonnet-4-20250514"
        provider.name = "anthropic-api"

        chunks = []
        async for chunk in provider.stream("test"):
            chunks.append(chunk)

        # Should have 3 content chunks + 1 final
        assert len(chunks) == 4
        assert chunks[0].delta == "Hello"
        assert chunks[0].accumulated == "Hello"
        assert chunks[0].done is False
        assert chunks[1].delta == " world"
        assert chunks[1].accumulated == "Hello world"
        assert chunks[1].done is False
        assert chunks[2].delta == "!"
        assert chunks[2].accumulated == "Hello world!"
        assert chunks[2].done is False
        # Final chunk
        assert chunks[3].delta == ""
        assert chunks[3].accumulated == "Hello world!"
        assert chunks[3].done is True
        assert chunks[3].tokens_in == 10
        assert chunks[3].tokens_out == 20


class TestDeepSeekAPIStream:
    """Tests for DeepSeekAPI.stream() method."""

    @pytest.mark.asyncio
    async def test_stream_yields_chunks(self):
        """DeepSeekAPI.stream() yields chunks from OpenAI-compatible stream."""
        with patch("app.llm.api_deepseek.openai") as mock_openai:
            mock_client = AsyncMock()
            mock_openai.AsyncOpenAI.return_value = mock_client

            # Create mock stream chunks
            def make_chunk(content, finish_reason=None, usage=None):
                chunk = MagicMock()
                choice = MagicMock()
                choice.delta.content = content
                choice.finish_reason = finish_reason
                chunk.choices = [choice]
                chunk.usage = usage
                chunk.model = "deepseek-chat"
                return chunk

            mock_usage = MagicMock()
            mock_usage.prompt_tokens = 15
            mock_usage.completion_tokens = 25

            stream_chunks = [
                make_chunk("Deep"),
                make_chunk("Seek"),
                make_chunk(" response"),
                make_chunk(None, finish_reason="stop", usage=mock_usage),
            ]

            # Make it an async iterator
            async def fake_stream():
                for c in stream_chunks:
                    yield c

            mock_client.chat.completions.create.return_value = fake_stream()

            from app.llm.api_deepseek import DeepSeekAPI
            provider = DeepSeekAPI.__new__(DeepSeekAPI)
            provider._client = mock_client
            provider._model = "deepseek-chat"
            provider.name = "deepseek-api"

            chunks = []
            async for chunk in provider.stream("test"):
                chunks.append(chunk)

            # 3 content chunks + 1 final
            assert len(chunks) == 4
            assert chunks[0].delta == "Deep"
            assert chunks[0].accumulated == "Deep"
            assert chunks[0].done is False
            assert chunks[1].delta == "Seek"
            assert chunks[1].accumulated == "DeepSeek"
            assert chunks[2].delta == " response"
            assert chunks[2].accumulated == "DeepSeek response"
            # Final
            assert chunks[3].done is True
            assert chunks[3].tokens_in == 15
            assert chunks[3].tokens_out == 25
