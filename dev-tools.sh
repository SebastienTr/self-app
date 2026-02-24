#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════
# dev-tools.sh — Dev agent helper for autonomous testing & debugging
#
# Commands:
#   screenshot         Capture device screenshot to .run/
#   logs               Dump mobile JS logs (ReactNativeJS)
#   logs --backend     Show backend uvicorn log
#   status             Check backend health, Metro, adb device
#   device-info        Show connected device details
#   clear-logs         Clear logcat buffer
#   --help             Show usage
#
# Architecture: Standalone shell script, no backend dependencies.
# Screenshots are saved to .run/ (already gitignored).
# ═══════════════════════════════════════════════════════════════════════

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# ── Colors ──────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
CYAN=$'\033[0;36m'
YELLOW=$'\033[1;33m'
BOLD=$'\033[1m'
NC=$'\033[0m'

log()     { echo -e "${CYAN}[dev-tools]${NC} $*"; }
log_ok()  { echo -e "${CYAN}[dev-tools]${NC} ${GREEN}$*${NC}"; }
log_err() { echo -e "${CYAN}[dev-tools]${NC} ${RED}$*${NC}"; }
log_warn(){ echo -e "${CYAN}[dev-tools]${NC} ${YELLOW}$*${NC}"; }

# ── Helpers ─────────────────────────────────────────────────────────
require_adb() {
  if ! command -v adb &>/dev/null; then
    log_err "adb not found. Install Android SDK platform-tools."
    exit 1
  fi
}

require_device() {
  require_adb
  if ! adb devices 2>/dev/null | grep -q 'device$'; then
    log_err "No Android device/emulator connected."
    log_err "Connect a device or start an emulator, then retry."
    exit 1
  fi
}

mkdir -p "$RUN_DIR"

# ── Commands ─────────────────────────────────────────────────────────

cmd_screenshot() {
  require_device
  local timestamp
  timestamp=$(date +%Y%m%dT%H%M%S)
  local filename="screenshot-${timestamp}.png"
  local filepath="$RUN_DIR/$filename"

  log "Capturing screenshot..."
  adb exec-out screencap -p > "$filepath"

  # Validate the capture produced a valid PNG
  if [[ -f "$filepath" ]] && [[ $(stat -f%z "$filepath" 2>/dev/null || stat --printf="%s" "$filepath" 2>/dev/null) -gt 100 ]]; then
    log_ok "Screenshot saved: .run/$filename"
    echo ".run/$filename"
  else
    log_err "Screenshot capture failed (empty or missing file)"
    rm -f "$filepath"
    exit 1
  fi
}

cmd_logs() {
  local backend_mode=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --backend) backend_mode=true; shift ;;
      --errors)
        require_device
        log "Fetching error logs..."
        adb logcat -d -s ReactNativeJS:V -e "Error|Exception|FATAL" 2>/dev/null || true
        return
        ;;
      *) shift ;;
    esac
  done

  if $backend_mode; then
    # Show backend logs from self.sh output
    local backend_pid_file="$RUN_DIR/backend.pid"
    if [[ -f "$backend_pid_file" ]]; then
      local pid
      pid=$(cat "$backend_pid_file")
      if kill -0 "$pid" 2>/dev/null; then
        log "Backend (PID $pid) is running. Recent uvicorn output:"
        # Try to read from log file if available, otherwise show process info
        if [[ -f "$RUN_DIR/backend.log" ]]; then
          tail -50 "$RUN_DIR/backend.log"
        else
          log_warn "No backend.log file found (self.sh streams to stdout)"
          log "Tip: Redirect with ./self.sh 2>&1 | tee .run/backend.log"
        fi
      else
        log_warn "Backend process (PID $pid) is not running"
      fi
    else
      log_warn "No backend PID file found. Is the backend running via ./self.sh?"
    fi
    return
  fi

  # Default: mobile JS logs
  require_device
  log "Fetching mobile JS logs..."
  adb logcat -d -v time -s ReactNativeJS:V 2>/dev/null || true
}

cmd_status() {
  echo -e "${BOLD}Dev Environment Status${NC}"
  echo "─────────────────────────────────────────"

  # Backend health (single request to avoid race condition)
  local health_json
  if health_json=$(curl -sf "http://localhost:$BACKEND_PORT/health" 2>/dev/null); then
    echo -e "  Backend:    ${GREEN}healthy${NC}"
    echo -e "  Health:     $health_json"
  else
    echo -e "  Backend:    ${RED}not reachable${NC} (port $BACKEND_PORT)"
  fi

  # Metro bundler
  if curl -sf "http://localhost:8081/status" > /dev/null 2>&1; then
    echo -e "  Metro:      ${GREEN}running${NC} (port 8081)"
  else
    echo -e "  Metro:      ${RED}not reachable${NC} (port 8081)"
  fi

  # ADB device
  if command -v adb &>/dev/null; then
    local devices
    devices=$(adb devices 2>/dev/null | grep 'device$' | wc -l | tr -d ' ')
    if [[ "$devices" -gt 0 ]]; then
      echo -e "  Device:     ${GREEN}${devices} connected${NC}"
      adb devices 2>/dev/null | grep 'device$' | while read -r line; do
        echo "              $line"
      done
    else
      echo -e "  Device:     ${YELLOW}no device connected${NC}"
    fi
  else
    echo -e "  Device:     ${RED}adb not installed${NC}"
  fi

  # PID files
  echo "─────────────────────────────────────────"
  for pidfile in "$RUN_DIR/backend.pid" "$RUN_DIR/mobile.pid" "$RUN_DIR/tunnel-backend.pid"; do
    if [[ -f "$pidfile" ]]; then
      local name pid
      name=$(basename "$pidfile" .pid)
      pid=$(cat "$pidfile")
      if kill -0 "$pid" 2>/dev/null; then
        echo -e "  PID ${name}: ${GREEN}${pid} (running)${NC}"
      else
        echo -e "  PID ${name}: ${YELLOW}${pid} (stale)${NC}"
      fi
    fi
  done

  echo "─────────────────────────────────────────"
}

cmd_device_info() {
  require_device
  echo -e "${BOLD}Device Information${NC}"
  echo "─────────────────────────────────────────"

  echo -e "  ${BOLD}Connected devices:${NC}"
  adb devices 2>/dev/null | grep 'device$' | while read -r line; do
    echo "    $line"
  done

  echo ""
  echo -e "  ${BOLD}Screen resolution:${NC}"
  local size
  size=$(adb shell wm size 2>/dev/null || echo "unknown")
  echo "    $size"

  echo ""
  echo -e "  ${BOLD}Screen density:${NC}"
  local density
  density=$(adb shell wm density 2>/dev/null || echo "unknown")
  echo "    $density"

  echo ""
  echo -e "  ${BOLD}Android version:${NC}"
  local version
  version=$(adb shell getprop ro.build.version.release 2>/dev/null || echo "unknown")
  echo "    $version"

  echo ""
  echo -e "  ${BOLD}Device model:${NC}"
  local model
  model=$(adb shell getprop ro.product.model 2>/dev/null || echo "unknown")
  echo "    $model"

  echo "─────────────────────────────────────────"
}

cmd_clear_logs() {
  require_device
  log "Clearing logcat buffer..."
  adb logcat -c
  log_ok "Logcat buffer cleared"
}

show_help() {
  echo "Usage: ./dev-tools.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  screenshot         Capture device screenshot to .run/"
  echo "  logs               Dump mobile JS logs (ReactNativeJS)"
  echo "  logs --backend     Show backend uvicorn log"
  echo "  logs --errors      Show JS error logs only"
  echo "  status             Check backend health, Metro, adb device"
  echo "  device-info        Show connected device details"
  echo "  clear-logs         Clear logcat buffer"
  echo ""
  echo "Options:"
  echo "  --help             Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./dev-tools.sh screenshot          # Save screenshot to .run/"
  echo "  ./dev-tools.sh logs                # Dump JS logs"
  echo "  ./dev-tools.sh logs --backend      # Show backend logs"
  echo "  ./dev-tools.sh status              # Check all services"
  echo "  ./dev-tools.sh device-info         # Device screen size, density"
  echo "  ./dev-tools.sh clear-logs          # Clear logcat before test"
}

# ── Main dispatch ───────────────────────────────────────────────────
if [[ $# -eq 0 ]]; then
  show_help
  exit 1
fi

case "$1" in
  screenshot)   shift; cmd_screenshot "$@" ;;
  logs)         shift; cmd_logs "$@" ;;
  status)       cmd_status ;;
  device-info)  cmd_device_info ;;
  clear-logs)   cmd_clear_logs ;;
  --help|-h)    show_help ;;
  *)            log_err "Unknown command: $1"; show_help; exit 1 ;;
esac
