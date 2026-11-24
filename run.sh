#!/usr/bin/env bash
# RiverGuard: one command to set up and run the whole website.
#
#   ./run.sh           start (real boat over the MQTT broker in .env)
#   ./run.sh --sim     start with a simulated boat (no hardware needed)
#   ./run.sh stop      stop everything
#   ./run.sh logs      follow backend logs
#   ./run.sh status    show containers
#   ./run.sh reset     stop and DELETE the database
set -euo pipefail

cd "$(dirname "$0")"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

rand() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c "$(($1 * 2))"
  fi
}

# ---------------------------------------------------------------- Docker check
need_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    red "Docker is not installed."
    if [[ "$(uname)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
      read -r -p "Install Docker Desktop with Homebrew now? [y/N] " answer
      if [[ "$answer" =~ ^[Yy]$ ]]; then
        brew install --cask docker
        open -a Docker
      else
        echo "Get it from https://www.docker.com/products/docker-desktop/ and run ./run.sh again."
        exit 1
      fi
    else
      echo "Get it from https://www.docker.com/products/docker-desktop/ and run ./run.sh again."
      exit 1
    fi
  fi

  if ! docker info >/dev/null 2>&1; then
    if [[ "$(uname)" == "Darwin" ]]; then
      yellow "Starting Docker Desktop..."
      open -a Docker || true
    fi
    for _ in $(seq 1 60); do
      docker info >/dev/null 2>&1 && break
      sleep 2
    done
    docker info >/dev/null 2>&1 || { red "Docker is not running. Start Docker Desktop and try again."; exit 1; }
  fi

  if ! docker compose version >/dev/null 2>&1; then
    red "'docker compose' is missing. Update Docker Desktop."
    exit 1
  fi
}

# ---------------------------------------------------------------- .env setup
make_env() {
  if [[ -f .env ]]; then
    return
  fi
  local admin_pw
  admin_pw="$(rand 8)"
  sed \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand 16)|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(rand 32)|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${admin_pw}|" \
    -e "s|^MQTT_CLIENT_ID=.*|MQTT_CLIENT_ID=riverguard-web-$(rand 4)|" \
    .env.example > .env
  green "Created .env with new secrets."
  echo "  Admin login: admin@riverguard.local / ${admin_pw}"
  echo "  (saved in .env as ADMIN_EMAIL / ADMIN_PASSWORD)"
}

env_value() {
  grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true
}

wait_for_site() {
  local port="$1"
  printf "Waiting for the website"
  for _ in $(seq 1 90); do
    if curl -fs "http://localhost:${port}/api/health" >/dev/null 2>&1; then
      echo
      return 0
    fi
    printf "."
    sleep 2
  done
  echo
  red "The backend did not become healthy. Check: ./run.sh logs"
  return 1
}

# ---------------------------------------------------------------- commands
cmd="${1:-up}"

case "$cmd" in
  stop|down)
    need_docker
    docker compose --profile sim down
    green "Stopped."
    ;;
  logs)
    need_docker
    docker compose --profile sim logs -f --tail=100 backend simulator
    ;;
  status|ps)
    need_docker
    docker compose --profile sim ps
    ;;
  reset)
    need_docker
    read -r -p "This deletes ALL missions, telemetry and users. Type 'yes' to continue: " answer
    [[ "$answer" == "yes" ]] || { echo "Cancelled."; exit 0; }
    docker compose --profile sim down -v
    green "Database deleted. Run ./run.sh to start fresh."
    ;;
  up|start|--sim|sim)
    need_docker
    make_env

    if [[ "$cmd" == "--sim" || "$cmd" == "sim" ]]; then
      export MQTT_BROKER_URL="mqtt://mosquitto:1883"
      yellow "Simulation mode: fake boat on the local MQTT broker."
      docker compose --profile sim up -d --build
    else
      docker compose --profile sim stop simulator >/dev/null 2>&1 || true
      docker compose up -d --build
    fi

    port="$(env_value WEB_PORT)"
    port="${port:-8080}"
    wait_for_site "$port"

    green "RiverGuard is running: http://localhost:${port}"
    echo "  Login:  $(env_value ADMIN_EMAIL) / $(env_value ADMIN_PASSWORD)"
    if [[ "$cmd" == "up" || "$cmd" == "start" ]]; then
      echo "  Boat broker: $(env_value MQTT_BROKER_URL)  topics: $(env_value BOAT_TOPIC_PREFIX)/telemetry and /cmd"
    fi
    echo "  Stop: ./run.sh stop    Logs: ./run.sh logs"

    if [[ "$(uname)" == "Darwin" ]]; then
      open "http://localhost:${port}" >/dev/null 2>&1 || true
    fi
    ;;
  *)
    echo "Usage: ./run.sh [--sim | stop | logs | status | reset]"
    exit 1
    ;;
esac
