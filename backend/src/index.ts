import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import * as cron from 'node-cron';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware, authRateLimitMiddleware, webhookRateLimitMiddleware } from './middleware/rate-limit';

// Routes
import authRoutes from './api/auth';
import projectRoutes from './api/projects';
import testResultRoutes from './api/test-results';
import webhookRoutes from './api/webhooks';
import githubWebhookRoutes from './api/github-webhooks';
import githubIntegrationRoutes from './api/github-integration';
import analyticsRoutes from './api/analytics';
import flakyTestRoutes from './api/flaky-tests';
import retryLogicRoutes from './api/retry-logic';
import apiKeyRoutes from './api/api-keys';
import teamRoutes from './api/teams';
import quarantineRoutes from './api/quarantine';
import predictionsRoutes from './api/predictions';
import impactRoutes from './api/impact';
import stabilityRoutes from './api/stability';
import crossRepoPatternsRoutes from './api/cross-repo-patterns';
import integrationRoutes from './api/integrations';
import executiveDashboardRoutes from './api/executive-dashboard';
import organizationRoutes from './api/organizations';
import invitationRoutes from './api/invitations';
import adminRoutes from './api/admin';
import marketingRoutes from './api/marketing';
import subscriptionRoutes from './api/subscription';

// Services
import { NotificationService } from './services/notification.service';
import { webSocketService } from './services/websocket.service';
import { QuarantineSchedulerService } from './services/quarantine-scheduler.service';

dotenv.config();

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware - configured for cross-origin requests
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimitMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '0.1.0'
  });
});

// API routes
// API health check (for frontend compatibility) - must be before other API routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '0.1.0'
  });
});
app.use('/api/auth', authRateLimitMiddleware, authRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/test-results', authMiddleware, testResultRoutes);
app.use('/api/flaky-tests', authMiddleware, flakyTestRoutes);
app.use('/api/retry-logic', authMiddleware, retryLogicRoutes);
app.use('/api/api-keys', authMiddleware, apiKeyRoutes);
app.use('/api/teams', authMiddleware, teamRoutes);
app.use('/api/quarantine', authMiddleware, quarantineRoutes);
app.use('/api/predictions', predictionsRoutes); // Includes both auth and API key routes
app.use('/api/impact', authMiddleware, impactRoutes); // Real-time impact calculator
app.use('/api/stability', authMiddleware, stabilityRoutes); // Test stability scoring and trends
app.use('/api/cross-repo-patterns', authMiddleware, crossRepoPatternsRoutes); // Cross-repository pattern detection
app.use('/api/integrations', authMiddleware, integrationRoutes); // Slack/Teams integrations
app.use('/api/executive-dashboard', authMiddleware, executiveDashboardRoutes); // Executive reporting
app.use('/api/organizations', organizationRoutes); // Organization management (includes auth middleware internally)
app.use('/api/invitations', invitationRoutes); // Invitation management (public endpoints)
app.use('/api/webhooks', webhookRateLimitMiddleware, webhookRoutes); // Rate limited webhooks
app.use('/api/webhooks', webhookRateLimitMiddleware, githubWebhookRoutes); // Enhanced GitHub App webhooks
app.use('/api/github', authMiddleware, githubIntegrationRoutes); // GitHub App integration management
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/admin', adminRoutes); // Admin dashboard (includes admin auth middleware internally)
app.use('/api/marketing', marketingRoutes); // Marketing signup and lead management
app.use('/api/subscription', subscriptionRoutes); // Subscription and billing management

// Catch-all for unmatched API routes - helpful for debugging
app.all('/api/*', (req, res) => {
  logger.warn(`Unmatched API route: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'API route not found', path: req.path, method: req.method });
});

// 404 handler for all other routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
  
  // Initialize WebSocket service
  webSocketService.initialize(server);
  logger.info('📡 WebSocket service initialized');
  
  // Initialize notification service
  const notificationService = new NotificationService();
  
  // Schedule notifications - run every hour for high-risk checks
  cron.schedule('0 * * * *', async () => {
    logger.info('Running hourly high-risk notification check...');
    try {
      await notificationService.checkForHighRiskFiles();
    } catch (error) {
      logger.error('Error in hourly notification check:', error);
    }
  });
  
  // Schedule daily summaries - run at 9 AM every day
  cron.schedule('0 9 * * *', async () => {
    logger.info('Generating daily summaries...');
    try {
      await notificationService.generateDailySummaries();
    } catch (error) {
      logger.error('Error generating daily summaries:', error);
    }
  });
  
  logger.info('📅 Notification scheduling initialized');
  
  // Initialize quarantine automation scheduling
  await QuarantineSchedulerService.initializeScheduling();
});

server.on('error', (error) => {
  logger.error('Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default app;