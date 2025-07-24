# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Flaky Test Detector** is a SaaS tool for detecting and handling flaky tests in CI/CD pipelines. It integrates with GitHub Actions, Jenkins, GitLab CI, and other CI/CD systems to automatically detect tests that fail intermittently and provides intelligent retry logic with comprehensive reporting.

Target market: Development teams with 5-50 developers struggling with flaky tests that waste 2-5 hours per week on debugging. Monetization: $29-99/month per team.

## Architecture

**Monorepo Structure**: The project uses npm workspaces with three main packages:
- `backend/` - Node.js/TypeScript Express API server
- `frontend/` - React/TypeScript dashboard with Vite
- `shared/` - Common types, schemas, and utilities shared between frontend and backend

**Tech Stack**:
- Backend: Node.js, Express, TypeScript, PostgreSQL, Prisma ORM, Redis
- Frontend: React, TypeScript, Vite, TailwindCSS, React Query
- CI/CD Integrations: GitHub Actions, GitLab CI, Jenkins webhooks and APIs

## Common Development Commands

### Setup and Installation
```bash
# Install all dependencies and build shared package
npm run setup

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database (from backend directory)
cd backend
npx prisma migrate dev
npx prisma generate
```

### Development
```bash
# Start all services in development mode
npm run dev

# Start individual services
npm run dev:backend    # Backend API on port 3001
npm run dev:frontend   # Frontend on port 5173

# Build all packages
npm run build

# Run tests across all packages
npm run test

# Lint all packages
npm run lint

# Type check all packages
npm run typecheck
```

### Database Operations (from backend/)
```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create and run migrations
npx prisma migrate dev --name migration-name

# Reset database
npx prisma migrate reset

# View database in browser
npx prisma studio
```

## Key Architectural Patterns

### Shared Types System
The `shared/` package contains all TypeScript interfaces and Zod schemas used by both frontend and backend. Key types:
- `TestResult` - Individual test execution results
- `TestRun` - Complete test suite execution
- `FlakyTestPattern` - Detected flaky test patterns
- `Project` - User projects with CI/CD integration settings

### API Design
REST API with consistent patterns:
- `/api/auth` - Authentication and user management
- `/api/projects` - Project CRUD and settings
- `/api/test-results` - Submit and query test results
- `/api/webhooks` - CI/CD system integrations
- `/api/analytics` - Reporting and insights

### Webhook Integration Architecture
The system receives webhooks from CI/CD systems and processes test results:
1. Webhook receives payload from CI/CD system
2. Payload is parsed and normalized to internal format
3. Test results are analyzed for flaky patterns
4. Retry logic is triggered if configured
5. Analytics are updated and notifications sent

### Database Schema (Prisma)
Core entities:
- `User`, `Team` - Multi-tenant user management
- `Project` - Repository/project configuration
- `TestRun`, `TestResult` - Test execution data
- `FlakyTestPattern` - Detected patterns and analytics
- `ApiKey` - API authentication for CI/CD integrations

## CI/CD Integration Points

### GitHub Actions
Integration via GitHub App with webhook events and API calls for retry logic.

### GitLab CI
Integration via project access tokens and webhook configuration.

### Jenkins
Integration via Jenkins API and webhook notifications.

Each integration handles:
- Authentication and authorization
- Webhook payload parsing and normalization
- Test result extraction and processing
- Retry trigger mechanisms

## Development Guidelines

### Type Safety
- All API routes use Zod schema validation
- Shared types ensure consistency between frontend and backend
- Database operations use Prisma for type-safe queries

### Error Handling
- Comprehensive error middleware in Express
- Structured logging with Winston
- Graceful degradation for CI/CD integration failures

### Testing Strategy
- Unit tests for core business logic
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Mock CI/CD webhooks for testing integrations

## Environment Configuration

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` - GitHub integration
- `GITLAB_TOKEN` - GitLab integration
- `JENKINS_URL`, `JENKINS_USERNAME`, `JENKINS_API_TOKEN` - Jenkins integration

## Flaky Test Detection Algorithm

The core algorithm analyzes test result patterns:
1. **Pattern Recognition**: Identify tests that pass/fail inconsistently
2. **Statistical Analysis**: Calculate failure rates and confidence scores
3. **Context Analysis**: Consider environmental factors (branch, time, CI runner)
4. **Machine Learning**: Improve detection accuracy over time
5. **Threshold Configuration**: Allow teams to tune sensitivity

## Retry Logic System

Intelligent retry mechanisms:
- **Flaky-Only Retries**: Only retry tests identified as flaky
- **Backoff Strategies**: Linear, exponential, or fixed delay patterns
- **Context-Aware**: Consider test history and current failure patterns
- **Configurable Limits**: Maximum retries and timeouts per project

## Performance Considerations

- **Test Result Storage**: Efficient querying with proper indexing
- **Real-time Analytics**: Streaming updates for dashboard
- **Webhook Processing**: Async processing for high-volume CI/CD events
- **Caching Strategy**: Redis for frequently accessed data

## Deployment Architecture

- **Backend**: Containerized Express app with health checks
- **Frontend**: Static build served via CDN
- **Database**: PostgreSQL with read replicas for analytics
- **Queue System**: Redis for background job processing
- **Monitoring**: Application metrics and error tracking

This is an early-stage SaaS product designed for rapid iteration and scaling to target the $10k+ MRR goal.