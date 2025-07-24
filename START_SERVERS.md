# Quick Start Guide - Flaky Test Detector

## Prerequisites (one-time setup)
Make sure these services are running:

### 1. Start PostgreSQL
```bash
sudo systemctl start postgresql
```

### 2. Start Redis
```bash
sudo systemctl start redis-server
```

### 3. Verify Services
```bash
# Test PostgreSQL connection
psql -h localhost -U flaky_user -d flaky_test_detector
# (password: flaky_password123)
# Type \q to exit

# Test Redis connection
redis-cli ping
# Should respond with "PONG"
```

## Start Development Environment

### Option 1: Start Both Servers Together (Recommended)
```bash
cd /home/scott/Documents/MyProjects/ProjectSaaS/flaky-test-detector
npm run dev
```

This starts:
- Backend API on http://localhost:3001
- Frontend on http://localhost:5173

### Option 2: Start Servers Separately
If you need separate terminals:

**Terminal 1 (Backend):**
```bash
cd /home/scott/Documents/MyProjects/ProjectSaaS/flaky-test-detector/backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd /home/scott/Documents/MyProjects/ProjectSaaS/flaky-test-detector/frontend
npm run dev
```

## Verify Everything Works

1. **Backend Health Check:** http://localhost:3001/health
2. **Frontend App:** http://localhost:5173
3. **Database Browser:** 
   ```bash
   cd backend
   npx prisma studio
   ```

## Troubleshooting

### If PostgreSQL won't start:
```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
```

### If Redis won't start:
```bash
sudo systemctl status redis-server
sudo systemctl restart redis-server
```

### If ports are in use:
```bash
# Kill processes on specific ports
sudo lsof -t -i:3001 | xargs kill -9
sudo lsof -t -i:5173 | xargs kill -9
```

### If database connection fails:
Make sure your `.env` file has:
```
DATABASE_URL="postgresql://flaky_user:flaky_password123@localhost:5432/flaky_test_detector"
```

## Useful Development Commands

```bash
# Install new packages
npm install package-name

# Run tests
npm run test

# Check code style
npm run lint

# Build for production
npm run build

# Database operations
npx prisma migrate dev    # Create migration
npx prisma generate      # Generate client
npx prisma studio        # Database browser
```

---

**Quick Start Summary:**
1. `sudo systemctl start postgresql redis-server`
2. `cd /home/scott/Documents/MyProjects/ProjectSaaS/flaky-test-detector`
3. `npm run dev`
4. Visit http://localhost:5173