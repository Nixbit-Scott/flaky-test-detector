#!/bin/bash

# Start development environment script for Flaky Test Detector

echo "🚀 Starting Flaky Test Detector development environment..."

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    if curl -f -s http://localhost:$port/health > /dev/null 2>&1; then
        echo "✅ $service_name is running on port $port"
        return 0
    else
        echo "❌ $service_name is not responding on port $port"
        return 1
    fi
}

# Start all services
echo "Starting all services with Docker Compose..."
sudo docker-compose up -d

# Wait a moment for services to start
echo "Waiting for services to initialize..."
sleep 10

# Check service health
echo -e "\n📊 Service Status Check:"
echo "========================"

# Check PostgreSQL
if sudo docker-compose exec postgres pg_isready -U nixbit_dev > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi

# Check Redis
if sudo docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

# Check Backend API
echo "Checking backend API..."
sleep 5
if curl -f -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend API is running on http://localhost:3001"
else
    echo "❌ Backend API is not responding"
fi

# Check Frontend
echo "Checking frontend..."
if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is running on http://localhost:3000"
else
    echo "❌ Frontend is not responding"
fi

# Check Admin Frontend
echo "Checking admin frontend..."
if curl -f -s http://localhost:3002 > /dev/null 2>&1; then
    echo "✅ Admin Frontend is running on http://localhost:3002"
else
    echo "❌ Admin Frontend is not responding"
fi

echo -e "\n🌐 Access URLs:"
echo "==============="
echo "Frontend Dashboard: http://localhost:3000"
echo "Admin Dashboard:    http://localhost:3002" 
echo "Backend API:        http://localhost:3001"
echo "Database (external): postgresql://nixbit_dev:dev_password@localhost:5433/nixbit_dev"
echo "Redis (external):    redis://localhost:6380"

echo -e "\n📋 Useful Commands:"
echo "==================="
echo "View logs:          sudo docker-compose logs -f [service_name]"
echo "Stop services:      sudo docker-compose down"
echo "Restart service:    sudo docker-compose restart [service_name]"
echo "View all services:  sudo docker-compose ps"

echo -e "\n✨ Development environment is ready!"