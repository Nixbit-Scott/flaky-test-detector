#!/bin/bash

echo "🔧 Rebuilding backend with missing dependencies..."

# Stop backend service
echo "Stopping backend..."
sudo docker-compose stop backend

# Rebuild backend with new dependencies
echo "Rebuilding backend container..."
sudo docker-compose build --no-cache backend

# Start backend service
echo "Starting backend..."
sudo docker-compose up -d backend

echo "Waiting for backend to initialize..."
sleep 15

echo "Checking backend status..."
sudo docker-compose logs --tail=15 backend

echo -e "\n🌐 Testing backend health..."
sleep 5
backend_status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health 2>/dev/null || echo 'No response')
echo "Backend API health: $backend_status"

if [ "$backend_status" = "200" ]; then
    echo "✅ Backend is now running successfully!"
    echo -e "\n🎉 All services should now be accessible:"
    echo "Frontend Dashboard: http://localhost:3000"
    echo "Admin Dashboard: http://localhost:3002"
    echo "Backend API: http://localhost:3001"
else
    echo "❌ Backend still not responding - checking logs..."
    sudo docker-compose logs --tail=25 backend
fi