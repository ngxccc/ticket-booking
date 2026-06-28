#!/usr/bin/env bash
set -euo pipefail

echo "========================================================="
echo "   SYSTEM OPTIMIZATION SCRIPT (Safe Mode)"
echo "========================================================="

# Function to safely disable a service if it exists
disable_service_if_exists() {
    local service_name="$1"
    if systemctl list-unit-files | grep -q "^${service_name}.service"; then
        echo "==> Disabling ${service_name}..."
        sudo systemctl disable --now "${service_name}" || true
    else
        echo "==> ${service_name} not found. Skipping."
    fi
}

# 1. Disable Azure Linux Agent (walinuxagent)
disable_service_if_exists "walinuxagent"

# 2. Disable Unattended Upgrades
disable_service_if_exists "unattended-upgrades"

# 3. Optimize systemd-journald (limit log size to 50MB)
echo "==> Configuring systemd-journald to limit log size..."
sudo mkdir -p /etc/systemd/journald.conf.d
echo -e "[Journal]\nSystemMaxUse=50M\nRuntimeMaxUse=50M" | sudo tee /etc/systemd/journald.conf.d/99-optimize.conf > /dev/null
sudo systemctl restart systemd-journald || true
echo "==> systemd-journald log size limited to 50MB."

# 4. Limit Docker daemon memory usage
echo "==> Limiting Docker daemon memory usage..."
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/memory.conf > /dev/null << INNER
[Service]
MemoryMax=250M
MemoryHigh=200M
INNER
sudo systemctl daemon-reload || true
sudo systemctl restart docker || echo "Docker restart failed (may need manual intervention)"

echo "========================================================="
echo " SYSTEM OPTIMIZATION COMPLETED"
echo "========================================================="
