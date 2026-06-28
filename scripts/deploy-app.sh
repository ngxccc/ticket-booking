#!/usr/bin/env bash
set -euo pipefail

echo "========================================================="
echo "   ZERO-DOWNTIME BLUE-GREEN DEPLOYMENT PIPELINE"
echo "========================================================="

# 1. Determine which container is currently Active
if sudo docker ps --format '{{.Names}}' | grep -q "^ticket-booking-app-blue$"; then
    ACTIVE="blue"
    NEXT="green"
else
    ACTIVE="green"
    NEXT="blue"
fi

echo "==> Active Container: ticket-booking-app-$ACTIVE"
echo "==> Next Container: ticket-booking-app-$NEXT"
echo "---------------------------------------------------------"

PROJECT_DIR="/home/azureuser/ticket-booking"
cd "$PROJECT_DIR"

# 2. Ensure .env exists
./scripts/generate-env.sh

# 3. Build the latest Docker Image
echo "==> Building new Docker Image..."
sudo docker build -t ticket-booking-app:latest .

# 4. Start the next version container
echo "==> Starting new container (ticket-booking-app-$NEXT)..."
sudo docker rm -f "ticket-booking-app-$NEXT" || true

sudo docker run -d \
  --env-file .env \
  --network ticket-booking_ticket-booking-net \
  --name "ticket-booking-app-$NEXT" \
  --restart unless-stopped \
  --memory="256m" \
  --memory-reservation="128m" \
  --cpus="0.50" \
  ticket-booking-app:latest

# 5. Health Check the new container
echo "==> Performing health check on new container..."
sleep 5 # Wait for app to boot

SUCCESS=0
for i in {1..15}; do
    # Run wget inside the container to test local HTTP response
    if sudo docker exec "ticket-booking-app-$NEXT" wget -qO- http://localhost:3000/ > /dev/null; then
        echo "==> New container (ticket-booking-app-$NEXT) is HEALTHY and ready!"
        SUCCESS=1
        break
    fi
    echo "Waiting for application to boot (attempt $i/15)..."
    sleep 3
done

if [ $SUCCESS -ne 1 ]; then
    echo "❌ ERROR: New container (ticket-booking-app-$NEXT) failed to become healthy."
    echo "==> Fetching logs for container..."
    sudo docker logs "ticket-booking-app-$NEXT" | tail -n 20
    exit 1
fi

# 6. Update Caddyfile & Reload Caddy Proxy
DOMAIN_NAME=$(grep -E "^DOMAIN_NAME=" .env | cut -d'=' -f2- || echo "localhost")
echo "==> Updating Caddyfile for domain: $DOMAIN_NAME to ticket-booking-app-$NEXT..."
cat <<EOF > Caddyfile
$DOMAIN_NAME {
	reverse_proxy ticket-booking-app-$NEXT:3000
}
EOF

# Stream configuration into the Caddy container
sudo docker exec -i ticket-booking-caddy sh -c 'cat > /etc/caddy/Caddyfile' < Caddyfile

# Reload Caddy config instantly
echo "==> Reloading Caddy configuration..."
sudo docker exec ticket-booking-caddy caddy reload --config /etc/caddy/Caddyfile

# 7. Stop and remove the old active container
if sudo docker ps -a --format '{{.Names}}' | grep -q "^ticket-booking-app-$ACTIVE$"; then
    echo "==> Stopping and removing old active container (ticket-booking-app-$ACTIVE)..."
    sudo docker stop "ticket-booking-app-$ACTIVE" || true
    sudo docker rm "ticket-booking-app-$ACTIVE" || true
fi

# 7.5 Clean up legacy single container if exists (first-time transition)
if sudo docker ps -a --format '{{.Names}}' | grep -q "^ticket-booking-container$"; then
    echo "==> Legacy standalone container detected (ticket-booking-container). Stopping and removing..."
    sudo docker stop "ticket-booking-container" || true
    sudo docker rm "ticket-booking-container" || true
fi

# 8. Clean up unused images to save disk space
echo "==> Cleaning up dangling Docker images..."
sudo docker image prune -f

echo "========================================================="
echo " ZERO-DOWNTIME DEPLOYMENT TO ticket-booking-app-$NEXT COMPLETED!"
echo "========================================================="
