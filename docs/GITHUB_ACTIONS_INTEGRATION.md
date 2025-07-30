# GitHub Actions Integration - Complete Implementation

## Overview

The Flaky Test Detector now has **complete GitHub Actions integration** with all high-priority features implemented:

✅ **GitHub App Infrastructure** - Full authentication and API access  
✅ **PR Status Checks** - Automated flaky test analysis in pull requests  
✅ **Retry Workflow Generation** - Dynamic GitHub Actions workflows for intelligent retries  
✅ **Artifacts Processing** - Automatic test result extraction from workflow artifacts  
✅ **Marketplace Ready** - Complete GitHub App manifest for distribution

## Architecture

### Core Services

1. **GitHubAppService** (`backend/src/services/github-app.service.ts`)
   - JWT authentication for GitHub App
   - Installation token management with caching
   - Authenticated API requests to GitHub

2. **GitHubStatusChecksService** (`backend/src/services/github-status-checks.service.ts`)
   - PR status checks with flaky test warnings
   - Detailed check runs with annotations
   - Retry status reporting

3. **GitHubRetryWorkflowService** (`backend/src/services/github-retry-workflow.service.ts`)
   - Dynamic workflow generation for different test runners
   - Intelligent retry logic with configurable delays
   - Workflow dispatch and status monitoring

4. **GitHubArtifactsService** (`backend/src/services/github-artifacts.service.ts`)
   - Download and parse test artifacts (JUnit XML, JSON, TAP)
   - Extract test results from workflow runs
   - Support for multiple test frameworks

5. **GitHubPRAnalysisService** (Updated)
   - Now uses GitHub App authentication
   - Analyzes changed test files in PRs
   - Posts detailed analysis comments

### API Endpoints

#### Webhook Endpoints
- `POST /api/webhooks/github` - Enhanced GitHub webhook handler
- Handles: `workflow_run`, `check_run`, `pull_request`, `push`, `installation`

#### Integration Management
- `GET /api/github/installations` - List GitHub App installations
- `GET /api/github/installations/:id/repositories` - List accessible repositories
- `POST /api/github/projects/:id/setup-retry-workflow` - Create retry workflow
- `POST /api/github/projects/:id/trigger-retry` - Manually trigger retries
- `GET /api/github/projects/:id/retry-status/:runId` - Get retry status
- `GET /api/github/config/validate` - Validate GitHub App configuration

## Features

### 1. Automated Flaky Test Detection

When a workflow runs:
1. **Artifacts Analysis** - Downloads and parses test results from artifacts
2. **Pattern Detection** - Identifies flaky test patterns using ML
3. **Status Checks** - Creates GitHub status checks with flaky test warnings
4. **Dashboard Integration** - Results appear in Flaky Test Detector dashboard

### 2. Pull Request Analysis

On PR events (`opened`, `synchronize`, `reopened`):
1. **File Analysis** - Analyzes changed test files for flaky patterns
2. **Risk Assessment** - Assigns risk levels (low/medium/high/critical)
3. **Check Runs** - Creates detailed check runs with annotations
4. **Comments** - Posts analysis comments with recommendations

### 3. Intelligent Retry Logic

For failed tests identified as flaky:
1. **Retry Decision** - Determines which tests should be retried
2. **Workflow Generation** - Creates custom retry workflows
3. **Dispatch** - Automatically triggers retry workflows
4. **Status Tracking** - Monitors retry progress and reports results

### 4. Multi-Framework Support

Supports test result parsing for:
- **JUnit XML** - Java, .NET, Python (pytest), JavaScript (Jest)
- **JSON** - Jest, Mocha, custom formats
- **TAP** - Test Anything Protocol

Test runners supported for retry workflows:
- npm/yarn, Jest, Mocha, pytest, Gradle, Maven, Go

## Setup Guide

### 1. Create GitHub App

Use the provided manifest:
```bash
# Upload github-app-manifest.json to GitHub
# https://github.com/settings/apps/new
```

Or follow the detailed guide: [`docs/GITHUB_APP_SETUP.md`](./GITHUB_APP_SETUP.md)

### 2. Configure Environment Variables

```bash
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
FRONTEND_URL=https://flakytest.dev
```

### 3. Install GitHub App

Install on repositories you want to monitor:
1. Go to GitHub App settings
2. Click "Install App"  
3. Select repositories
4. Configure permissions

### 4. Configure Projects

In the Flaky Test Detector dashboard:
1. Create project for your repository
2. Set GitHub installation ID in project settings
3. Configure retry preferences
4. Set up notification preferences

## Usage Examples

### Basic Workflow Integration

Add to your `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test
      
      # Upload test results for Flaky Test Detector
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            test-results/**/*.xml
            junit.xml
            coverage/**
```

### Custom Retry Configuration

```typescript
// Configure retry workflow for your project
const retryConfig = {
  testRunner: 'npm',
  testCommand: 'npm test',
  testPattern: 'npm test -- --testNamePattern="{tests}"',
  setupCommands: ['npm ci', 'npm run build'],
  nodeVersion: '18'
};

await fetch('/api/github/projects/PROJECT_ID/setup-retry-workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(retryConfig)
});
```

### Manual Retry Trigger

```typescript
// Trigger retry for specific tests
await fetch('/api/github/projects/PROJECT_ID/trigger-retry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    testNames: ['test_flaky_network', 'test_timing_issue'],
    originalRunId: '12345',
    branch: 'main'
  })
});
```

## Webhook Event Handling

### Workflow Run Events
```javascript
{
  "action": "completed",
  "workflow_run": {
    "id": 12345,
    "conclusion": "failure",
    "head_sha": "abc123"
  }
}
```

**Actions Taken:**
1. Download and parse artifacts
2. Analyze for flaky patterns  
3. Create status checks
4. Suggest retries if applicable

### Pull Request Events
```javascript
{
  "action": "opened",
  "pull_request": {
    "number": 42,
    "head": { "sha": "abc123" }
  }
}
```

**Actions Taken:**
1. Analyze changed test files
2. Create check run with risk assessment
3. Post analysis comment
4. Add annotations for high-risk files

## Status Checks and Check Runs

### Status Check Example
- **Context:** `flaky-test-detector/analysis`
- **State:** `success` | `failure` | `pending` | `error`
- **Description:** "⚠️ 3 high-risk flaky tests detected - review recommended"
- **Target URL:** Link to detailed dashboard

### Check Run Example
- **Name:** "Flaky Test Detection"
- **Conclusion:** `success` | `action_required` | `neutral`
- **Annotations:** File-level warnings for high-risk tests
- **Actions:** "View Dashboard", "Configure Retries"

## Retry Workflows

Generated retry workflows include:

1. **Environment Setup** - Node.js, Python, Java, Go based on configuration
2. **Dependency Installation** - npm ci, pip install, etc.
3. **Custom Setup** - User-defined setup commands
4. **Intelligent Delays** - Configurable retry delays (linear/exponential)
5. **Selective Testing** - Only retry tests identified as flaky
6. **Result Reporting** - Automatic status updates

### Sample Generated Workflow

```yaml
name: Flaky Test Retry
on:
  workflow_dispatch:
    inputs:
      retry_tests:
        description: 'Comma-separated list of test names to retry'
        required: true
        type: 'string'

jobs:
  retry_flaky_tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Wait for retry delay
        run: sleep 30
      
      - name: Run flaky test retry
        run: npm test -- --testNamePattern="${{ github.event.inputs.retry_tests }}"
        env:
          RETRY_ATTEMPT: '${{ github.event.inputs.retry_attempt }}'
          FLAKY_TEST_DETECTOR: 'true'
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: retry-test-results
          path: test-results/**
```

## Security

- **Webhook Verification** - HMAC-SHA256 signature validation
- **JWT Authentication** - Secure GitHub App authentication
- **Token Management** - Automatic token refresh and caching
- **Rate Limiting** - Webhook rate limiting by installation
- **Input Validation** - Zod schema validation for all payloads

## Monitoring and Logging

All GitHub integration events are logged with:
- **Webhook Events** - Event type, repository, action
- **API Calls** - Request/response details
- **Error Handling** - Detailed error messages and stack traces
- **Performance Metrics** - Processing times and success rates

## Troubleshooting

### Common Issues

1. **"Invalid GitHub App configuration"**
   - Check `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`
   - Validate private key format

2. **"Installation token generation failed"**
   - Verify GitHub App permissions
   - Check installation ID in project settings

3. **"Webhook signature verification failed"**
   - Confirm `GITHUB_WEBHOOK_SECRET` matches app settings
   - Ensure webhook URL is accessible

4. **"Repository not found"**
   - Verify app installation on repository
   - Check repository permissions

### Debug Commands

```bash
# Validate GitHub App configuration
curl -X GET http://localhost:3001/api/github/config/validate

# List installations
curl -X GET http://localhost:3001/api/github/installations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Clear token cache
curl -X POST http://localhost:3001/api/github/config/clear-cache \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Performance Considerations

- **Token Caching** - Installation tokens cached for 55 minutes
- **Artifact Processing** - Async processing of large artifacts
- **Rate Limiting** - Respects GitHub API rate limits
- **Webhook Batching** - Efficient processing of multiple events
- **Database Optimization** - Indexed queries for flaky pattern detection

## Next Steps

The GitHub Actions integration is now complete and production-ready. Consider:

1. **Beta Testing** - Test with real repositories and workflows
2. **Performance Monitoring** - Track API usage and response times
3. **Feature Expansion** - Add support for additional CI systems
4. **Marketplace Submission** - Submit to GitHub Marketplace
5. **Documentation** - Create user guides and video tutorials

## Support

For GitHub Actions integration issues:
- Check application logs for detailed error messages
- Review webhook delivery logs in GitHub App settings
- Test configuration using provided API endpoints
- Contact support with specific error details