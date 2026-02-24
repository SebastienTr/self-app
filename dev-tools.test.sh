#!/usr/bin/env bash
# TDD tests for dev-tools.sh
# Run: bash dev-tools.test.sh
#
# Tests validate each command in dev-tools.sh:
#   1. screenshot — produces valid PNG file
#   2. logs — returns structured output
#   3. status — returns connection state info
#   4. device-info — returns device information
#   5. clear-logs — runs without error
#   6. help — shows usage info

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEV_TOOLS="$ROOT_DIR/dev-tools.sh"
PASS=0
FAIL=0
SKIP=0

# ── Helpers ──────────────────────────────────────────────────────────
GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}FAIL${NC} $1 — $2"; ((FAIL++)); }
skip() { echo -e "  ${YELLOW}SKIP${NC} $1 — $2"; ((SKIP++)); }

has_adb() { command -v adb &>/dev/null; }
has_device() { has_adb && adb devices 2>/dev/null | grep -q 'device$'; }

echo "═══════════════════════════════════════════════"
echo " dev-tools.sh — Test Suite"
echo "═══════════════════════════════════════════════"
echo ""

# ── Test 0: Script exists and is executable ─────────────────────────
echo "▸ Script existence"
if [[ -f "$DEV_TOOLS" ]]; then
  pass "dev-tools.sh exists"
else
  fail "dev-tools.sh exists" "File not found at $DEV_TOOLS"
fi

if [[ -x "$DEV_TOOLS" ]]; then
  pass "dev-tools.sh is executable"
else
  fail "dev-tools.sh is executable" "Missing execute permission"
fi

# ── Test 1: Help flag shows usage ──────────────────────────────────
echo ""
echo "▸ help command"
HELP_OUTPUT=$("$DEV_TOOLS" --help 2>&1) || true
if echo "$HELP_OUTPUT" | grep -qi "usage\|commands\|screenshot\|logs\|status"; then
  pass "--help shows usage information"
else
  fail "--help shows usage information" "Output: $HELP_OUTPUT"
fi

# ── Test 2: Screenshot command ──────────────────────────────────────
echo ""
echo "▸ screenshot command"
if has_device; then
  SCREENSHOT_OUTPUT=$("$DEV_TOOLS" screenshot 2>&1)
  SCREENSHOT_EXIT=$?

  if [[ $SCREENSHOT_EXIT -eq 0 ]]; then
    pass "screenshot command exits successfully"
  else
    fail "screenshot command exits successfully" "Exit code: $SCREENSHOT_EXIT"
  fi

  # Extract file path from output
  SCREENSHOT_PATH=$(echo "$SCREENSHOT_OUTPUT" | grep -oE '\.run/screenshot-[0-9T-]+\.png' | head -1)
  if [[ -n "$SCREENSHOT_PATH" ]]; then
    FULL_PATH="$ROOT_DIR/$SCREENSHOT_PATH"
    if [[ -f "$FULL_PATH" ]]; then
      pass "screenshot file was created"

      # Validate PNG magic bytes (first 8 bytes: 89 50 4E 47 0D 0A 1A 0A)
      MAGIC=$(xxd -p -l 4 "$FULL_PATH")
      if [[ "$MAGIC" == "89504e47" ]]; then
        pass "screenshot is valid PNG (magic bytes match)"
      else
        fail "screenshot is valid PNG" "Magic bytes: $MAGIC (expected 89504e47)"
      fi

      # Check file size > 0
      FILE_SIZE=$(stat -f%z "$FULL_PATH" 2>/dev/null || stat --printf="%s" "$FULL_PATH" 2>/dev/null)
      if [[ "$FILE_SIZE" -gt 1000 ]]; then
        pass "screenshot file has reasonable size (${FILE_SIZE} bytes)"
      else
        fail "screenshot file has reasonable size" "Only ${FILE_SIZE} bytes"
      fi

      # Clean up test screenshot
      rm -f "$FULL_PATH"
    else
      fail "screenshot file was created" "File not found at $FULL_PATH"
    fi
  else
    fail "screenshot outputs file path" "No path in output: $SCREENSHOT_OUTPUT"
  fi
else
  skip "screenshot command" "No adb device connected"
fi

# ── Test 3: Logs command ─────────────────────────────────────────────
echo ""
echo "▸ logs command"
if has_device; then
  LOGS_OUTPUT=$("$DEV_TOOLS" logs 2>&1)
  LOGS_EXIT=$?

  if [[ $LOGS_EXIT -eq 0 ]]; then
    pass "logs command exits successfully"
  else
    fail "logs command exits successfully" "Exit code: $LOGS_EXIT"
  fi

  # The logs command should not hang (it uses -d flag for dump-and-exit)
  # If we got here, it didn't hang — that's a pass
  pass "logs command does not block (uses -d flag)"
else
  skip "logs command" "No adb device connected"
fi

# ── Test 4: Status command ───────────────────────────────────────────
echo ""
echo "▸ status command"
STATUS_OUTPUT=$("$DEV_TOOLS" status 2>&1)
STATUS_EXIT=$?

if [[ $STATUS_EXIT -eq 0 ]]; then
  pass "status command exits successfully"
else
  fail "status command exits successfully" "Exit code: $STATUS_EXIT"
fi

# Status should report on backend and device
if echo "$STATUS_OUTPUT" | grep -qi "backend\|health\|device\|metro"; then
  pass "status reports connection state"
else
  fail "status reports connection state" "Missing expected keywords in: $STATUS_OUTPUT"
fi

# ── Test 5: Device info command ─────────────────────────────────────
echo ""
echo "▸ device-info command"
if has_device; then
  DEVICE_OUTPUT=$("$DEV_TOOLS" device-info 2>&1)
  DEVICE_EXIT=$?

  if [[ $DEVICE_EXIT -eq 0 ]]; then
    pass "device-info command exits successfully"
  else
    fail "device-info command exits successfully" "Exit code: $DEVICE_EXIT"
  fi

  if echo "$DEVICE_OUTPUT" | grep -qi "device\|size\|density\|resolution"; then
    pass "device-info outputs device details"
  else
    fail "device-info outputs device details" "Output: $DEVICE_OUTPUT"
  fi
else
  skip "device-info command" "No adb device connected"
fi

# ── Test 6: Clear-logs command ──────────────────────────────────────
echo ""
echo "▸ clear-logs command"
if has_device; then
  CLEAR_OUTPUT=$("$DEV_TOOLS" clear-logs 2>&1)
  CLEAR_EXIT=$?

  if [[ $CLEAR_EXIT -eq 0 ]]; then
    pass "clear-logs command exits successfully"
  else
    fail "clear-logs command exits successfully" "Exit code: $CLEAR_EXIT"
  fi
else
  skip "clear-logs command" "No adb device connected"
fi

# ── Test 7: Unknown command shows error ─────────────────────────────
echo ""
echo "▸ error handling"
UNKNOWN_OUTPUT=$("$DEV_TOOLS" nonexistent-command 2>&1)
UNKNOWN_EXIT=$?

if [[ $UNKNOWN_EXIT -ne 0 ]]; then
  pass "unknown command exits with non-zero"
else
  fail "unknown command exits with non-zero" "Exit code was 0"
fi

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo -e " Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${SKIP} skipped${NC}"
echo "═══════════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
