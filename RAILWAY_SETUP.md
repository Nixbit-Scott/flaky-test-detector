# Railway Deployment Setup

## Services Architecture

Deploy as **3 separate Railway services**:
1. **Database** (PostgreSQL)
2. **Backend API** (Node.js/Express)  
3. **Frontend** (Nginx/Static)

## 1. Database Service (PostgreSQL)

**Service Type:** PostgreSQL Database
- Railway will automatically provision a PostgreSQL database
- Note the connection details for backend configuration

## 2. Backend API Service

**Build Configuration:**
- **Root Directory:** `backend`
- **Dockerfile:** `backend/Dockerfile.prod`
- **Port:** 3001

**Environment Variables:**
```bash
# Database (use Railway PostgreSQL connection string)
DATABASE_URL=postgresql://username:password@host:port/database

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS - Update with your Railway frontend URL
ALLOWED_ORIGINS=https://your-frontend-service.railway.app

# Redis (optional - can use Railway Redis add-on)
REDIS_URL=redis://localhost:6379

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=

# Email (optional - for notifications)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# CI/CD Integrations (optional)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITLAB_TOKEN=
GITLAB_WEBHOOK_SECRET=
JENKINS_URL=
JENKINS_USERNAME=
JENKINS_API_TOKEN=
```

## 3. Frontend Service

**Build Configuration:**
- **Root Directory:** `frontend`  
- **Dockerfile:** `frontend/Dockerfile.prod`
- **Port:** 80

**Environment Variables:**
```bash
# API Base URL - Update with your Railway backend URL
VITE_API_URL=https://your-backend-service.railway.app

# Optional: Analytics, monitoring
VITE_SENTRY_DSN=
VITE_ANALYTICS_ID=
```

**nginx.conf Updates Needed:**
The nginx.conf needs to proxy API calls to the backend service.

## 4. Deployment Steps

1. **Create Railway Project**
2. **Deploy Database First**
3. **Deploy Backend** (configure with database URL)
4. **Deploy Frontend** (configure with backend URL)
5. **Test End-to-End**

## 5. Important Notes

- **Database Migrations:** Run `npx prisma migrate deploy` on first backend deployment
- **Shared Package:** Built automatically in Dockerfiles
- **Health Checks:** All services have health check endpoints
- **Security:** Services run as non-root users
- **Scaling:** Backend can be scaled horizontally on Railway