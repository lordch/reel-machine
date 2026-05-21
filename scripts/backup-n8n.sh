#!/bin/bash
# Backup n8n volume to R2.
# Strategy: stop n8n briefly, tar /var/lib/docker/volumes/reel-machine_n8n_data/_data,
# upload via API container (reuses uploadToR2 from src/api/storage.ts), start n8n.
# Downtime: ~5-10s. Run daily via cron.

set -euo pipefail

DATE=$(date +%Y-%m-%d)
TARBALL="/tmp/n8n-${DATE}.tar.gz"
REMOTE_KEY="backups/n8n/n8n-${DATE}.tar.gz"
VOLUME_DATA="/var/lib/docker/volumes/reel-machine_n8n_data/_data"

cd /opt/reel-machine

echo "[$(date)] === n8n backup START ==="

echo "[$(date)] Stopping n8n container..."
docker compose stop n8n

echo "[$(date)] Creating tarball..."
tar czf "$TARBALL" -C "$VOLUME_DATA" .

echo "[$(date)] Starting n8n container..."
docker compose start n8n

SIZE_MB=$(du -m "$TARBALL" | cut -f1)
echo "[$(date)] Tarball size: ${SIZE_MB} MB"

echo "[$(date)] Uploading to R2 as ${REMOTE_KEY}..."
# Copy upload script into container (may not be in the image yet — only built-in after redeploy)
docker cp /opt/reel-machine/scripts/backup-upload.ts reel-machine-api-1:/app/scripts/backup-upload.ts
docker cp "$TARBALL" reel-machine-api-1:"$TARBALL"
docker exec reel-machine-api-1 npx tsx scripts/backup-upload.ts "$TARBALL" "$REMOTE_KEY"
docker exec reel-machine-api-1 rm -f "$TARBALL"

rm -f "$TARBALL"

echo "[$(date)] === n8n backup DONE ==="
