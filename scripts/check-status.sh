#!/bin/bash

echo "🔍 Checking Docker Compose Service Status..."
echo "============================================="

# Check container status
echo "Container Status:"
sudo docker-compose ps

echo -e "\n📋 Backend Logs (last 20 lines):"
echo "=================================="
sudo docker-compose logs --tail=20 backend

echo -e "\n📋 Frontend Logs (last 10 lines):"
echo "=================================="
sudo docker-compose logs --tail=10 frontend

echo -e "\n📋 Admin Frontend Logs (last 10 lines):"
echo "========================================"
sudo docker-compose logs --tail=10 admin-frontend

echo -e "\n🌐 Quick Health Checks:"
echo "======================="
echo "Backend API health: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health 2>/dev/null || echo 'No response')"
echo "Frontend status: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null || echo 'No response')"
echo "Admin status: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3002 2>/dev/null || echo 'No response')"