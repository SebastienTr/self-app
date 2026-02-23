"""Kimi CLI provider — wraps the `kimi` CLI binary.

Command: kimi --print -p "prompt" --output-format=stream-json
Output: JSONL stream stdout.
"""

import json

from app.llm.base import CLIProvider, LLMResult


class KimiCLI(CLIProvider):
    """Kimi CLI provider using `kimi` binary."""

    name = "kimi-cli"
    _cli_binary = "kimi"

    def _build_command(self, prompt: str) -> list[str]:
        return ["kimi", "--print", "-p", prompt, "--output-format=stream-json"]

    def _parse_output(self, stdout: str) -> LLMResult:
        # JSONL stream: take the last non-empty line as the final result
        lines = [line.strip() for line in stdout.strip().splitlines() if line.strip()]
        data = json.loads(lines[-1]) if lines else {}
        return LLMResult(
            content=data.get("content", ""),
            provider=self.name,
            model=data.get("model", "unknown"),
            tokens_in=data.get("tokens_in"),
            tokens_out=data.get("tokens_out"),
            latency_ms=0,  # Set by CLIProvider.execute()
            cost_estimate=None,
        )
