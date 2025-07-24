# Railway Deployment Guide - Flaky Test Detector

## Overview
Deploy as 4 separate Railway services:
1. **PostgreSQL Database**
2. **Backend API** (Node.js/Express)
3. **Frontend** (React/Nginx)
4. **Admin Frontend** (React/Nginx) - Optional

## Step-by-Step Deployment

### 1. Create New Railway Project
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Empty Project"
4. Name it "Flaky Test Detector"

### 2. Add PostgreSQL Database
1. Click "Add Service" → "Database" → "PostgreSQL"
2. Railway will automatically provision the database
3. Go to Variables tab and copy the `DATABASE_URL`
4. Keep this connection string for backend configuration

### 3. Deploy Backend API
1. Click "Add Service" → "GitHub Repo"
2. Select your flaky-test-detector repository
3. **Configure Build Settings:**
   - **Root Directory:** `backend`
   - **Dockerfile Path:** `backend/Dockerfile.prod`
   - Railway will auto-detect and use the Dockerfile

4. **Add Environment Variables:**
   ```bash
   DATABASE_URL=<PostgreSQL connection string from step 2>
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-please
   JWT_EXPIRES_IN=7d
   PORT=3001
   NODE_ENV=production
   LOG_LEVEL=info
   ALLOWED_ORIGINS=*
   ```

5. **Deploy:** Railway will automatically build and deploy
6. **Note the backend URL** from the service (e.g., `https://backend-production-xxxx.up.railway.app`)

### 4. Deploy Frontend
1. Click "Add Service" → "GitHub Repo" (same repository)
2. **Configure Build Settings:**
   - **Root Directory:** `frontend`
   - **Dockerfile Path:** `frontend/Dockerfile.prod`

3. **Add Environment Variables:**
   ```bash
   VITE_API_URL=<Backend service URL from step 3>
   ```

4. **Deploy:** Railway will automatically build and deploy
5. **Note the frontend URL** for testing

### 5. Deploy Admin Frontend (Optional)
1. Click "Add Service" → "GitHub Repo" (same repository)
2. **Configure Build Settings:**
   - **Root Directory:** `admin-frontend`
   - **Dockerfile Path:** `admin-frontend/Dockerfile.prod`

3. **Add Environment Variables:**
   ```bash
   VITE_API_URL=<Backend service URL from step 3>
   ```

### 6. Run Database Migrations
After backend is deployed:
1. Go to backend service in Railway
2. Open the "Deploy" tab
3. Find a successful deployment and click "View Logs"
4. The Prisma migrations should run automatically on first deployment

## Post-Deployment Configuration

### Update CORS Settings
Once frontend is deployed, update backend environment variables:
```bash
ALLOWED_ORIGINS=https://your-frontend-service.railway.app,https://your-admin-frontend-service.railway.app
```

### Custom Domains (Optional)
1. Go to each service → Settings → Domains
2. Add custom domain if needed
3. Update environment variables accordingly

## Testing the Deployment

### 1. Health Checks
- Backend: `https://your-backend-url/health`
- Frontend: Visit your frontend URL
- Admin: Visit your admin frontend URL

### 2. API Testing
Test API endpoints:
```bash
curl https://your-backend-url/api/health
curl https://your-backend-url/api/projects
```

### 3. Full Integration Test
1. Create an account via the frontend
2. Create a project
3. Test webhook endpoints
4. Verify data persistence

## Environment Variables Reference

### Backend Required Variables
```bash
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
ALLOWED_ORIGINS=https://your-domain.com
```

### Frontend Variables
```bash
VITE_API_URL=https://your-backend-service.railway.app
```

### Optional Variables
```bash
# Redis (if using Railway Redis addon)
REDIS_URL=redis://default:password@host:port

# Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# CI/CD Integrations
GITHUB_APP_ID=your-github-app-id
GITHUB_APP_PRIVATE_KEY=your-private-key
GITLAB_TOKEN=your-gitlab-token
```

## Troubleshooting

### Common Issues
1. **Build Failures:** Check Dockerfile paths and root directories
2. **Database Connection:** Verify DATABASE_URL format
3. **CORS Errors:** Update ALLOWED_ORIGINS after frontend deployment
4. **Environment Variables:** Ensure all required variables are set

### Logs
- View deployment logs in Railway dashboard
- Check application logs for runtime errors
- Monitor health check endpoints

### Database Issues
```bash
# If migrations fail, you may need to reset
# Contact Railway support or manually run migrations
```

## Scaling Considerations

### Production Optimizations
1. **Database:** Upgrade to Railway Pro for better performance
2. **Backend:** Enable horizontal scaling if needed
3. **Monitoring:** Add error tracking (Sentry, etc.)
4. **CDN:** Consider CloudFlare for frontend assets

### Security
1. **Secrets:** Use Railway's secret management
2. **CORS:** Configure specific allowed origins
3. **Rate Limiting:** Already configured in backend
4. **HTTPS:** Enabled by default on Railway

Your application should now be fully deployed and accessible via the Railway-provided URLs!