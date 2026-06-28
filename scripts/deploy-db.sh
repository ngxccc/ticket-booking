#!/usr/bin/env bash
set -euo pipefail

echo "========================================================="
echo "   STAGE 2: DATABASE & REVERSE PROXY LIFE-CYCLE"
echo "========================================================="

PROJECT_DIR="/home/azureuser/ticket-booking"
cd "$PROJECT_DIR"

echo "==> Ensuring Postgres, Redis, and Caddy containers are up..."
sudo docker compose up -d

echo "---------------------------------------------------------"
sudo docker compose ps
echo "========================================================="
