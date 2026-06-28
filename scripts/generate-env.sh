#!/usr/bin/env bash
set -euo pipefail

# Script to initialize the default .env configuration file if it does not exist
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../.env"

if [ -n "${DOPPLER_TOKEN:-}" ]; then
    echo "==> DOPPLER_TOKEN detected. Exporting latest variables from Doppler..."
    if command -v doppler &>/dev/null; then
        # Download secrets as .env format directly to .env file
        doppler secrets download --no-prefix --format dotenv >"$ENV_FILE"
        echo "==> Successfully synced environment variables from Doppler."
    else
        echo "❌ Error: doppler CLI is not installed on this system."
        exit 1
    fi
else
    if [ ! -f "$ENV_FILE" ]; then
        echo "==> Creating default local $ENV_FILE..."
        cat <<EOF >"$ENV_FILE"
NODE_ENV=production
PORT=3000
DOMAIN_NAME=http://ticketbooking.ngxc.io.vn
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgrespassword
DB_DATABASE=ticket_booking
REDIS_HOST=redis
REDIS_PORT=6379
EOF
    else
        echo "==> $ENV_FILE already exists. Checking for missing variables..."
        if ! grep -q "^DOMAIN_NAME=" "$ENV_FILE"; then
            echo "==> Appending DOMAIN_NAME to existing $ENV_FILE..."
            echo "DOMAIN_NAME=http://ticketbooking.ngxc.io.vn" >>"$ENV_FILE"
        fi
    fi
fi
