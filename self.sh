#!/usr/bin/env bash
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOCK_FILE="$RUN_DIR/self.lock"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
MOBILE_PID_FILE="$RUN_DIR/mobile.pid"
TUNNEL_PID_FILE="$RUN_DIR/tunnel-backend.pid"
BACKEND_PORT=8000
BACKEND_ONLY=false
MOBILE_ONLY=false
SKIP_SCHEMA=false
KILL_ONLY=false
STATUS_ONLY=false
RESET=false
TUNNEL_MODE=true

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
    --tunnel)    TUNNEL_MODE=true;  shift ;;
    --no-tunnel) TUNNEL_MODE=false; shift ;;
    --reset)     RESET=true;        shift ;;
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
      echo "  --no-tunnel   Disable tunnel (LAN mode for emulator)"
      echo "  --reset       Purge backend DB (forces re-pairing on mobile)"
      echo "  --port PORT   Override backend port (default: 8000)"
      echo "  -h, --help    Show this help"
      exit 0
      ;;
    *) log_err "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────
mkdir -p "$RUN_DIR"

get_lan_ip() {
  local iface ip
  iface=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
  # Skip VPN/tunnel interfaces — scan physical interfaces instead
  if [[ "$iface" =~ ^(utun|ppp|tun|tap|gif) ]] || [[ -z "$iface" ]]; then
    for candidate in en0 en1 en2 en3 en4 en5 en6 en7; do
      ip=$(ifconfig "$candidate" 2>/dev/null | awk '/inet /{print $2; exit}')
      if [[ -n "$ip" && "$ip" != "127.0.0.1" ]]; then
        echo "$ip"; return
      fi
    done
  fi
  if [[ -n "$iface" ]]; then
    ifconfig "$iface" 2>/dev/null | awk '/inet /{print $2; exit}'
  fi
}


kill_pid() {
  local pid=$1 name=${2:-process}
  if kill -0 "$pid" 2>/dev/null; then
    log "Stopping $name (PID $pid)..."
    kill -TERM "$pid" 2>/dev/null || true
    local waited=0
    while kill -0 "$pid" 2>/dev/null && [[ $waited -lt 10 ]]; do
      sleep 0.1; ((waited++))
    done
    if kill -0 "$pid" 2>/dev/null; then
      log_warn "Force killing $name (PID $pid)"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}

kill_port() {
  local port=$1 pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    log "Killing processes on port $port: $pids"
    for pid in $pids; do kill_pid "$pid" "port-$port"; done
  fi
}

kill_by_pattern() {
  local pattern=$1 name=$2 pids
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    log "Killing $name by pattern: $pids"
    for pid in $pids; do
      [[ "$pid" == "$$" ]] && continue
      kill_pid "$pid" "$name"
    done
  fi
}

# ── Kill zombies (3-layer) ──────────────────────────────────────────
kill_zombies() {
  local found=false

  # Layer 1: PID files
  for pidfile in "$BACKEND_PID_FILE" "$MOBILE_PID_FILE" "$TUNNEL_PID_FILE"; do
    if [[ -f "$pidfile" ]]; then
      local pid; pid=$(cat "$pidfile")
      if kill -0 "$pid" 2>/dev/null; then
        found=true; kill_pid "$pid" "$(basename "$pidfile" .pid)"
      fi
      rm -f "$pidfile"
    fi
  done

  # Layer 2: Port scan
  if lsof -ti :"$BACKEND_PORT" &>/dev/null; then
    found=true; kill_port "$BACKEND_PORT"
  fi

  # Layer 3: Process name patterns
  for pattern in "uvicorn app.main:app" "expo start" "cloudflared tunnel.*$BACKEND_PORT"; do
    local pids; pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      found=true; kill_by_pattern "$pattern" "$pattern"
    fi
  done

  if $found; then log_ok "Zombie processes cleaned up"; fi
  rm -f "$LOCK_FILE" "$RUN_DIR/backend-tunnel-url" "$RUN_DIR/cloudflared.log"
}

# ── Status ───────────────────────────────────────────────────────────
show_status() {
  echo -e "${BOLD}Service Status${NC}"
  echo "─────────────────────────────────"
  local backend_status="${RED}stopped${NC}"
  if [[ -f "$BACKEND_PID_FILE" ]] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
    backend_status="${GREEN}running${NC} (PID $(cat "$BACKEND_PID_FILE"))"
  elif lsof -ti :"$BACKEND_PORT" &>/dev/null; then
    backend_status="${YELLOW}port occupied${NC}"
  fi
  echo -e "  Backend:  $backend_status"

  local mobile_status="${RED}stopped${NC}"
  if [[ -f "$MOBILE_PID_FILE" ]] && kill -0 "$(cat "$MOBILE_PID_FILE")" 2>/dev/null; then
    mobile_status="${GREEN}running${NC} (PID $(cat "$MOBILE_PID_FILE"))"
  fi
  echo -e "  Mobile:   $mobile_status"

  if [[ -f "$RUN_DIR/backend-tunnel-url" ]]; then
    echo -e "  Tunnel:   ${GREEN}$(cat "$RUN_DIR/backend-tunnel-url")${NC}"
  fi
  echo "─────────────────────────────────"
}

if $STATUS_ONLY; then show_status; exit 0; fi

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
  for pid in "${CHILDREN[@]}"; do kill_pid "$pid" "child"; done
  if [[ -f "$TUNNEL_PID_FILE" ]]; then
    kill_pid "$(cat "$TUNNEL_PID_FILE")" "cloudflared"
  fi
  rm -f "$BACKEND_PID_FILE" "$MOBILE_PID_FILE" "$TUNNEL_PID_FILE" "$LOCK_FILE" \
        "$RUN_DIR/backend-tunnel-url" "$RUN_DIR/cloudflared.log"
  log_ok "Goodbye"
}
trap cleanup EXIT INT TERM

# ── Reset (purge DB) ────────────────────────────────────────────────
if $RESET; then
  DB_FILE="$ROOT_DIR/apps/backend/data/self.db"
  if [[ -f "$DB_FILE" ]]; then
    rm -f "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm"
    rm -f "$RUN_DIR/pairing-token"
    rm -f "$ROOT_DIR/apps/backend/data/SOUL.md"
    log_ok "Database + SOUL.md purged — mobile will need to re-pair"
  else
    log_warn "No database found at $DB_FILE"
  fi
fi

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

  log "Waiting for backend health..."
  local retries=0
  while [[ $retries -lt 20 ]]; do
    if curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
      log_ok "Backend healthy"; return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      log_err "Backend process died"; return 1
    fi
    sleep 0.5; ((retries++))
  done
  log_warn "Backend health check timed out (may still be starting)"
}

# ── Start backend tunnel (cloudflared — free, no auth needed) ────────
start_backend_tunnel() {
  if ! command -v cloudflared &>/dev/null; then
    log_err "cloudflared not found — install: brew install cloudflared"
    return 1
  fi

  log "Starting cloudflared tunnel for backend (port $BACKEND_PORT)..."
  cloudflared tunnel --url "http://localhost:$BACKEND_PORT" --no-autoupdate 2>"$RUN_DIR/cloudflared.log" &
  local cf_pid=$!
  echo "$cf_pid" > "$TUNNEL_PID_FILE"

  # Parse tunnel URL from cloudflared stderr log
  local retries=0 tunnel_url=""
  while [[ $retries -lt 30 ]]; do
    tunnel_url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN_DIR/cloudflared.log" 2>/dev/null | head -1) || true
    if [[ -n "$tunnel_url" ]]; then break; fi
    if ! kill -0 "$cf_pid" 2>/dev/null; then
      log_err "cloudflared process died"
      cat "$RUN_DIR/cloudflared.log" 2>/dev/null | tail -5
      return 1
    fi
    sleep 0.5; ((retries++))
  done

  if [[ -z "$tunnel_url" ]]; then
    log_err "Failed to get cloudflared tunnel URL after 15s"
    kill "$cf_pid" 2>/dev/null || true
    return 1
  fi

  echo "$tunnel_url" > "$RUN_DIR/backend-tunnel-url"
  log_ok "Backend tunnel: $tunnel_url"
}

# ── Start mobile ─────────────────────────────────────────────────────
start_mobile() {
  if ! pnpm --filter mobile exec which expo &>/dev/null; then
    log_warn "Expo not available — skipping mobile"
    return 0
  fi

  local mobile_script="dev:mobile"

  if $TUNNEL_MODE; then
    # Backend tunnel via cloudflared (free, no session limit)
    if start_backend_tunnel; then
      local tunnel_url
      tunnel_url=$(cat "$RUN_DIR/backend-tunnel-url")
      export EXPO_PUBLIC_DEV_BACKEND_URL="wss://${tunnel_url#https://}/ws"
      # Metro tunnel via Expo's built-in --tunnel (uses @expo/ngrok)
      mobile_script="dev:mobile:tunnel"
      log_ok "Backend WS: wss://${tunnel_url#https://}/ws"
      log_ok "Metro will start in tunnel mode (expo --tunnel)"
    else
      log_warn "Backend tunnel failed — falling back to LAN"
      TUNNEL_MODE=false
    fi
  fi

  if ! $TUNNEL_MODE; then
    # LAN mode: force Metro to use physical LAN IP (VPN-safe)
    local lan_ip
    lan_ip=$(get_lan_ip)
    if [[ -n "$lan_ip" ]]; then
      export REACT_NATIVE_PACKAGER_HOSTNAME="$lan_ip"
      export EXPO_PUBLIC_DEV_BACKEND_URL="ws://${lan_ip}:${BACKEND_PORT}/ws"
      log_ok "Metro host forced to $lan_ip (VPN-safe)"
    fi
  fi

  # Do NOT set REACT_NATIVE_PACKAGER_HOSTNAME in tunnel mode — Expo --tunnel handles it
  if $TUNNEL_MODE; then
    unset REACT_NATIVE_PACKAGER_HOSTNAME
  fi

  # Pairing token auto-fill
  if [[ -f "$RUN_DIR/pairing-token" ]]; then
    local PT; PT=$(cat "$RUN_DIR/pairing-token")
    export EXPO_PUBLIC_DEV_PAIRING_TOKEN="$PT"
    log_ok "Dev pairing: URL=${EXPO_PUBLIC_DEV_BACKEND_URL:-?} token=${PT:0:8}..."
  fi

  # Write .env for Metro (Expo reads .env at bundle time, overrides shell exports)
  local env_file="$ROOT_DIR/apps/mobile/.env"
  {
    echo "# Auto-generated by self.sh — do not edit manually"
    echo "EXPO_PUBLIC_DEV_BACKEND_URL=${EXPO_PUBLIC_DEV_BACKEND_URL:-}"
    [[ -n "${EXPO_PUBLIC_DEV_PAIRING_TOKEN:-}" ]] && echo "EXPO_PUBLIC_DEV_PAIRING_TOKEN=${EXPO_PUBLIC_DEV_PAIRING_TOKEN}"
  } > "$env_file"
  log "Wrote $env_file (URL=${EXPO_PUBLIC_DEV_BACKEND_URL:-?})"

  log "Starting mobile (Expo)..."
  pnpm "$mobile_script" &
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
