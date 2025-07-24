# Docker Deployment Guide

This guide covers containerized deployment of Nixbit using Docker and Docker Compose.

## Quick Start

### Prerequisites
- Docker 20.0+
- Docker Compose 2.0+
- Node.js 18+ (for local development)

### Development Environment

1. **Setup environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start development services:**
   ```bash
   ./scripts/docker-start.sh development
   # Or manually:
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend Dashboard: http://localhost:3000
   - Admin Dashboard: http://localhost:3002
   - Backend API: http://localhost:3001

### Production Environment

1. **Setup production environment:**
   ```bash
   cp .env.production .env.prod
   # Edit .env.prod with production values
   ```

2. **Start production services:**
   ```bash
   ./scripts/docker-start.sh production
   # Or manually:
   docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

## Architecture Overview

### Services

| Service | Description | Port | Health Check |
|---------|-------------|------|--------------|
| `postgres` | PostgreSQL 15 database | 5432 | `pg_isready` |
| `redis` | Redis cache and session store | 6379 | `redis-cli ping` |
| `backend` | Node.js/Express API server | 3001 | `/health` endpoint |
| `frontend` | React dashboard (nginx) | 3000 | `/health` endpoint |
| `admin-frontend` | Admin React app (nginx) | 3002 | `/health` endpoint |
| `nginx` | Reverse proxy (optional) | 80/443 | HTTP check |

### Network Architecture

```
Internet → Nginx (Reverse Proxy) → Frontend/Admin/Backend
                                 ↓
                              Database ← Redis
```

## Configuration

### Environment Files

- `.env` - Development configuration
- `.env.staging` - Staging environment
- `.env.production` - Production environment
- `.env.example` - Template with all available options

### Key Configuration Sections

#### Database
```env
DATABASE_URL=postgresql://user:pass@postgres:5432/nixbit
POSTGRES_DB=nixbit
POSTGRES_USER=nixbit
POSTGRES_PASSWORD=secure_password
```

#### Redis
```env
REDIS_URL=redis://:password@redis:6379
REDIS_PASSWORD=secure_redis_password
```

#### Security
```env
JWT_SECRET=your_32_char_minimum_secret_key
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com
```

#### Integrations
```env
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key
GITLAB_TOKEN=your_gitlab_token
```

## Docker Images

### Backend (Node.js)
- **Base Image:** `node:18-alpine`
- **Multi-stage build:** Builder + Production
- **Security:** Non-root user, minimal dependencies
- **Health Check:** HTTP endpoint `/health`

### Frontend/Admin (React + Nginx)
- **Base Image:** `node:18-alpine` → `nginx:alpine`
- **Build Process:** Vite build → Static files
- **Security:** Non-root nginx user
- **Features:** Gzip compression, SPA routing, caching

### Database & Cache
- **PostgreSQL:** `postgres:15-alpine`
- **Redis:** `redis:7-alpine`
- **Persistence:** Named volumes

## Scripts and Utilities

### Docker Startup Script
```bash
# Development
./scripts/docker-start.sh development

# Staging
./scripts/docker-start.sh staging

# Production
./scripts/docker-start.sh production

# Additional commands
./scripts/docker-start.sh development logs     # View logs
./scripts/docker-start.sh development migrate  # Run migrations
./scripts/docker-start.sh development stop     # Stop services
./scripts/docker-start.sh development clean    # Full cleanup
```

### Manual Commands

#### Build and Start
```bash
# Development
docker-compose up --build

# Production
docker-compose -f docker-compose.prod.yml up --build -d
```

#### Database Operations
```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Access database
docker-compose exec postgres psql -U nixbit -d nixbit

# Backup database
docker-compose exec postgres pg_dump -U nixbit nixbit > backup.sql
```

#### Monitoring
```bash
# View logs
docker-compose logs -f [service_name]

# Monitor resources
docker stats

# Health checks
docker-compose ps
```

## Production Deployment

### 1. Server Requirements
- **CPU:** 2+ cores
- **RAM:** 4GB+ recommended
- **Storage:** 20GB+ for containers and data
- **Network:** HTTPS/SSL certificates

### 2. Security Checklist
- [ ] Change all default passwords
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Enable firewall rules
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging

### 3. Environment Setup
```bash
# Clone repository
git clone https://github.com/yourorg/nixbit.git
cd nixbit

# Setup production environment
cp .env.production .env.prod
# Edit .env.prod with production values

# Start services
./scripts/docker-start.sh production
```

### 4. SSL/TLS Configuration
Place certificates in `/etc/ssl/` and update nginx configuration:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    # ... rest of configuration
}
```

## Monitoring and Maintenance

### Health Checks
All services include health checks that can be monitored:
```bash
# Check service health
docker-compose ps

# View health check logs
docker inspect --format='{{.State.Health}}' container_name
```

### Log Management
```bash
# View all logs
docker-compose logs

# Follow specific service logs
docker-compose logs -f backend

# Limit log output
docker-compose logs --tail=100 frontend
```

### Performance Monitoring
Consider adding these monitoring solutions:
- **Application:** Sentry for error tracking
- **Infrastructure:** Prometheus + Grafana
- **Logs:** ELK Stack or Loki
- **Uptime:** UptimeRobot or similar

### Backup Strategy
```bash
# Database backup
docker-compose exec postgres pg_dump -U nixbit nixbit > nixbit_backup_$(date +%Y%m%d).sql

# Redis backup
docker-compose exec redis redis-cli SAVE
docker cp container_name:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb

# Code and config backup
tar -czf nixbit_config_$(date +%Y%m%d).tar.gz .env.prod docker-compose.prod.yml
```

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs service_name

# Check configuration
docker-compose config

# Restart specific service
docker-compose restart service_name
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U nixbit

# Check network connectivity
docker-compose exec backend ping postgres

# Verify environment variables
docker-compose exec backend env | grep DATABASE
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check container logs for errors
docker-compose logs backend | grep ERROR

# Analyze database performance
docker-compose exec postgres psql -U nixbit -c "SELECT * FROM pg_stat_activity;"
```

### Getting Help
- Check container logs: `docker-compose logs [service]`
- Verify configuration: `docker-compose config`
- Monitor resources: `docker stats`
- Test connectivity: `docker-compose exec [service] [command]`

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Build | Source mounts, hot reload | Optimized builds, static files |
| Security | Relaxed settings | Hardened security, secrets |
| Logging | Debug level | Warn/error level |
| Persistence | Local volumes | External storage/volumes |
| SSL | HTTP only | HTTPS required |
| Monitoring | Basic health checks | Full monitoring stack |

## Next Steps

After successful deployment:
1. Set up CI/CD pipelines
2. Configure monitoring and alerting
3. Implement backup procedures
4. Set up staging environment
5. Configure load balancing (if needed)
6. Implement log aggregation
7. Set up automated updates