#!/usr/bin/env bash
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOCK_FILE="$RUN_DIR/self.lock"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
MOBILE_PID_FILE="$RUN_DIR/mobile.pid"
BACKEND_PORT=8000
BACKEND_ONLY=false
MOBILE_ONLY=false
SKIP_SCHEMA=false
KILL_ONLY=false
STATUS_ONLY=false

# ── Colors ───────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
YELLOW=$'\033[1;33m'
BOLD=$'\033[1m'
NC=$'\033[0m'

log()     { echo -e "${CYAN}[self.sh]${NC} $*"; }
log_ok()  { echo -e "${CYAN}[self.sh]${NC} ${GREEN}$*${NC}"; }
log_err() { echo -e "${CYAN}[self.sh]${NC} ${RED}$*${NC}"; }
log_warn(){ echo -e "${CYAN}[self.sh]${NC} ${YELLOW}$*${NC}"; }

# ── Parse args ───────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --kill)      KILL_ONLY=true;   shift ;;
    --backend)   BACKEND_ONLY=true; shift ;;
    --mobile)    MOBILE_ONLY=true;  shift ;;
    --status)    STATUS_ONLY=true;  shift ;;
    --no-schema) SKIP_SCHEMA=true;  shift ;;
    --port)      BACKEND_PORT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: ./self.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --kill        Kill all services and exit"
      echo "  --backend     Start backend only"
      echo "  --mobile      Start mobile only"
      echo "  --status      Show running services"
      echo "  --no-schema   Skip schema:generate"
      echo "  --port PORT   Override backend port (default: 8000)"
      echo "  -h, --help    Show this help"
      exit 0
      ;;
    *) log_err "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────
mkdir -p "$RUN_DIR"

kill_pid() {
  local pid=$1 name=${2:-process}
  if kill -0 "$pid" 2>/dev/null; then
    log "Stopping $name (PID $pid)..."
    kill -TERM "$pid" 2>/dev/null || true
    local waited=0
    while kill -0 "$pid" 2>/dev/null && [[ $waited -lt 10 ]]; do
      sleep 0.1
      ((waited++))
    done
    if kill -0 "$pid" 2>/dev/null; then
      log_warn "Force killing $name (PID $pid)"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    log "Killing processes on port $port: $pids"
    for pid in $pids; do
      kill_pid "$pid" "port-$port"
    done
  fi
}

kill_by_pattern() {
  local pattern=$1 name=$2
  local pids
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    log "Killing $name by pattern: $pids"
    for pid in $pids; do
      # Don't kill ourselves
      [[ "$pid" == "$$" ]] && continue
      kill_pid "$pid" "$name"
    done
  fi
}

# ── Kill zombies (3-layer) ──────────────────────────────────────────
kill_zombies() {
  local found=false

  # Layer 1: PID files
  for pidfile in "$BACKEND_PID_FILE" "$MOBILE_PID_FILE"; do
    if [[ -f "$pidfile" ]]; then
      local pid
      pid=$(cat "$pidfile")
      if kill -0 "$pid" 2>/dev/null; then
        found=true
        kill_pid "$pid" "$(basename "$pidfile" .pid)"
      fi
      rm -f "$pidfile"
    fi
  done

  # Layer 2: Port scan
  local port_pids
  port_pids=$(lsof -ti :"$BACKEND_PORT" 2>/dev/null || true)
  if [[ -n "$port_pids" ]]; then
    found=true
    kill_port "$BACKEND_PORT"
  fi

  # Layer 3: Process name patterns
  for pattern in "uvicorn app.main:app" "expo start"; do
    local pids
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      found=true
      kill_by_pattern "$pattern" "$pattern"
    fi
  done

  if $found; then
    log_ok "Zombie processes cleaned up"
  fi

  # Clean stale lock
  rm -f "$LOCK_FILE"
}

# ── Status ───────────────────────────────────────────────────────────
show_status() {
  echo -e "${BOLD}Service Status${NC}"
  echo "─────────────────────────────────"

  # Backend
  local backend_status="${RED}stopped${NC}"
  if [[ -f "$BACKEND_PID_FILE" ]] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
    backend_status="${GREEN}running${NC} (PID $(cat "$BACKEND_PID_FILE"))"
  elif lsof -ti :"$BACKEND_PORT" &>/dev/null; then
    backend_status="${YELLOW}port occupied${NC} ($(lsof -ti :"$BACKEND_PORT" | head -1))"
  fi
  echo -e "  Backend:  $backend_status"

  # Mobile
  local mobile_status="${RED}stopped${NC}"
  if [[ -f "$MOBILE_PID_FILE" ]] && kill -0 "$(cat "$MOBILE_PID_FILE")" 2>/dev/null; then
    mobile_status="${GREEN}running${NC} (PID $(cat "$MOBILE_PID_FILE"))"
  fi
  echo -e "  Mobile:   $mobile_status"

  # Lock
  if [[ -f "$LOCK_FILE" ]]; then
    echo -e "  Lock:     ${YELLOW}active${NC}"
  else
    echo -e "  Lock:     ${GREEN}none${NC}"
  fi
  echo "─────────────────────────────────"
}

# ── Handle --status ──────────────────────────────────────────────────
if $STATUS_ONLY; then
  show_status
  exit 0
fi

# ── Handle --kill ────────────────────────────────────────────────────
if $KILL_ONLY; then
  log "Killing all services..."
  kill_zombies
  log_ok "Done"
  exit 0
fi

# ── Kill zombies before start ────────────────────────────────────────
kill_zombies

# ── Lock check ───────────────────────────────────────────────────────
if [[ -f "$LOCK_FILE" ]]; then
  lock_pid=$(cat "$LOCK_FILE")
  if kill -0 "$lock_pid" 2>/dev/null; then
    log_err "Another instance is running (PID $lock_pid). Use --kill first."
    exit 1
  else
    log_warn "Stale lock file removed"
    rm -f "$LOCK_FILE"
  fi
fi
echo $$ > "$LOCK_FILE"

# ── Cleanup trap ─────────────────────────────────────────────────────
CHILDREN=()

cleanup() {
  log "Shutting down..."
  for pid in "${CHILDREN[@]}"; do
    kill_pid "$pid" "child"
  done
  rm -f "$BACKEND_PID_FILE" "$MOBILE_PID_FILE" "$LOCK_FILE"
  log_ok "Goodbye"
}
trap cleanup EXIT INT TERM

# ── Schema generation ────────────────────────────────────────────────
if ! $SKIP_SCHEMA && ! $MOBILE_ONLY; then
  log "Generating schema..."
  if pnpm schema:generate 2>&1 | sed "s/^/  /"; then
    log_ok "Schema generated"
  else
    log_warn "Schema generation failed (non-fatal)"
  fi
fi

# ── Start backend ────────────────────────────────────────────────────
start_backend() {
  log "Starting backend on port $BACKEND_PORT..."
  cd "$ROOT_DIR/apps/backend"
  if [[ -x .venv/bin/uvicorn ]]; then
    .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT" 2>&1 \
      | sed -u "s/^/${GREEN}[backend]${NC} /" &
  else
    UV_CACHE_DIR="$ROOT_DIR/.cache/uv" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT" 2>&1 \
      | sed -u "s/^/${GREEN}[backend]${NC} /" &
  fi
  local pid=$!
  cd "$ROOT_DIR"
  echo "$pid" > "$BACKEND_PID_FILE"
  CHILDREN+=("$pid")
  log "Backend started (PID $pid)"

  # Health check
  log "Waiting for backend health..."
  local retries=0
  while [[ $retries -lt 20 ]]; do
    if curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
      log_ok "Backend healthy"
      return 0
    fi
    # Check if process died
    if ! kill -0 "$pid" 2>/dev/null; then
      log_err "Backend process died"
      return 1
    fi
    sleep 0.5
    ((retries++))
  done
  log_warn "Backend health check timed out (may still be starting)"
}

# ── Start mobile ─────────────────────────────────────────────────────
start_mobile() {
  # Check if expo is available
  if ! pnpm --filter mobile exec which expo &>/dev/null; then
    log_warn "Expo not available — skipping mobile (install with: cd apps/mobile && pnpm install)"
    return 0
  fi

  log "Starting mobile (Expo)..."
  # No sed pipe — Expo needs a tty to render the QR code
  pnpm dev:mobile &
  local pid=$!
  echo "$pid" > "$MOBILE_PID_FILE"
  CHILDREN+=("$pid")
  log "Mobile started (PID $pid)"
}

# ── Launch services ──────────────────────────────────────────────────
if $BACKEND_ONLY; then
  start_backend
elif $MOBILE_ONLY; then
  start_mobile
else
  start_backend
  start_mobile
fi

# ── Wait for children ───────────────────────────────────────────────
log_ok "All services started. Press Ctrl+C to stop."
wait
