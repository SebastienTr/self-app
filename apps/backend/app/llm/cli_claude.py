"""Claude Code CLI provider — wraps the `claude` CLI binary.

Command: claude -p "prompt" --output-format json
Output: JSON stdout with result, model, token counts.
"""

import json

from app.llm.base import CLIProvider, LLMResult


class ClaudeCodeCLI(CLIProvider):
    """Claude Code CLI provider using `claude` binary."""

    name = "claude-cli"
    _cli_binary = "claude"

    def _build_command(self, prompt: str) -> list[str]:
        return ["claude", "-p", prompt, "--output-format", "json", "--model", "claude-sonnet-4-6"]

    def _parse_output(self, stdout: str) -> LLMResult:
        data = json.loads(stdout)
        return LLMResult(
            content=data.get("result", ""),
            provider=self.name,
            model=data.get("model", "unknown"),
            tokens_in=data.get("tokens_in"),
            tokens_out=data.get("tokens_out"),
            latency_ms=0,  # Set by CLIProvider.execute()
            cost_estimate=None,
        )
