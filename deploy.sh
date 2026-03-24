#!/bin/bash
set -e

echo "=== Deploying Helvara ==="

cd /app

echo "--- Pulling latest code ---"
git pull

echo "--- Rebuilding containers ---"
docker compose up --build -d

echo "--- Running migrations ---"
sleep 5
docker compose exec -T backend alembic upgrade head

echo "--- Deploy complete ==="
