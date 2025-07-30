# GitHub App Setup Guide

This guide walks you through creating and configuring the GitHub App for Flaky Test Detector.

## Prerequisites

- GitHub organization or personal account with admin access
- Access to GitHub App settings
- Domain name for your application (e.g., `flakytest.dev`)

## Step 1: Create the GitHub App

### Option A: Using the Manifest (Recommended)

1. Navigate to your GitHub organization settings: `https://github.com/organizations/{your-org}/settings/apps`
2. Click "New GitHub App"
3. Click "Create GitHub App from a manifest"
4. Copy the contents of `github-app-manifest.json` and paste it into the manifest field
5. Click "Create app"

### Option B: Manual Setup

1. Navigate to: `https://github.com/settings/apps/new`
2. Fill in the following details:

**Basic Information:**
- **GitHub App name:** `Flaky Test Detector`
- **Description:** `AI-powered detection and intelligent retry logic for flaky tests in your CI/CD pipeline`
- **Homepage URL:** `https://flakytest.dev`
- **User authorization callback URL:** `https://flakytest.dev/auth/github/callback`
- **Setup URL:** `https://flakytest.dev/setup`
- **Webhook URL:** `https://api.flakytest.dev/api/webhooks/github`

**Webhook:**
- ✅ Active
- **Webhook secret:** Generate a random secret (save this for later)

**Repository permissions:**
- **Actions:** Read
- **Checks:** Read & Write
- **Contents:** Read
- **Issues:** Write
- **Metadata:** Read
- **Pull requests:** Write
- **Repository hooks:** Read
- **Statuses:** Write

**Subscribe to events:**
- ✅ Check run
- ✅ Check suite
- ✅ Pull request
- ✅ Workflow run
- ✅ Push
- ✅ Installation
- ✅ Installation repositories

**Where can this GitHub App be installed?**
- ✅ Any account (for marketplace distribution)

## Step 2: Configure Environment Variables

After creating the app, you'll receive:
- **App ID**
- **Private Key** (download the .pem file)
- **Webhook Secret**

Add these to your environment variables:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# API URLs
FRONTEND_URL=https://flakytest.dev
API_URL=https://api.flakytest.dev
```

### Handling the Private Key

The private key can be set in several ways:

**Option 1: Direct PEM content**
```bash
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----"
```

**Option 2: Base64 encoded**
```bash
# First encode the key:
cat private-key.pem | base64 -w 0

# Then set the environment variable:
GITHUB_APP_PRIVATE_KEY=LS0tLS1CRUdJTi...
```

**Option 3: File path (for development)**
```bash
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem
```

## Step 3: Test the Configuration

Run the configuration validation:

```bash
# In your backend directory
npm run dev

# The service will validate GitHub App configuration on startup
# Check logs for validation results
```

Or test programmatically:

```typescript
import { GitHubAppService } from './src/services/github-app.service';

const githubApp = GitHubAppService.getInstance();
const validation = githubApp.validateConfiguration();

if (!validation.valid) {
  console.error('GitHub App configuration errors:', validation.errors);
} else {
  console.log('GitHub App configuration is valid!');
}
```

## Step 4: Install the App

### For Development

1. Go to your GitHub App settings
2. Click "Install App" 
3. Select your development repositories
4. Choose permissions and repository access

### For Production

1. Submit your app for verification (if distributing publicly)
2. Users can install via GitHub Marketplace or direct installation URL:
   `https://github.com/apps/flaky-test-detector`

## Step 5: Configure Webhooks

The app will automatically receive webhooks for:

- **Workflow runs** → Analyze test results for flaky patterns
- **Pull requests** → Provide flaky test analysis in PR comments
- **Check runs** → Monitor test execution and retry failed tests
- **Pushes** → Track test stability across commits

### Webhook Security

Webhooks are secured using:
- HMAC-SHA256 signature verification
- Installation token validation
- Rate limiting

## Step 6: Repository Setup

For each repository using Flaky Test Detector:

### 1. Enable GitHub Actions
Ensure GitHub Actions is enabled in repository settings.

### 2. Configure Test Reporting
Add test result uploading to your workflow:

```yaml
# .github/workflows/test.yml
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: |
      test-results/**/*.xml
      coverage/**
      junit.xml
```

### 3. Create Project in Dashboard
1. Login to Flaky Test Detector dashboard
2. Click "Add Project"
3. Select your GitHub repository
4. Configure retry settings and notification preferences

## Step 7: Advanced Configuration

### Custom Test Commands

Configure custom test commands for different project types:

```json
{
  "testRunner": "npm",
  "testCommand": "npm test",
  "testPattern": "npm test -- --testNamePattern=\"{tests}\"",
  "setupCommands": [
    "npm install",
    "npm run build"
  ],
  "nodeVersion": "18"
}
```

### Webhook Filtering

Optionally filter webhooks to specific branches or event types:

```javascript
// In webhook handler
if (payload.ref !== 'refs/heads/main') {
  return; // Only process main branch
}
```

### Rate Limiting

Configure rate limits for webhook processing:

```javascript
// webhook rate limit: 100 requests per minute per installation
app.use('/api/webhooks/github', rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each installation to 100 requests per windowMs
  keyGenerator: (req) => req.headers['x-github-installation'] || 'unknown'
}));
```

## Troubleshooting

### Common Issues

**1. "Invalid GitHub App configuration"**
- Check that `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are set correctly
- Ensure private key format is correct (PEM with newlines or base64 encoded)

**2. "Installation token generation failed"**
- Verify the GitHub App has correct permissions
- Check that the installation ID is correct
- Ensure the app is installed on the target repository

**3. "Webhook signature verification failed"**
- Confirm `GITHUB_WEBHOOK_SECRET` matches the app configuration
- Check that webhook URL is accessible and returns 200 OK

**4. "Repository not found"**
- Verify the app has access to the repository
- Check repository permissions in app installation settings

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Testing Webhooks Locally

Use ngrok for local webhook testing:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3001

# Update webhook URL in GitHub App settings to:
# https://your-ngrok-url.ngrok.io/api/webhooks/github
```

## Security Considerations

1. **Private Key Storage:** Never commit private keys to version control
2. **Webhook Secrets:** Use strong, randomly generated webhook secrets
3. **Token Rotation:** GitHub installation tokens expire after 1 hour (handled automatically)
4. **HTTPS Only:** Always use HTTPS for webhook URLs in production
5. **Input Validation:** All webhook payloads are validated using Zod schemas

## Marketplace Distribution

To distribute your app on GitHub Marketplace:

1. Complete app verification process
2. Add pricing information (if paid)
3. Create marketing materials
4. Submit for review

The app manifest is configured for public distribution and will appear in GitHub Marketplace once approved.

## Support

For issues with GitHub App setup:

1. Check the [GitHub Apps documentation](https://docs.github.com/en/developers/apps)
2. Review webhook delivery logs in GitHub App settings
3. Check application logs for detailed error messages
4. Contact support with specific error messages and configuration details