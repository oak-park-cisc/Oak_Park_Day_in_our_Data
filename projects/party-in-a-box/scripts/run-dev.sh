#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/api"
LOG_DIR="${TMPDIR:-/tmp}/partyinabox-dev"
mkdir -p "$LOG_DIR"

BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"
CONTAINER_ENGINE="${CONTAINER_ENGINE:-}"
COMPOSE_CMD=()

usage() {
  cat <<'EOF'
Usage: scripts/run-dev.sh [backend|frontend|all|stop|status]

Commands:
  backend   Start only the FastAPI backend and Postgres database (Podman or Docker)
  frontend  Start only the Vite frontend
  all       Start backend + frontend together
  stop      Stop the running backend and frontend processes
  status    Show whether the backend and frontend are running
  help      Show this message

Default behavior: all

Examples:
  ./scripts/run-dev.sh all
  CONTAINER_ENGINE=docker ./scripts/run-dev.sh all
  CONTAINER_ENGINE=podman ./scripts/run-dev.sh all
  ./scripts/run-dev.sh backend
  ./scripts/run-dev.sh stop
EOF
}

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_container_compose() {
  local requested="${CONTAINER_ENGINE:-auto}"

  case "$requested" in
    auto)
      if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
        CONTAINER_ENGINE=podman
        COMPOSE_CMD=(podman compose)
      elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        CONTAINER_ENGINE=docker
        COMPOSE_CMD=(docker compose)
      else
        echo "Neither Podman Compose nor Docker Compose is available." >&2
        echo "Install Podman with a Compose provider or Docker with the Compose plugin." >&2
        exit 1
      fi
      ;;
    podman)
      if ! command -v podman >/dev/null 2>&1 || ! podman compose version >/dev/null 2>&1; then
        echo "Podman Compose is unavailable. Install Podman and a Compose provider." >&2
        exit 1
      fi
      CONTAINER_ENGINE=podman
      COMPOSE_CMD=(podman compose)
      ;;
    docker)
      if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
        echo "Docker Compose is unavailable. Install Docker and the Compose plugin." >&2
        exit 1
      fi
      CONTAINER_ENGINE=docker
      COMPOSE_CMD=(docker compose)
      ;;
    *)
      echo "Unsupported CONTAINER_ENGINE '$requested'. Use 'podman', 'docker', or 'auto'." >&2
      exit 1
      ;;
  esac
}

run_compose() {
  (cd "$API_DIR" && "${COMPOSE_CMD[@]}" "$@")
}

container_exec() {
  "$CONTAINER_ENGINE" exec "$@"
}

require_supported_node() {
  require_cmd node
  if ! node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    const supported = (major === 20 && minor >= 19) || major >= 22 && (major > 22 || minor >= 12);
    process.exit(supported ? 0 : 1);
  '; then
    echo "Vite requires Node.js ^20.19.0 or >=22.12.0 (found $(node --version))." >&2
    exit 1
  fi
}

ensure_backend_env() {
  if [[ ! -f "$API_DIR/.env" ]]; then
    cp "$API_DIR/.env.example" "$API_DIR/.env"
  fi
}

start_backend() {
  log "Starting PostgreSQL via $CONTAINER_ENGINE..."
  run_compose up -d

  log "Waiting for PostgreSQL to become ready..."
  local database_ready=0
  for _ in $(seq 1 60); do
    if container_exec partyinabox-db pg_isready -U party -d partyinabox >/dev/null 2>&1; then
      database_ready=1
      break
    fi
    sleep 1
  done

  if [[ "$database_ready" -ne 1 ]]; then
    echo "PostgreSQL did not become ready." >&2
    run_compose ps >&2 || true
    run_compose logs db >&2 || true
    exit 1
  fi
  log "PostgreSQL is ready."

  log "Installing backend dependencies..."
  (cd "$API_DIR" && uv sync >/dev/null)

  log "Running Alembic migrations..."
  (cd "$API_DIR" && uv run alembic upgrade head >/dev/null)

  local user_count
  user_count="$(container_exec partyinabox-db psql -U party -d partyinabox -tA -c 'SELECT COUNT(*) FROM users')"
  if [[ "$user_count" == "0" ]]; then
    log "Seeding the empty database with fictional demo data..."
    (cd "$API_DIR" && uv run python -m app.seed >/dev/null)
  else
    log "Database already has data; skipping seed to preserve it."
  fi

  if [[ -f "$BACKEND_PID_FILE" ]] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
    log "Backend is already running."
    return 0
  fi

  log "Starting FastAPI app on http://localhost:8000"
  (
    cd "$API_DIR"
    nohup env PYTHONUNBUFFERED=1 uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
  )

  for _ in $(seq 1 40); do
    if curl -fsS http://localhost:8000/v1/health >/dev/null 2>&1; then
      log "Backend is healthy at http://localhost:8000/v1/health"
      return 0
    fi
    sleep 1
  done

  echo "Backend failed to become healthy." >&2
  echo "Check logs: $LOG_DIR/backend.log" >&2
  exit 1
}

start_frontend() {
  log "Installing/updating frontend dependencies..."
  (cd "$ROOT_DIR" && npm install --no-audit --no-fund >/dev/null)

  if [[ -f "$FRONTEND_PID_FILE" ]] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
    log "Frontend is already running."
    return 0
  fi

  log "Starting Vite frontend on http://localhost:5173"
  (
    cd "$ROOT_DIR"
    nohup env VITE_API_BASE=http://localhost:8000/v1 npm run dev -- --host 0.0.0.0 > "$LOG_DIR/frontend.log" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
  )

  for _ in $(seq 1 40); do
    if curl -fsS http://localhost:5173 >/dev/null 2>&1; then
      log "Frontend is available at http://localhost:5173"
      return 0
    fi
    sleep 1
  done

  echo "Frontend failed to become available." >&2
  echo "Check logs: $LOG_DIR/frontend.log" >&2
  exit 1
}

stop_process() {
  local pid_file="$1"
  local label="$2"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping $label (pid $pid)"
      kill "$pid" || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" || true
      fi
    fi
    rm -f "$pid_file"
  else
    log "$label is not running."
  fi
}

stop_all() {
  stop_process "$BACKEND_PID_FILE" "backend"
  stop_process "$FRONTEND_PID_FILE" "frontend"
  log "Stopped all Party in a Box dev services."
}

status() {
  local backend_ok=0
  local frontend_ok=0

  if [[ -f "$BACKEND_PID_FILE" ]] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
    backend_ok=1
  fi
  if [[ -f "$FRONTEND_PID_FILE" ]] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
    frontend_ok=1
  fi

  echo "Backend:  $( [[ "$backend_ok" -eq 1 ]] && echo "running" || echo "stopped" )"
  echo "Frontend: $( [[ "$frontend_ok" -eq 1 ]] && echo "running" || echo "stopped" )"
  if [[ "$backend_ok" -eq 1 ]]; then
    echo "API health: http://localhost:8000/v1/health"
  fi
  if [[ "$frontend_ok" -eq 1 ]]; then
    echo "Web app: http://localhost:5173"
  fi
}

main() {
  command="${1:-all}"

  case "$command" in
    help|-h|--help)
      usage
      exit 0
      ;;
    backend)
      require_container_compose
      require_cmd curl
      require_cmd uv
      ensure_backend_env
      start_backend
      ;;
    frontend)
      require_cmd npm
      require_cmd curl
      require_supported_node
      start_frontend
      ;;
    all)
      require_container_compose
      require_cmd npm
      require_cmd curl
      require_cmd uv
      require_supported_node
      ensure_backend_env
      start_backend
      start_frontend
      echo
      echo "Full stack is running."
      echo "  Database engine: $CONTAINER_ENGINE"
      echo "  API: http://localhost:8000/v1/health"
      echo "  Frontend: http://localhost:5173"
      ;;
    stop)
      stop_all
      ;;
    status)
      status
      ;;
    *)
      echo "Unknown command: $command" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
