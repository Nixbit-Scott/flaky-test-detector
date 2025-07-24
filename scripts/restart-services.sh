#!/bin/bash

echo "🔄 Restarting services with fixes..."

# Stop and restart services to pick up configuration changes
echo "Stopping services..."
sudo docker-compose down

echo "Starting services with updated configuration..."
sudo docker-compose up -d

echo "Waiting for services to initialize..."
sleep 15

echo "Checking service status..."
./scripts/check-status.sh