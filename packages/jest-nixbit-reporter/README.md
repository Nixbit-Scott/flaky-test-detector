# Jest Nixbit Reporter

A Jest custom reporter that automatically sends test results to the [Nixbit flaky test detection platform](https://nixbit.dev). This reporter enables automatic detection and handling of flaky tests in your CI/CD pipeline.

## Features

- 🔍 **Automatic Flaky Test Detection**: Identifies tests that fail intermittently
- 📊 **Comprehensive Test Analytics**: Detailed reporting and insights
- 🔄 **Intelligent Retry Logic**: Automatically retry only flaky tests
- 🚀 **CI/CD Integration**: Works with GitHub Actions, GitLab CI, Jenkins, and more
- 📈 **Historical Tracking**: Track test stability over time
- ⚡ **Zero Configuration**: Works out of the box with environment variables

## Installation

```bash
npm install --save-dev jest-nixbit-reporter
```

## Quick Start

### 1. Configure Environment Variables

Set the following environment variables in your CI/CD system or `.env` file:

```bash
# Required
NIXBIT_API_KEY=your-nixbit-api-key
NIXBIT_PROJECT_ID=your-project-id

# Optional - Auto-detected in most CI environments
NIXBIT_API_URL=https://nixbit.dev/api  # Default
```

### 2. Add Reporter to Jest Configuration

#### Option A: jest.config.js

```javascript
module.exports = {
  reporters: [
    'default',
    'jest-nixbit-reporter'
  ]
};
```

#### Option B: package.json

```json
{
  "jest": {
    "reporters": [
      "default",
      "jest-nixbit-reporter"
    ]
  }
}
```

#### Option C: Command Line

```bash
jest --reporters=default --reporters=jest-nixbit-reporter
```

### 3. Run Your Tests

```bash
npm test
```

The reporter will automatically send test results to Nixbit after each test run.

## Configuration Options

You can customize the reporter behavior by passing options:

```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-nixbit-reporter', {
      apiUrl: 'https://nixbit.dev/api',
      apiKey: 'your-api-key',
      projectId: 'your-project-id',
      testSuiteName: 'My Custom Test Suite',
      debug: false,
      failSilently: true,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000
    }]
  ]
};
```

### Configuration Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | `https://nixbit.dev/api` | Nixbit API endpoint URL |
| `apiKey` | string | `process.env.NIXBIT_API_KEY` | Your Nixbit API key |
| `projectId` | string | `process.env.NIXBIT_PROJECT_ID` | Your project ID in Nixbit |
| `branch` | string | Auto-detected | Git branch name |
| `commit` | string | Auto-detected | Git commit SHA |
| `buildId` | string | Auto-detected | CI build/run ID |
| `testSuiteName` | string | Package name or "Jest Tests" | Custom test suite name |
| `debug` | boolean | `false` | Enable verbose logging |
| `failSilently` | boolean | `true` | Don't fail tests if API call fails |
| `maxRetries` | number | `3` | Maximum API retry attempts |
| `retryDelay` | number | `1000` | Delay between retries (ms) |
| `timeout` | number | `30000` | API request timeout (ms) |

## Environment Variables

The reporter automatically detects common CI/CD environment variables:

### Git Information
- `CI_COMMIT_REF_NAME` or `GITHUB_REF_NAME` → branch
- `CI_COMMIT_SHA` or `GITHUB_SHA` → commit

### Build Information
- `CI_PIPELINE_ID` or `GITHUB_RUN_ID` → buildId

### CI Detection
The reporter auto-detects CI environments including:
- GitHub Actions
- GitLab CI
- Jenkins
- CircleCI
- And many more

## CI/CD Integration Examples

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
        env:
          NIXBIT_API_KEY: ${{ secrets.NIXBIT_API_KEY }}
          NIXBIT_PROJECT_ID: ${{ secrets.NIXBIT_PROJECT_ID }}
```

### GitLab CI

```yaml
test:
  stage: test
  script:
    - npm ci
    - npm test
  variables:
    NIXBIT_API_KEY: $NIXBIT_API_KEY
    NIXBIT_PROJECT_ID: $NIXBIT_PROJECT_ID
```

### Jenkins

```groovy
pipeline {
  agent any
  environment {
    NIXBIT_API_KEY = credentials('nixbit-api-key')
    NIXBIT_PROJECT_ID = 'your-project-id'
  }
  stages {
    stage('Test') {
      steps {
        sh 'npm ci'
        sh 'npm test'
      }
    }
  }
}
```

## Advanced Usage

### Custom Test Suite Grouping

You can organize tests by different criteria:

```javascript
// Group by feature
{
  testSuiteName: `${process.env.npm_package_name}-${process.env.FEATURE_BRANCH || 'main'}`
}

// Group by environment
{
  testSuiteName: `Integration Tests - ${process.env.NODE_ENV || 'development'}`
}
```

### Error Handling

```javascript
// Fail builds on API errors (not recommended for production)
{
  failSilently: false
}

// Custom retry logic
{
  maxRetries: 5,
  retryDelay: 2000
}
```

### Debug Mode

Enable detailed logging to troubleshoot issues:

```bash
NIXBIT_DEBUG=true npm test
```

Or via configuration:

```javascript
{
  debug: true
}
```

## Test Result Format

The reporter sends comprehensive test data to Nixbit:

```json
{
  "projectId": "your-project-id",
  "testSuiteName": "My Test Suite",
  "branch": "main",
  "commit": "abc123",
  "buildId": "456",
  "timestamp": "2025-01-31T10:00:00.000Z",
  "environment": {
    "nodeVersion": "v18.19.0",
    "jestVersion": "29.7.0",
    "platform": "linux",
    "ci": true
  },
  "summary": {
    "totalTests": 150,
    "passedTests": 145,
    "failedTests": 3,
    "skippedTests": 2,
    "duration": 45000
  },
  "tests": [
    {
      "name": "should authenticate user with valid credentials",
      "suite": "Authentication",
      "status": "passed",
      "duration": 120,
      "filePath": "src/auth.test.js"
    },
    {
      "name": "should handle network timeout gracefully",
      "suite": "API Client",
      "status": "failed",
      "duration": 5000,
      "errorMessage": "Network timeout after 5000ms",
      "stackTrace": "Error: timeout...",
      "retryCount": 2,
      "filePath": "src/api.test.js"
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **Missing API Key**
   ```
   Error: Nixbit API key is required
   ```
   → Set `NIXBIT_API_KEY` environment variable

2. **Missing Project ID**
   ```
   Error: Nixbit project ID is required
   ```
   → Set `NIXBIT_PROJECT_ID` environment variable

3. **API Connection Failed**
   ```
   API Error: POST /test-results - 401
   ```
   → Check your API key is valid and has correct permissions

4. **Timeout Errors**
   ```
   API Error: timeout of 30000ms exceeded
   ```
   → Increase timeout or check network connectivity

### Debug Information

Enable debug mode to see detailed logs:

```bash
NIXBIT_DEBUG=true npm test
```

This will show:
- Configuration validation
- API requests and responses
- Test result processing
- Error details

### Support

- 📖 Documentation: [docs.nixbit.dev](https://docs.nixbit.dev)
- 💬 Support: [support@nixbit.dev](mailto:support@nixbit.dev)
- 🐛 Issues: [GitHub Issues](https://github.com/nixbit/jest-nixbit-reporter/issues)

## License

MIT © [Nixbit](https://nixbit.dev)

## Related Packages

- [cypress-nixbit-plugin](https://www.npmjs.com/package/cypress-nixbit-plugin) - Cypress integration
- [playwright-nixbit-reporter](https://www.npmjs.com/package/playwright-nixbit-reporter) - Playwright integration
- [pytest-nixbit](https://pypi.org/project/pytest-nixbit/) - Python/pytest integration