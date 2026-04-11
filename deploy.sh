#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Build images locally, transfer to server, restart.
#
# Why: The EC2 t3.small (2GB RAM) runs out of memory during Next.js production
# builds. Building on the Mac (plenty of RAM) and transferring the pre-built
# image avoids OOM kills and is faster overall.
#
# Usage: ./deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

SERVER="ubuntu@54.252.20.25"
SSH_KEY="$HOME/Documents/Projects/Translation_app/helvara-key.pem"
SSH="ssh -i $SSH_KEY $SERVER"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploying Helvara ==="

# ── Step 1: Build images locally (in parallel) ──────────────────────────────

PLATFORM="linux/amd64"

# Check if backend files changed since last deploy
BACKEND_CHANGED=true
if git diff HEAD~1 --name-only 2>/dev/null | grep -q "^backend/"; then
  BACKEND_CHANGED=true
else
  BACKEND_CHANGED=false
fi

echo "--- Building frontend image locally (${PLATFORM}) ---"
docker build --platform "$PLATFORM" \
  --cache-from app-frontend:latest \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg NEXT_PUBLIC_POSTHOG_KEY="${NEXT_PUBLIC_POSTHOG_KEY:-}" \
  --build-arg NEXT_PUBLIC_POSTHOG_HOST="${NEXT_PUBLIC_POSTHOG_HOST:-https://eu.i.posthog.com}" \
  -t app-frontend:latest "$PROJECT_DIR/frontend" &

if [ "$BACKEND_CHANGED" = true ]; then
  echo "--- Building backend image locally (${PLATFORM}) ---"
  docker build --platform "$PLATFORM" \
    --cache-from app-backend:latest \
    -t app-backend:latest "$PROJECT_DIR/backend" &
else
  echo "--- Skipping backend build (no backend files changed) ---"
fi

wait

# ── Step 2: Transfer images to server ─────────────────────────────────────────

echo "--- Transferring frontend image to server ---"
docker save app-frontend:latest | gzip | $SSH "docker load"

if [ "$BACKEND_CHANGED" = true ]; then
  echo "--- Transferring backend image to server ---"
  docker save app-backend:latest | gzip | $SSH "docker load"
else
  echo "--- Skipping backend image transfer (no changes) ---"
fi

# ── Step 3: Pull code and restart on server ───────────────────────────────────

echo "--- Pulling latest code on server ---"
$SSH "cd /app && git pull"

echo "--- Restarting containers (no build) ---"
$SSH "cd /app && docker compose up -d"

echo "--- Running migrations ---"
$SSH "sleep 5 && cd /app && docker compose exec -T backend alembic upgrade head"

echo "=== Deploy complete ==="
