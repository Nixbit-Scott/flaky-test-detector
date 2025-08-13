# Flaky Test Detector

A SaaS tool for detecting and handling flaky tests in CI/CD pipelines. Automatically detects tests that fail intermittently and provides intelligent retry logic with comprehensive reporting.

## Features

- **Flaky Test Detection**: AI-powered analysis of test results to identify flaky tests
- **Intelligent Retry Logic**: Smart retry mechanisms based on test history and patterns
- **CI/CD Integration**: Seamless integration with GitHub Actions, Jenkins, GitLab CI, and more
- **Analytics Dashboard**: Comprehensive reporting and insights on test stability
- **Team Management**: Multi-user support with role-based access control
- **Real-time Monitoring**: Live updates on test runs and flaky test patterns

## Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 14+
- Redis (optional, for caching)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd flaky-test-detector
```

2. Install dependencies:
```bash
npm run setup
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

5. Start the development servers:
```bash
npm run dev
```

The frontend will be available at http://localhost:5173 and the backend API at http://localhost:3001.

## Architecture

- **Backend**: Node.js/TypeScript with Express.js API
- **Frontend**: React with TypeScript and Vite
- **Database**: PostgreSQL with Prisma ORM
- **Shared**: Common types and utilities

## CI/CD Integration

### GitHub Actions

Add our GitHub Action to your workflow:

```yaml
- name: Flaky Test Detection
  uses: flaky-test-detector/github-action@v1
  with:
    api-key: ${{ secrets.FLAKY_TEST_DETECTOR_API_KEY }}
    project-id: your-project-id
```

### Jenkins

Install our Jenkins plugin and configure in your Jenkinsfile:

```groovy
post {
  always {
    flakyTestDetector(
      apiKey: env.FLAKY_TEST_DETECTOR_API_KEY,
      projectId: 'your-project-id'
    )
  }
}
```

## Development

### Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build all packages
- `npm run test` - Run all tests
- `npm run lint` - Lint all packages
- `npm run typecheck` - Type check all packages

### Project Structure

```
flaky-test-detector/
├── admin/              # Admin dashboard
├── backend/            # Express.js API server
├── frontend/           # React dashboard application  
├── netlify/            # Netlify serverless functions
├── shared/             # Shared types and utilities
├── docs/               # All documentation
│   ├── beta/          # Beta program guides
│   ├── deployment/    # Deployment & infrastructure
│   └── development/   # Development guides & roadmap
├── scripts/            # Utility scripts
│   ├── tests/         # Test scripts
│   └── setup/         # Setup and configuration
├── config/             # Configuration files
└── marketing/          # Marketing site & beta signup
```

## Pricing

- **Starter**: $29/month - Up to 5 developers, 1 repository
- **Team**: $99/month - Up to 20 developers, 20 repositories
- **Enterprise**: $299/month - 100 developers included (+ $10/month per additional developer), unlimited repositories

## Support

- Documentation: [docs link when available]
- Issues: [GitHub Issues]
- Email: support@flakytest-detector.com

## License

MIT License - see LICENSE file for details.