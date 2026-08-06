#!/usr/bin/env bash
#
# Copy, build, and start protean-api on the VPS.
#
# Everything is done over SSH against a host you already own: the source is rsynced, the
# image is built there, and the container is (re)started. Safe to run repeatedly — each
# step replaces what the previous run left rather than accumulating.
#
#   ./deploy.sh --host 203.0.113.10 --key ../../project/hostinger-protean --env ./.env
#
# Add --domain esign.example.com to terminate TLS with a real certificate. The browser
# calls this service directly from an HTTPS page, so without a domain and certificate the
# app cannot reach it at all — see "TLS" at the bottom of this file.
#
set -euo pipefail

SSH_USER="root"
SSH_HOST=""
SSH_KEY=""
SSH_PORT="22"
ENV_FILE="./.env"
REMOTE_DIR="/opt/protean-api"
DOMAIN=""
IMAGE="protean-api:latest"
CONTAINER="protean-api"
NETWORK="protean-net"

die() { printf '\nerror: %s\n' "$*" >&2; exit 1; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

usage() {
  sed -n '3,13p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'USAGE'

Options:
  --host <ip|hostname>   VPS address                        (required)
  --key <path>           SSH private key                    (required)
  --user <name>          SSH user                           (default: root)
  --port <n>             SSH port                           (default: 22)
  --env <path>           Local env file to install remotely (default: ./.env)
  --domain <name>        Serve HTTPS on this domain via Caddy
  --remote-dir <path>    Where to put the source            (default: /opt/protean-api)
USAGE
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) SSH_HOST="${2:-}"; shift 2 ;;
    --key) SSH_KEY="${2:-}"; shift 2 ;;
    --user) SSH_USER="${2:-}"; shift 2 ;;
    --port) SSH_PORT="${2:-}"; shift 2 ;;
    --env) ENV_FILE="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --remote-dir) REMOTE_DIR="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

# ---------------------------------------------------------------- preflight
# Checked before anything is copied, so a missing key or a half-filled env file fails
# here rather than leaving a partly-deployed host behind.
cd "$(dirname "$0")"

[[ -n "$SSH_HOST" ]] || die "--host is required"
[[ -n "$SSH_KEY" ]] || die "--key is required"
[[ -f "$SSH_KEY" ]] || die "SSH key not found: $SSH_KEY"
[[ -f "$ENV_FILE" ]] || die "env file not found: $ENV_FILE
       Copy .env.example to .env and fill it in first."
[[ -f Dockerfile && -d src ]] || die "run this from services/protean-api/"
command -v rsync >/dev/null || die "rsync is not installed locally"

# The service will not start without these, and finding that out from a container restart
# loop is a worse experience than finding it out now.
for required in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  if ! grep -qE "^${required}=.+" "$ENV_FILE"; then
    die "$required is empty in $ENV_FILE"
  fi
done
if [[ -n "$DOMAIN" ]] && ! grep -qE "^ALLOWED_ORIGINS=.+" "$ENV_FILE"; then
  printf 'warning: ALLOWED_ORIGINS is empty — the API will accept any origin.\n' >&2
fi

SSH_OPTS=(-i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
remote() { ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "$@"; }

step "Checking $SSH_USER@$SSH_HOST"
remote true || die "cannot connect over SSH"
remote "command -v docker >/dev/null" || die "docker is not installed on the VPS.
       Install it first:  curl -fsSL https://get.docker.com | sh"

# ------------------------------------------------------------------- copy
step "Copying source to $REMOTE_DIR"
remote "mkdir -p '$REMOTE_DIR'"
# --delete so a file removed locally does not linger in the image built remotely.
# .env is excluded and sent separately: it is the one thing that must not be world-readable.
rsync -az --delete \
  --exclude '.env' --exclude '.env.*' --exclude '.git' \
  -e "ssh -i '$SSH_KEY' -p '$SSH_PORT' -o StrictHostKeyChecking=accept-new" \
  ./ "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

step "Installing environment"
# Written via stdin rather than scp so the secrets never land in a temp file, and locked
# down before the container ever reads it.
remote "umask 077 && cat > '$REMOTE_DIR/.env' && chmod 600 '$REMOTE_DIR/.env'" < "$ENV_FILE"

# ------------------------------------------------------------------ build
step "Building image"
remote "cd '$REMOTE_DIR' && docker build -t '$IMAGE' ."

# ------------------------------------------------------------------- run
step "Starting $CONTAINER"
remote "docker network inspect '$NETWORK' >/dev/null 2>&1 || docker network create '$NETWORK'"
remote "docker rm -f '$CONTAINER' >/dev/null 2>&1 || true"
# Published on loopback only. Nothing reaches this port from outside except through the
# reverse proxy below, so an unconfigured firewall cannot expose it by accident.
remote "docker run -d \
  --name '$CONTAINER' \
  --network '$NETWORK' \
  --env-file '$REMOTE_DIR/.env' \
  -p 127.0.0.1:8080:8080 \
  --restart unless-stopped \
  '$IMAGE'"

# ------------------------------------------------------------------- TLS
if [[ -n "$DOMAIN" ]]; then
  step "Serving https://$DOMAIN"
  # Caddy obtains and renews a Let's Encrypt certificate on its own, which is the whole
  # reason it is here rather than nginx: one less thing to remember in 90 days.
  remote "mkdir -p '$REMOTE_DIR/caddy' && cat > '$REMOTE_DIR/caddy/Caddyfile' <<EOF
$DOMAIN {
  reverse_proxy $CONTAINER:8080
}
EOF"
  remote "docker rm -f caddy >/dev/null 2>&1 || true"
  remote "docker run -d \
    --name caddy \
    --network '$NETWORK' \
    -p 80:80 -p 443:443 \
    -v '$REMOTE_DIR/caddy/Caddyfile':/etc/caddy/Caddyfile:ro \
    -v caddy_data:/data \
    --restart unless-stopped \
    caddy:2-alpine"
fi

# ------------------------------------------------------------------ verify
step "Verifying"
sleep 3
if ! remote "curl -fsS --max-time 10 http://127.0.0.1:8080/health"; then
  printf '\n'
  remote "docker logs --tail 40 '$CONTAINER'" || true
  die "the service did not answer /health — logs above"
fi
printf '\n'

if [[ -n "$DOMAIN" ]]; then
  step "Checking https://$DOMAIN/health"
  # A fresh certificate can take a few seconds; a failure here is usually DNS not yet
  # pointing at this host, which is worth saying rather than failing silently.
  if curl -fsS --max-time 25 "https://$DOMAIN/health"; then
    printf '\n\nSet VITE_PROTEAN_API_URL=https://%s and rebuild the frontend.\n' "$DOMAIN"
  else
    printf '\nThe container is healthy but https://%s is not answering yet.\n' "$DOMAIN"
    printf 'Usually DNS: point an A record at %s and re-run. Certificate logs:\n' "$SSH_HOST"
    remote "docker logs --tail 20 caddy" || true
  fi
else
  cat <<EOF

Running, reachable on the VPS at 127.0.0.1:8080.

It is NOT reachable from a browser yet — it has no TLS, and an HTTPS page cannot call
an HTTP endpoint. Re-run with --domain <name> once DNS points at $SSH_HOST, or put it
behind your own proxy and set VITE_PROTEAN_API_URL accordingly.
EOF
fi

step "Done"
cat <<EOF
Logs:    ssh -i $SSH_KEY ${SSH_USER}@${SSH_HOST} 'docker logs -f $CONTAINER'
Restart: ssh -i $SSH_KEY ${SSH_USER}@${SSH_HOST} 'docker restart $CONTAINER'

Remember: the egress IP of this host must be the one registered with Protean.
Confirm with: ssh -i $SSH_KEY ${SSH_USER}@${SSH_HOST} 'curl -s https://api.ipify.org'
EOF
