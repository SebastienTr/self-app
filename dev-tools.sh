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
#   tap X Y            Simulate tap at screen coordinates
#   input-text TEXT     Type text into focused field
#   key KEYCODE         Send key event (BACK, HOME, ENTER, etc.)
#   swipe X1 Y1 X2 Y2  Swipe gesture (scroll, dismiss)
#   ui-tree             Dump UI accessibility tree (element hierarchy)
#   reload              Trigger React Native hot reload
#   emulator-start     Boot Android emulator (headless, no window)
#   emulator-stop      Kill the Android emulator
#   app-launch         All-in-one: emulator + backend + app on emulator
#   app-stop           Kill everything: self.sh + emulator
#   --help             Show usage
#
# Architecture: Standalone shell script, no backend dependencies.
# Screenshots are saved to .run/ (already gitignored).
# ═══════════════════════════════════════════════════════════════════════

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# ── Android SDK ───────────────────────────────────────────────────
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
AVD_NAME="self-app-dev"

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

# ── Interaction commands ──────────────────────────────────────────

cmd_tap() {
  require_device
  if [[ $# -lt 2 ]]; then
    log_err "Usage: ./dev-tools.sh tap <x> <y>"
    exit 1
  fi
  local x="$1" y="$2"
  adb shell input tap "$x" "$y"
  log_ok "Tapped at ($x, $y)"
}

cmd_input_text() {
  require_device
  if [[ $# -lt 1 ]]; then
    log_err "Usage: ./dev-tools.sh input-text <text>"
    exit 1
  fi
  local text="$1"
  # Replace spaces with %s for adb input (spaces are not supported directly)
  adb shell input text "${text// /%s}"
  log_ok "Typed: $text"
}

cmd_key() {
  require_device
  if [[ $# -lt 1 ]]; then
    log_err "Usage: ./dev-tools.sh key <KEYCODE>"
    log "Common keycodes: BACK, HOME, ENTER, DEL, TAB, DPAD_UP, DPAD_DOWN"
    exit 1
  fi
  local key="$1"
  # Allow short names without KEYCODE_ prefix
  if [[ "$key" != KEYCODE_* ]]; then
    key="KEYCODE_$key"
  fi
  adb shell input keyevent "$key"
  log_ok "Sent key: $key"
}

cmd_swipe() {
  require_device
  if [[ $# -lt 4 ]]; then
    log_err "Usage: ./dev-tools.sh swipe <x1> <y1> <x2> <y2> [duration_ms]"
    log "Example: ./dev-tools.sh swipe 540 1500 540 500  (scroll up)"
    exit 1
  fi
  local x1="$1" y1="$2" x2="$3" y2="$4" dur="${5:-300}"
  adb shell input swipe "$x1" "$y1" "$x2" "$y2" "$dur"
  log_ok "Swiped ($x1,$y1) → ($x2,$y2) [${dur}ms]"
}

cmd_ui_tree() {
  require_device
  local dump_file="/sdcard/ui-dump.xml"
  local local_file="$RUN_DIR/ui-tree.xml"

  log "Dumping UI hierarchy..."
  adb shell uiautomator dump "$dump_file" 2>/dev/null
  adb pull "$dump_file" "$local_file" 2>/dev/null
  adb shell rm "$dump_file" 2>/dev/null

  if [[ -f "$local_file" ]] && [[ -s "$local_file" ]]; then
    log_ok "UI tree saved: .run/ui-tree.xml"
    # Print a summary: extract text and content-desc attributes for quick scan
    log "Element summary (text / content-desc):"
    grep -oE '(text|content-desc)="[^"]*"' "$local_file" | grep -v '=""' | head -40 || true
    echo ".run/ui-tree.xml"
  else
    log_err "UI tree dump failed"
    exit 1
  fi
}

cmd_reload() {
  require_device
  log "Triggering React Native reload..."
  # Double-tap 'R' via adb to trigger fast refresh in dev mode
  adb shell input keyevent 46 && adb shell input keyevent 46
  log_ok "Reload triggered (double-R)"
}

# ── Emulator commands ─────────────────────────────────────────────

cmd_emulator_start() {
  # Check if emulator already running
  if adb devices 2>/dev/null | grep -q 'emulator'; then
    log_ok "Emulator already running"
    adb devices 2>/dev/null | grep 'emulator'
    return 0
  fi

  local EMU="$ANDROID_HOME/emulator/emulator"
  if [[ ! -x "$EMU" ]]; then
    log_err "Emulator not found at $EMU"
    log_err "Install: sdkmanager 'emulator' 'system-images;android-35;google_apis;arm64-v8a'"
    exit 1
  fi

  # Verify AVD exists
  if ! "$EMU" -list-avds 2>/dev/null | grep -q "^${AVD_NAME}$"; then
    log_err "AVD '$AVD_NAME' not found. Create it:"
    log_err "  avdmanager create avd -n $AVD_NAME -k 'system-images;android-35;google_apis;arm64-v8a' --device 'pixel_6'"
    exit 1
  fi

  log "Starting emulator '$AVD_NAME' (headless, no window)..."
  "$EMU" -avd "$AVD_NAME" -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect 2>"$RUN_DIR/emulator.log" &
  local emu_pid=$!
  echo "$emu_pid" > "$RUN_DIR/emulator.pid"

  log "Waiting for emulator to boot (PID $emu_pid)..."
  adb wait-for-device

  local retries=0
  while [[ $retries -lt 90 ]]; do
    local boot_complete
    boot_complete=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n') || true
    if [[ "$boot_complete" == "1" ]]; then
      log_ok "Emulator booted and ready (PID $emu_pid)"
      return 0
    fi
    sleep 2; ((retries++))
  done

  log_err "Emulator boot timed out after 180s"
  log_err "Check logs: $RUN_DIR/emulator.log"
  exit 1
}

cmd_emulator_stop() {
  # Try graceful shutdown via adb first
  if adb devices 2>/dev/null | grep -q 'emulator'; then
    log "Sending shutdown to emulator via adb..."
    adb emu kill 2>/dev/null || true
    sleep 2
  fi

  # Kill by PID if still running
  if [[ -f "$RUN_DIR/emulator.pid" ]]; then
    local pid
    pid=$(cat "$RUN_DIR/emulator.pid")
    if kill -0 "$pid" 2>/dev/null; then
      log "Force killing emulator (PID $pid)..."
      kill -TERM "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$RUN_DIR/emulator.pid"
  fi

  rm -f "$RUN_DIR/emulator.log"
  log_ok "Emulator stopped"
}

cmd_app_launch() {
  # 1. Start emulator if no device connected
  if ! adb devices 2>/dev/null | grep -q 'device$\|emulator'; then
    cmd_emulator_start
  else
    log_ok "Device/emulator already connected"
  fi

  # 2. Kill any existing self.sh
  "$ROOT_DIR/self.sh" --kill 2>/dev/null || true
  sleep 1

  # 3. Set emulator-specific env: emulator reaches host via 10.0.2.2
  export EXPO_PUBLIC_DEV_BACKEND_URL="ws://10.0.2.2:${BACKEND_PORT}/ws"

  # 4. Start backend in background
  log "Starting backend..."
  cd "$ROOT_DIR"
  "$ROOT_DIR/self.sh" --backend &>"$RUN_DIR/backend-agent.log" &
  local backend_sh_pid=$!
  echo "$backend_sh_pid" > "$RUN_DIR/app-launch.pid"

  # Wait for backend health
  local retries=0
  while [[ $retries -lt 30 ]]; do
    if curl -sf "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
      log_ok "Backend healthy"
      break
    fi
    sleep 1; ((retries++))
  done
  if [[ $retries -ge 30 ]]; then
    log_err "Backend failed to start. Check $RUN_DIR/backend-agent.log"
    exit 1
  fi

  # 5. Pairing token
  if [[ -f "$RUN_DIR/pairing-token" ]]; then
    export EXPO_PUBLIC_DEV_PAIRING_TOKEN
    EXPO_PUBLIC_DEV_PAIRING_TOKEN=$(cat "$RUN_DIR/pairing-token")
    log_ok "Pairing token loaded"
  fi

  # 6. Launch metro + install Expo Go + open on emulator
  log "Launching app on emulator (first run installs Expo Go automatically)..."
  cd "$ROOT_DIR/apps/mobile"
  npx expo start --android 2>&1 | sed -u "s/^/${GREEN}[expo]${NC} /" &
  local expo_pid=$!
  echo "$expo_pid" > "$RUN_DIR/expo-agent.pid"
  cd "$ROOT_DIR"

  # Wait for Metro to be ready
  retries=0
  while [[ $retries -lt 60 ]]; do
    if curl -sf "http://localhost:8081/status" >/dev/null 2>&1; then
      log_ok "Metro bundler ready"
      break
    fi
    sleep 2; ((retries++))
  done

  echo ""
  log_ok "═══════════════════════════════════════════════"
  log_ok "  App running on emulator!"
  log_ok "  Backend:  http://localhost:${BACKEND_PORT}"
  log_ok "  Metro:    http://localhost:8081"
  log_ok "  Emulator: ws://10.0.2.2:${BACKEND_PORT}/ws"
  log_ok ""
  log_ok "  ./dev-tools.sh screenshot   — capture screen"
  log_ok "  ./dev-tools.sh logs         — JS logs"
  log_ok "  ./dev-tools.sh app-stop     — kill everything"
  log_ok "═══════════════════════════════════════════════"
}

cmd_app_stop() {
  log "Stopping all agent services..."

  # Stop expo
  if [[ -f "$RUN_DIR/expo-agent.pid" ]]; then
    local pid
    pid=$(cat "$RUN_DIR/expo-agent.pid")
    kill "$pid" 2>/dev/null || true
    rm -f "$RUN_DIR/expo-agent.pid"
  fi

  # Stop self.sh (backend)
  "$ROOT_DIR/self.sh" --kill 2>/dev/null || true

  if [[ -f "$RUN_DIR/app-launch.pid" ]]; then
    local pid
    pid=$(cat "$RUN_DIR/app-launch.pid")
    kill "$pid" 2>/dev/null || true
    rm -f "$RUN_DIR/app-launch.pid"
  fi

  # Stop emulator
  cmd_emulator_stop

  rm -f "$RUN_DIR/backend-agent.log"
  log_ok "All agent services stopped"
}

show_help() {
  echo "Usage: ./dev-tools.sh <command> [options]"
  echo ""
  echo "Debug commands:"
  echo "  screenshot         Capture device screenshot to .run/"
  echo "  logs               Dump mobile JS logs (ReactNativeJS)"
  echo "  logs --backend     Show backend uvicorn log"
  echo "  logs --errors      Show JS error logs only"
  echo "  status             Check backend health, Metro, adb device"
  echo "  device-info        Show connected device details"
  echo "  clear-logs         Clear logcat buffer"
  echo ""
  echo "Interaction commands:"
  echo "  tap X Y            Simulate tap at screen coordinates"
  echo "  input-text TEXT    Type text into the focused field"
  echo "  key KEYCODE        Send key event (BACK, HOME, ENTER, DEL, TAB)"
  echo "  swipe X1 Y1 X2 Y2 Swipe gesture (scroll, drag)"
  echo "  ui-tree            Dump UI accessibility tree to .run/ui-tree.xml"
  echo "  reload             Trigger React Native hot reload"
  echo ""
  echo "Emulator commands:"
  echo "  emulator-start     Boot Android emulator (headless, no window)"
  echo "  emulator-stop      Kill the Android emulator"
  echo "  app-launch         All-in-one: emulator + backend + app on emulator"
  echo "  app-stop           Kill everything (backend + metro + emulator)"
  echo ""
  echo "Options:"
  echo "  --help             Show this help message"
  echo ""
  echo "Agent workflow:"
  echo "  ./dev-tools.sh app-launch          # Boot emulator + start everything"
  echo "  ./dev-tools.sh screenshot          # Capture & analyze screen"
  echo "  ./dev-tools.sh ui-tree             # Inspect element hierarchy"
  echo "  ./dev-tools.sh tap 540 960         # Tap on a UI element"
  echo "  ./dev-tools.sh input-text 'hello'  # Type into focused field"
  echo "  ./dev-tools.sh key BACK            # Navigate back / dismiss keyboard"
  echo "  ./dev-tools.sh logs                # Read JS logs"
  echo "  ./dev-tools.sh logs --errors       # Check for errors only"
  echo "  # ... fix code ..."
  echo "  ./dev-tools.sh reload              # Hot reload after changes"
  echo "  ./dev-tools.sh screenshot          # Verify fix"
  echo "  ./dev-tools.sh app-stop            # Clean up"
}

# ── Main dispatch ───────────────────────────────────────────────────
if [[ $# -eq 0 ]]; then
  show_help
  exit 1
fi

case "$1" in
  screenshot)      shift; cmd_screenshot "$@" ;;
  logs)            shift; cmd_logs "$@" ;;
  status)          cmd_status ;;
  device-info)     cmd_device_info ;;
  clear-logs)      cmd_clear_logs ;;
  tap)             shift; cmd_tap "$@" ;;
  input-text)      shift; cmd_input_text "$@" ;;
  key)             shift; cmd_key "$@" ;;
  swipe)           shift; cmd_swipe "$@" ;;
  ui-tree)         cmd_ui_tree ;;
  reload)          cmd_reload ;;
  emulator-start)  cmd_emulator_start ;;
  emulator-stop)   cmd_emulator_stop ;;
  app-launch)      cmd_app_launch ;;
  app-stop)        cmd_app_stop ;;
  --help|-h)       show_help ;;
  *)               log_err "Unknown command: $1"; show_help; exit 1 ;;
esac
