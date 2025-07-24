# Flaky Test Detector - Testing & Demo Scripts

This directory contains scripts for testing, demo setup, and data generation for the Flaky Test Detector platform.

## Scripts Overview

### 🚀 `demo-setup.sh` - Complete Demo Setup
Automated script that sets up a complete demo environment with sample data.

```bash
# Run the complete demo setup
./scripts/demo-setup.sh

# With custom configuration
API_URL="http://localhost:3001/api" \
DEMO_EMAIL="test@example.com" \
./scripts/demo-setup.sh
```

**What it does:**
- Creates a demo user account
- Sets up a sample project
- Generates 20 realistic test runs with flaky patterns
- Simulates CI/CD webhook events
- Runs flaky test analysis
- Provides login credentials and next steps

### 📊 `generate-sample-data.js` - Test Data Generator
Generates realistic test data with various flaky test patterns.

```bash
# Generate sample data
PROJECT_ID="your-project-id" \
BEARER_TOKEN="your-auth-token" \
NUM_RUNS=15 \
node scripts/generate-sample-data.js
```

**Features:**
- Multiple flaky test patterns (timing-sensitive, environment-dependent, intermittent)
- Realistic test durations and error messages
- Configurable number of test runs
- Automatic retry attempt simulation

### 🔗 `test-webhooks.js` - Webhook Testing
Simulates webhook payloads from different CI/CD systems.

```bash
# Test all webhook scenarios
node scripts/test-webhooks.js scenarios

# Generate continuous webhooks for 5 minutes
node scripts/test-webhooks.js continuous 5

# Send single webhook
node scripts/test-webhooks.js single github
node scripts/test-webhooks.js single gitlab
node scripts/test-webhooks.js single jenkins
```

**Supported CI/CD Systems:**
- GitHub Actions
- GitLab CI
- Jenkins

## Environment Variables

### For `demo-setup.sh`:
- `API_URL` - Backend API URL (default: http://localhost:3001/api)
- `FRONTEND_URL` - Frontend URL (default: http://localhost:5173)
- `DEMO_EMAIL` - Demo user email (default: demo@flakytest-detector.com)
- `DEMO_PASSWORD` - Demo user password (default: demo123456)
- `DEMO_PROJECT_NAME` - Project name (default: Demo Project)
- `DEMO_REPO` - Repository name (default: demo-org/demo-app)

### For `generate-sample-data.js`:
- `PROJECT_ID` - Target project ID (required)
- `BEARER_TOKEN` - Authentication token (required)
- `API_URL` - Backend API URL (default: http://localhost:3001/api)
- `NUM_RUNS` - Number of test runs to generate (default: 15)

### For `test-webhooks.js`:
- `WEBHOOK_URL` - Webhook endpoint URL (default: http://localhost:3001/api/webhooks)
- `PROJECT_REPO` - Repository name for webhooks (default: example-org/example-repo)

## Test Data Patterns

The sample data generator creates realistic flaky test patterns:

### 1. **Stable Tests** (5% failure rate)
- Consistent behavior
- Rare random failures

### 2. **Intermittent Tests** (25% failure rate)
- Random failure pattern
- Typical assertion failures

### 3. **Timing-Sensitive Tests** (35% failure rate)
- Clustering failure pattern
- Timeout-related errors
- Animation/wait issues

### 4. **Environment-Dependent Tests** (15% base rate)
- Branch-specific failure rates
- Database/service connection issues
- Configuration-related failures

### 5. **Highly Flaky Tests** (60% failure rate)
- Burst failure pattern
- Concurrency and memory issues

## Usage Examples

### Quick Demo Setup
```bash
# 1. Start the servers
npm run dev

# 2. Run demo setup
./scripts/demo-setup.sh

# 3. Open http://localhost:5173 and login with demo credentials
```

### Manual Testing Workflow
```bash
# 1. Generate auth token
TOKEN=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123"}' \
  http://localhost:3001/api/auth/login | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 2. Create project
PROJECT_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","repository":"test/repo","branch":"main"}' \
  http://localhost:3001/api/projects)

PROJECT_ID=$(echo $PROJECT_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# 3. Generate test data
PROJECT_ID="$PROJECT_ID" BEARER_TOKEN="$TOKEN" \
  node scripts/generate-sample-data.js

# 4. Run analysis
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\"}" \
  http://localhost:3001/api/flaky-tests/analyze

# 5. View results
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/flaky-tests/$PROJECT_ID
```

### Continuous Integration Testing
```bash
# Start webhook simulation for CI testing
WEBHOOK_URL="http://localhost:3001/api/webhooks" \
PROJECT_REPO="ci-test/repo" \
node scripts/test-webhooks.js continuous 10
```

## Troubleshooting

### Common Issues

1. **"Backend server not running"**
   - Start the backend: `npm run dev:backend`
   - Check the API_URL environment variable

2. **"Node.js not found"**
   - Install Node.js 18+ from nodejs.org
   - Verify with: `node --version`

3. **"Project creation failed"**
   - Check authentication token validity
   - Verify database connection
   - Check backend logs for errors

4. **"Webhook tests failing"**
   - Ensure webhook endpoints are implemented
   - Check webhook URL configuration
   - Verify request payload format

### Debug Mode

Enable detailed logging:
```bash
DEBUG=true ./scripts/demo-setup.sh
```

### API Health Check
```bash
curl http://localhost:3001/api/health
```

## Script Dependencies

- **Node.js 18+** - Required for all JavaScript scripts
- **curl** - Required for API requests in shell scripts
- **jq** (optional) - For better JSON parsing
- **node-fetch** - Automatically installed when needed

## Next Steps

After running the scripts:

1. **Explore the Dashboard** - Login and navigate through different tabs
2. **Test API Endpoints** - Use provided curl commands
3. **Configure Real CI/CD** - Set up actual webhook integrations
4. **Customize Patterns** - Modify test patterns in `generate-sample-data.js`
5. **Scale Testing** - Increase `NUM_RUNS` for larger datasets

## Contributing

To add new test patterns or CI/CD integrations:

1. Update `TEST_PATTERNS` in `generate-sample-data.js`
2. Add new webhook generators in `test-webhooks.js`
3. Update this README with new features