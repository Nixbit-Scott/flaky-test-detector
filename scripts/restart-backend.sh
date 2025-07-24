#!/bin/bash

echo "🔄 Restarting backend service with import fixes..."

# Restart just the backend service
echo "Restarting backend..."
sudo docker-compose restart backend

echo "Waiting for backend to initialize..."
sleep 10

echo "Checking backend status..."
sudo docker-compose logs --tail=15 backend

echo -e "\n🌐 Testing backend health..."
sleep 5
backend_status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health 2>/dev/null || echo 'No response')
echo "Backend API health: $backend_status"

if [ "$backend_status" = "200" ]; then
    echo "✅ Backend is now running successfully!"
else
    echo "❌ Backend still not responding - checking logs..."
    sudo docker-compose logs --tail=20 backend
fi