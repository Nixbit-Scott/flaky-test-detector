#!/bin/bash

# Docker Startup Script for Nixbit
# This script helps start the application in different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-development}
PROFILE=${2:-default}

echo -e "${GREEN}🚀 Starting Nixbit in ${ENVIRONMENT} mode${NC}"

# Function to check if required environment files exist
check_env_files() {
    local env_file=".env.${ENVIRONMENT}"
    
    if [ "$ENVIRONMENT" = "development" ]; then
        env_file=".env"
    fi
    
    if [ ! -f "$env_file" ]; then
        echo -e "${RED}❌ Environment file $env_file not found${NC}"
        echo -e "${YELLOW}💡 Copy .env.example to $env_file and configure your settings${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment file $env_file found${NC}"
}

# Function to build shared package
build_shared() {
    echo -e "${YELLOW}📦 Building shared package...${NC}"
    npm run build:shared
    echo -e "${GREEN}✅ Shared package built${NC}"
}

# Function to start services based on environment
start_services() {
    case $ENVIRONMENT in
        "development")
            echo -e "${YELLOW}🔧 Starting development environment...${NC}"
            docker-compose up --build
            ;;
        "staging")
            echo -e "${YELLOW}🔧 Starting staging environment...${NC}"
            docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.staging up --build -d
            ;;
        "production")
            echo -e "${YELLOW}🔧 Starting production environment...${NC}"
            docker-compose -f docker-compose.prod.yml --env-file .env.production up --build -d
            ;;
        *)
            echo -e "${RED}❌ Unknown environment: $ENVIRONMENT${NC}"
            echo -e "${YELLOW}💡 Available environments: development, staging, production${NC}"
            exit 1
            ;;
    esac
}

# Function to show service status
show_status() {
    echo -e "${GREEN}📊 Service Status:${NC}"
    docker-compose ps
    
    echo -e "\n${GREEN}🌐 Service URLs:${NC}"
    case $ENVIRONMENT in
        "development")
            echo -e "Frontend Dashboard: ${YELLOW}http://localhost:3000${NC}"
            echo -e "Admin Dashboard: ${YELLOW}http://localhost:3002${NC}"
            echo -e "Backend API: ${YELLOW}http://localhost:3001${NC}"
            ;;
        "staging")
            echo -e "Frontend Dashboard: ${YELLOW}https://staging.nixbit.dev${NC}"
            echo -e "Admin Dashboard: ${YELLOW}https://admin-staging.nixbit.dev${NC}"
            echo -e "Backend API: ${YELLOW}https://api-staging.nixbit.dev${NC}"
            ;;
        "production")
            echo -e "Frontend Dashboard: ${YELLOW}https://nixbit.com${NC}"
            echo -e "Admin Dashboard: ${YELLOW}https://admin.nixbit.com${NC}"
            echo -e "Backend API: ${YELLOW}https://api.nixbit.com${NC}"
            ;;
    esac
}

# Function to run database migrations
run_migrations() {
    echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
    docker-compose exec backend npx prisma migrate deploy
    echo -e "${GREEN}✅ Database migrations completed${NC}"
}

# Function to show logs
show_logs() {
    echo -e "${YELLOW}📝 Showing application logs...${NC}"
    docker-compose logs -f
}

# Main execution
case $PROFILE in
    "build")
        check_env_files
        build_shared
        start_services
        ;;
    "migrate")
        run_migrations
        ;;
    "logs")
        show_logs
        ;;
    "status")
        show_status
        ;;
    "stop")
        echo -e "${YELLOW}🛑 Stopping services...${NC}"
        docker-compose down
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;
    "clean")
        echo -e "${YELLOW}🧹 Cleaning up containers and volumes...${NC}"
        docker-compose down -v --remove-orphans
        docker system prune -f
        echo -e "${GREEN}✅ Cleanup completed${NC}"
        ;;
    *)
        check_env_files
        build_shared
        start_services
        show_status
        ;;
esac

echo -e "${GREEN}🎉 Nixbit startup completed!${NC}"