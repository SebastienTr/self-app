"""Codex CLI provider — wraps the `codex` CLI binary.

Command: codex exec "prompt" --json
Output: JSONL stdout.
"""

import json

from app.llm.base import CLIProvider, LLMResult


class CodexCLI(CLIProvider):
    """Codex CLI provider using `codex` binary."""

    name = "codex-cli"
    _cli_binary = "codex"

    def _build_command(self, prompt: str) -> list[str]:
        return ["codex", "exec", prompt, "--json"]

    def _parse_output(self, stdout: str) -> LLMResult:
        # JSONL: take the last non-empty line as the final result
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
