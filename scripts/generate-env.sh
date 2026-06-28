#!/usr/bin/env bash
set -euo pipefail

# Script to initialize the default .env configuration file if it does not exist
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "==> Creating default $ENV_FILE..."
    cat <<EOF >"$ENV_FILE"
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgrespassword
DB_DATABASE=ticket_booking
REDIS_HOST=redis
REDIS_PORT=6379
DOMAIN_NAME=http://ticketbooking.ngxc.io.vn
EOF
else
    echo "==> $ENV_FILE already exists. Checking for missing variables..."
    if ! grep -q "^DOMAIN_NAME=" "$ENV_FILE"; then
        echo "==> Appending DOMAIN_NAME to existing $ENV_FILE..."
        echo "DOMAIN_NAME=http://ticketbooking.ngxc.io.vn" >>"$ENV_FILE"
    fi
fi
