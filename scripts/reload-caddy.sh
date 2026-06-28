#!/usr/bin/env bash
set -euo pipefail

echo "========================================================="
echo "   STAGE 4: RELOADING CADDY CONFIGURATION"
echo "========================================================="

PROJECT_DIR="/home/azureuser/ticket-booking"
cd "$PROJECT_DIR"

echo "==> Reloading Caddy configuration..."
sudo docker exec ticket-booking-caddy caddy reload --config /etc/caddy/Caddyfile

echo "========================================================="
