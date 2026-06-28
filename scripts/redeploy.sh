#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/azureuser/ticket-booking"
cd "$PROJECT_DIR"

# 1. Run setup environment (installs docker, swap)
./scripts/setup-env.sh

# 1.5. Optimize system services (optional but recommended for low-RAM VMs)
./scripts/optimize-system.sh

# 2. Run deploy database (starts postgres, redis, caddy)
./scripts/deploy-db.sh

# 3. Run deploy NestJS application
./scripts/deploy-app.sh

echo "========================================================="
echo "   REDEPLOYMENT PIPELINE COMPLETED!"
echo "========================================================="
