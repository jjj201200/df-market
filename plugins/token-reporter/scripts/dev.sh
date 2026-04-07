#!/usr/bin/env bash
# Dev server management for token-reporter
# Usage: ./scripts/dev.sh [start|stop|restart|status]

set -euo pipefail

DEV_PORT="${DEV_PORT:-13737}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="/tmp/token-reporter-dev"
PID_FILE="$DATA_DIR/dev-server.pid"
CONFIG_FILE="$DATA_DIR/config.json"

ensure_data_dir() {
  mkdir -p "$DATA_DIR"
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "{\"port\":$DEV_PORT,\"autoStart\":false}" > "$CONFIG_FILE"
  fi
}

get_pid() {
  if [ -f "$PID_FILE" ]; then
    cat "$PID_FILE"
  fi
}

is_running() {
  local pid
  pid=$(get_pid)
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

do_start() {
  if is_running; then
    echo "Dev server already running (PID $(get_pid)) on port $DEV_PORT"
    return 0
  fi
  ensure_data_dir
  # Update port in config in case DEV_PORT changed
  echo "{\"port\":$DEV_PORT,\"autoStart\":false}" > "$CONFIG_FILE"

  TOKEN_REPORTER_PLUGIN_ROOT="$PLUGIN_ROOT" \
  TOKEN_REPORTER_DATA_DIR="$DATA_DIR" \
    node "$PLUGIN_ROOT/src/server.js" &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  sleep 0.5

  if kill -0 "$pid" 2>/dev/null; then
    echo "Dev server started (PID $pid) at http://localhost:$DEV_PORT"
  else
    rm -f "$PID_FILE"
    echo "Failed to start dev server. Check logs above." >&2
    return 1
  fi
}

do_stop() {
  if ! is_running; then
    echo "Dev server not running"
    # Clean up stale PID file
    rm -f "$PID_FILE"
    return 0
  fi
  local pid
  pid=$(get_pid)
  kill "$pid" 2>/dev/null
  # Wait up to 3 seconds for graceful shutdown
  for i in 1 2 3; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  # Force kill if still running
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null
  fi
  rm -f "$PID_FILE"
  echo "Dev server stopped (was PID $pid)"
}

do_restart() {
  do_stop
  do_start
}

do_status() {
  if is_running; then
    echo "Dev server running (PID $(get_pid)) on port $DEV_PORT"
    echo "  Plugin root: $PLUGIN_ROOT"
    echo "  Data dir:    $DATA_DIR"
    echo "  URL:         http://localhost:$DEV_PORT"
  else
    echo "Dev server not running"
    rm -f "$PID_FILE"
  fi
}

case "${1:-status}" in
  start)   do_start   ;;
  stop)    do_stop    ;;
  restart) do_restart ;;
  status)  do_status  ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}" >&2
    echo "  DEV_PORT env var overrides port (default: 13737)" >&2
    exit 1
    ;;
esac
