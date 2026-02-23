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
RESET=false
TMUX_SESSION="self"
NO_TMUX=false
_TMUX_STATUS=false
_TMUX_BACKEND=false
_TMUX_MOBILE=false

# ── Colors ───────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
YELLOW=$'\033[1;33m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m'

# ── jq detection ──────────────────────────────────────────────────
HAVE_JQ=false
if command -v jq &>/dev/null; then
  HAVE_JQ=true
fi

log()     { echo -e "${CYAN}[self.sh]${NC} $*"; }
log_ok()  { echo -e "${CYAN}[self.sh]${NC} ${GREEN}$*${NC}"; }
log_err() { echo -e "${CYAN}[self.sh]${NC} ${RED}$*${NC}"; }
log_warn(){ echo -e "${CYAN}[self.sh]${NC} ${YELLOW}$*${NC}"; }

# ── Dashboard helpers ────────────────────────────────────────────────
get_lan_ip() {
  local iface
  iface=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
  if [[ -n "$iface" ]]; then
    ifconfig "$iface" 2>/dev/null | awk '/inet /{print $2; exit}'
  fi
}

get_provider_name() {
  echo "${SELF_LLM_PROVIDER:-claude-cli}"
}

format_uptime() {
  local secs=$1
  if (( secs < 60 )); then
    echo "${secs}s"
  elif (( secs < 3600 )); then
    echo "$(( secs / 60 ))m"
  else
    local h=$(( secs / 3600 )) m=$(( (secs % 3600) / 60 ))
    if (( m > 0 )); then echo "${h}h${m}m"; else echo "${h}h"; fi
  fi
}

# Strip ANSI escape sequences for measuring visible width
strip_ansi() {
  echo -e "$1" | sed $'s/\033\\[[0-9;]*m//g'
}

box_line() {
  local content="$1" width="${2:-47}"
  local visible
  visible=$(strip_ansi "$content")
  local pad=$(( width - ${#visible} - 2 ))
  (( pad < 0 )) && pad=0
  printf " │  %b%*s│\n" "$content" "$pad" ""
}

box_top()    { local w="${1:-47}"; printf " ┌"; printf '─%.0s' $(seq 1 "$w"); printf "┐\n"; }
box_sep()    { local w="${1:-47}"; printf " ├"; printf '─%.0s' $(seq 1 "$w"); printf "┤\n"; }
box_bottom() { local w="${1:-47}"; printf " └"; printf '─%.0s' $(seq 1 "$w"); printf "┘\n"; }
box_empty()  { local w="${1:-47}"; printf " │%*s│\n" "$w" ""; }

print_banner() {
  local lan_ip provider w=47
  lan_ip=$(get_lan_ip)
  provider=$(get_provider_name)

  echo ""
  box_top $w
  box_line "${BOLD}self-app dev${NC}" $w
  box_empty $w
  box_line "Backend   http://localhost:${BACKEND_PORT}" $w
  if [[ -n "$lan_ip" ]]; then
    box_line "LAN       http://${lan_ip}:${BACKEND_PORT}" $w
  fi
  box_line "Health    http://localhost:${BACKEND_PORT}/health" $w
  box_line "Provider  ${provider}" $w
  box_empty $w
  box_line "Mobile    Expo (see output below)" $w
  box_line "Stop      Ctrl+C" $w
  box_bottom $w
  echo ""
}

format_health_line() {
  local json uptime_s uptime_fmt provider schema pairing status
  json=$(curl -sf --max-time 3 "http://localhost:$BACKEND_PORT/health" 2>/dev/null) || {
    echo -e "${DIM}── health ── ${RED}backend:DOWN${NC}${DIM} | providers:? | schema:? | pair:? ──${NC}"
    return
  }

  if ! $HAVE_JQ; then
    echo -e "${DIM}── health ── backend:ok ──${NC}"
    return
  fi

  status=$(echo "$json" | jq -r '.status // "ok"')
  uptime_s=$(echo "$json" | jq -r '.uptime // 0' | cut -d. -f1)
  uptime_fmt=$(format_uptime "$uptime_s")
  provider=$(echo "$json" | jq -r '(.providers // [])[0].name // "?"')
  schema=$(echo "$json" | jq -r '.schema_version // "?"')
  pairing=$(echo "$json" | jq -r 'if .pairing_available then "yes" else "no" end')

  echo -e "${DIM}── health ── ${GREEN}backend:ok${NC} ${DIM}${uptime_fmt} | ${provider} | schema:${schema} | pair:${pairing} ──${NC}"
}

health_monitor_loop() {
  local interval="${1:-30}"
  while true; do
    sleep "$interval"
    format_health_line
  done
}

# ── Tmux helpers ────────────────────────────────────────────────────
has_tmux() {
  command -v tmux &>/dev/null
}

use_tmux_mode() {
  has_tmux \
    && ! $NO_TMUX \
    && ! $BACKEND_ONLY \
    && ! $MOBILE_ONLY \
    && [[ -z "${TMUX:-}" ]]
}

tmux_create_session() {
  log "Creating tmux session '$TMUX_SESSION'..."

  # Layout: status bar on top (5 lines), then backend LEFT | mobile RIGHT
  # ┌─────────────── STATUS ───────────────┐
  # ├──────────────────┬───────────────────┤
  # │  BACKEND (left)  │  MOBILE (right)   │
  # └──────────────────┴───────────────────┘

  # Create session with status pane (top)
  tmux new-session -d -s "$TMUX_SESSION" -x "$(tput cols)" -y "$(tput lines)" \
    "$ROOT_DIR/self.sh --_tmux-status"

  # Split below status: backend pane (takes remaining height)
  tmux split-window -t "$TMUX_SESSION:0.0" -v \
    "$ROOT_DIR/self.sh --_tmux-backend --port $BACKEND_PORT"

  # Split backend pane horizontally: mobile on the right
  tmux split-window -t "$TMUX_SESSION:0.1" -h \
    "$ROOT_DIR/self.sh --_tmux-mobile --port $BACKEND_PORT"

  # Status pane = 5 lines, backend/mobile share the rest side by side
  tmux resize-pane -t "$TMUX_SESSION:0.0" -y 5

  # Set pane titles
  tmux select-pane -t "$TMUX_SESSION:0.0" -T "STATUS"
  tmux select-pane -t "$TMUX_SESSION:0.1" -T "BACKEND"
  tmux select-pane -t "$TMUX_SESSION:0.2" -T "MOBILE"

  # Enable mouse scrolling (trackpad/wheel enters copy mode automatically)
  tmux set-option -t "$TMUX_SESSION" mouse on

  # Window name
  tmux rename-window -t "$TMUX_SESSION:0" "self-app"

  # Pane borders: colored titles
  tmux set-option -t "$TMUX_SESSION" pane-border-status top
  tmux set-option -t "$TMUX_SESSION" pane-border-style "fg=colour240"
  tmux set-option -t "$TMUX_SESSION" pane-active-border-style "fg=colour75"
  tmux set-option -t "$TMUX_SESSION" pane-border-format " #[fg=colour255,bold]#{pane_title}#[default] "

  # Status bar: clean and minimal
  tmux set-option -t "$TMUX_SESSION" status-style "bg=colour235,fg=colour248"
  tmux set-option -t "$TMUX_SESSION" status-left "#[fg=colour75,bold] self #[default] "
  tmux set-option -t "$TMUX_SESSION" status-right "#[fg=colour240]Ctrl+B d detach  "
  tmux set-option -t "$TMUX_SESSION" status-left-length 20
  tmux set-option -t "$TMUX_SESSION" window-status-current-format ""
  tmux set-option -t "$TMUX_SESSION" window-status-format ""

  # Focus backend pane (most useful for scrolling)
  tmux select-pane -t "$TMUX_SESSION:0.1"

  log_ok "Tmux session ready — attaching..."
  exec tmux attach-session -t "$TMUX_SESSION"
}

tmux_status_pane() {
  local w=50
  while true; do
    clear
    local lan_ip provider
    lan_ip=$(get_lan_ip)
    provider=$(get_provider_name)

    # Compact status header
    printf " ${BOLD}self-app${NC} | "

    # Health check inline
    local json
    json=$(curl -sf --max-time 3 "http://localhost:$BACKEND_PORT/health" 2>/dev/null) || json=""
    if [[ -n "$json" ]] && $HAVE_JQ; then
      local status uptime_s uptime_fmt schema
      status=$(echo "$json" | jq -r '.status // "ok"')
      uptime_s=$(echo "$json" | jq -r '.uptime // 0' | cut -d. -f1)
      uptime_fmt=$(format_uptime "$uptime_s")
      schema=$(echo "$json" | jq -r '.schema_version // "?"')
      printf "${GREEN}backend:ok${NC} ${uptime_fmt} | ${provider} | schema:${schema}"
    elif [[ -n "$json" ]]; then
      printf "${GREEN}backend:ok${NC} | ${provider}"
    else
      printf "${RED}backend:DOWN${NC} | ${provider}"
    fi
    echo ""

    # Endpoints line
    if [[ -n "$lan_ip" ]]; then
      printf " ${DIM}http://${lan_ip}:${BACKEND_PORT}${NC} | ${DIM}Ctrl+B d${NC} detach\n"
    else
      printf " ${DIM}http://localhost:${BACKEND_PORT}${NC} | ${DIM}Ctrl+B d${NC} detach\n"
    fi

    sleep 30
  done
}

tmux_backend_pane() {
  cd "$ROOT_DIR/apps/backend"
  echo $$ > "$BACKEND_PID_FILE"

  if [[ -x .venv/bin/uvicorn ]]; then
    exec .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
  else
    exec env UV_CACHE_DIR="$ROOT_DIR/.cache/uv" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
  fi
}

tmux_mobile_pane() {
  # Wait for backend to be healthy
  log "Waiting for backend..."
  local retries=0
  while [[ $retries -lt 30 ]]; do
    if curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
      log_ok "Backend healthy"
      break
    fi
    sleep 1
    ((retries++))
  done
  if [[ $retries -ge 30 ]]; then
    log_warn "Backend health check timed out — starting mobile anyway"
  fi

  # Setup pairing env
  if [[ -f "$RUN_DIR/pairing-token" ]]; then
    local PT LAN_IP_VAL
    PT=$(cat "$RUN_DIR/pairing-token")
    LAN_IP_VAL=$(get_lan_ip)
    export EXPO_PUBLIC_DEV_BACKEND_URL="ws://${LAN_IP_VAL:-localhost}:${BACKEND_PORT}/ws"
    export EXPO_PUBLIC_DEV_PAIRING_TOKEN="$PT"
    log_ok "Dev pairing: URL=$EXPO_PUBLIC_DEV_BACKEND_URL token=${PT:0:8}..."
  fi

  cd "$ROOT_DIR"
  echo $$ > "$MOBILE_PID_FILE"
  exec pnpm dev:mobile
}

cleanup_tmux_controller() {
  rm -f "$LOCK_FILE"
}

# ── Parse args ───────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --kill)      KILL_ONLY=true;   shift ;;
    --backend)   BACKEND_ONLY=true; shift ;;
    --mobile)    MOBILE_ONLY=true;  shift ;;
    --status)    STATUS_ONLY=true;  shift ;;
    --no-schema) SKIP_SCHEMA=true;  shift ;;
    --reset)     RESET=true;        shift ;;
    --no-tmux)   NO_TMUX=true;      shift ;;
    --port)      BACKEND_PORT="$2"; shift 2 ;;
    --_tmux-status)  _TMUX_STATUS=true;  shift ;;
    --_tmux-backend) _TMUX_BACKEND=true; shift ;;
    --_tmux-mobile)  _TMUX_MOBILE=true;  shift ;;
    -h|--help)
      echo "Usage: ./self.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --kill        Kill all services and exit"
      echo "  --backend     Start backend only"
      echo "  --mobile      Start mobile only"
      echo "  --status      Show running services"
      echo "  --no-schema   Skip schema:generate"
      echo "  --no-tmux     Force inline mode (no tmux)"
      echo "  --reset       Purge backend DB (forces re-pairing on mobile)"
      echo "  --port PORT   Override backend port (default: 8000)"
      echo "  -h, --help    Show this help"
      exit 0
      ;;
    *) log_err "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Tmux pane dispatch (internal, before any lock/zombie logic) ────
if $_TMUX_STATUS; then tmux_status_pane; exit 0; fi
if $_TMUX_BACKEND; then tmux_backend_pane; exit 0; fi
if $_TMUX_MOBILE; then tmux_mobile_pane; exit 0; fi

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
  local w=57

  # ── Services ──
  local backend_status backend_pid_info="" backend_uptime=""
  if [[ -f "$BACKEND_PID_FILE" ]] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
    local bpid
    bpid=$(cat "$BACKEND_PID_FILE")
    backend_status="${GREEN}running${NC}"
    backend_pid_info="PID $bpid"
    # Compute uptime from PID start time
    local start_ts now_ts
    start_ts=$(ps -o lstart= -p "$bpid" 2>/dev/null | xargs -I{} date -j -f "%a %b %d %T %Y" "{}" "+%s" 2>/dev/null || echo "")
    now_ts=$(date "+%s")
    if [[ -n "$start_ts" ]]; then
      backend_uptime="uptime $(format_uptime $(( now_ts - start_ts )))"
    fi
  elif lsof -ti :"$BACKEND_PORT" &>/dev/null; then
    backend_status="${YELLOW}port occupied${NC}"
    backend_pid_info="PID $(lsof -ti :"$BACKEND_PORT" | head -1)"
  else
    backend_status="${RED}stopped${NC}"
  fi

  local mobile_status mobile_pid_info=""
  if [[ -f "$MOBILE_PID_FILE" ]] && kill -0 "$(cat "$MOBILE_PID_FILE")" 2>/dev/null; then
    mobile_status="${GREEN}running${NC}"
    mobile_pid_info="PID $(cat "$MOBILE_PID_FILE")"
  else
    mobile_status="${RED}stopped${NC}"
  fi

  local lock_status lock_pid_info=""
  if [[ -f "$LOCK_FILE" ]]; then
    local lpid
    lpid=$(cat "$LOCK_FILE")
    if kill -0 "$lpid" 2>/dev/null; then
      lock_status="${YELLOW}active${NC}"
      lock_pid_info="PID $lpid"
    else
      lock_status="${DIM}stale${NC}"
    fi
  else
    lock_status="${GREEN}none${NC}"
  fi

  echo ""
  box_top $w
  box_line "${BOLD}self-app status${NC}" $w
  box_sep $w
  box_line "Backend   ${backend_status}   ${backend_pid_info}   ${backend_uptime}" $w
  box_line "Mobile    ${mobile_status}   ${mobile_pid_info}" $w
  box_line "Lock      ${lock_status}   ${lock_pid_info}" $w

  local tmux_status
  if has_tmux && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    # Check if any client is attached
    local clients
    clients=$(tmux list-clients -t "$TMUX_SESSION" 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$clients" -gt 0 ]]; then
      tmux_status="${GREEN}attached${NC}"
    else
      tmux_status="${YELLOW}detached${NC}"
    fi
  else
    tmux_status="${DIM}no session${NC}"
  fi
  box_line "Tmux      ${tmux_status}" $w

  # ── Health data ──
  local json provider_line schema_line pairing_line
  json=$(curl -sf --max-time 3 "http://localhost:$BACKEND_PORT/health" 2>/dev/null) || json=""

  if [[ -n "$json" ]] && $HAVE_JQ; then
    local schema provider pairing
    schema=$(echo "$json" | jq -r '.schema_version // "?"')
    local migrations
    migrations=$(echo "$json" | jq -r '.migrations_applied // "?"')
    provider=$(echo "$json" | jq -r '(.providers // [])[0].name // "?"')
    local provider_healthy
    provider_healthy=$(echo "$json" | jq -r 'if (.providers // [])[0].healthy then "healthy" else "unhealthy" end')
    pairing=$(echo "$json" | jq -r 'if .pairing_available then "available" else "disabled" end')

    box_sep $w
    box_line "Schema    v${schema}   (${migrations} migration applied)" $w
    box_line "Provider  ${provider} (${provider_healthy})" $w
    box_line "Pairing   ${pairing}" $w
  fi

  # ── Endpoints ──
  local lan_ip
  lan_ip=$(get_lan_ip)
  box_sep $w
  box_line "Endpoints" $w
  box_line "  http://localhost:${BACKEND_PORT}" $w
  if [[ -n "$lan_ip" ]]; then
    box_line "  http://${lan_ip}:${BACKEND_PORT}  (LAN)" $w
  fi
  box_line "  http://localhost:${BACKEND_PORT}/health" $w
  box_bottom $w
  echo ""
}

# ── Handle --status ──────────────────────────────────────────────────
if $STATUS_ONLY; then
  show_status
  exit 0
fi

# ── Handle --kill ────────────────────────────────────────────────────
if $KILL_ONLY; then
  log "Killing all services..."
  if has_tmux && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    log "Killing tmux session '$TMUX_SESSION'..."
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  fi
  kill_zombies
  log_ok "Done"
  exit 0
fi

# ── Reattach to existing tmux session ────────────────────────────────
if use_tmux_mode && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  log "Session tmux '$TMUX_SESSION' active — reattach..."
  exec tmux attach-session -t "$TMUX_SESSION"
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

# ── Reset (purge DB) ────────────────────────────────────────────────
if $RESET; then
  DB_FILE="$ROOT_DIR/apps/backend/data/self.db"
  if [[ -f "$DB_FILE" ]]; then
    rm -f "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm"
    rm -f "$RUN_DIR/pairing-token"
    log_ok "Database purged — mobile will need to re-pair"
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

# ── Tmux mode branch ───────────────────────────────────────────────
if use_tmux_mode; then
  trap 'rm -f "$LOCK_FILE"' EXIT
  tmux_create_session
  exit 0
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
print_banner

if $BACKEND_ONLY; then
  start_backend
elif $MOBILE_ONLY; then
  start_mobile
else
  start_backend
  # Export dev env vars for PairingScreen auto-fill
  if [[ -f "$RUN_DIR/pairing-token" ]]; then
    PT=$(cat "$RUN_DIR/pairing-token")
    LAN_IP_VAL=$(get_lan_ip)
    export EXPO_PUBLIC_DEV_BACKEND_URL="ws://${LAN_IP_VAL:-localhost}:${BACKEND_PORT}/ws"
    export EXPO_PUBLIC_DEV_PAIRING_TOKEN="$PT"
    log_ok "Dev pairing: URL=$EXPO_PUBLIC_DEV_BACKEND_URL token=${PT:0:8}..."
  fi
  start_mobile
fi

# ── Wait for children ───────────────────────────────────────────────
log_ok "All services started. Press Ctrl+C to stop."

# Show initial health line and start monitor
format_health_line
if ! $HAVE_JQ; then
  log_warn "jq not found — health monitor disabled (install: brew install jq)"
fi
health_monitor_loop 30 &
CHILDREN+=("$!")

wait
