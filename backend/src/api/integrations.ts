import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { IntegrationService, SlackWebhookConfig, TeamsWebhookConfig } from '../services/integration.service';

const router = Router();

// Validation schemas
const slackConfigSchema = z.object({
  webhookUrl: z.string().url('Invalid webhook URL'),
  channel: z.string().min(1, 'Channel is required'),
  username: z.string().optional(),
  iconEmoji: z.string().optional(),
  enabled: z.boolean().default(true),
});

const teamsConfigSchema = z.object({
  webhookUrl: z.string().url('Invalid webhook URL'),
  enabled: z.boolean().default(true),
});

const createIntegrationSchema = z.object({
  name: z.string().min(1, 'Integration name is required').max(100),
  type: z.enum(['slack', 'teams']),
  config: z.union([slackConfigSchema, teamsConfigSchema]),
  alertTypes: z.array(z.enum([
    'flaky_test_detected',
    'critical_pattern',
    'quarantine_triggered',
    'daily_summary',
    'high_risk_alert'
  ])).min(1, 'At least one alert type is required'),
});

const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.union([slackConfigSchema, teamsConfigSchema]).optional(),
  alertTypes: z.array(z.enum([
    'flaky_test_detected',
    'critical_pattern',
    'quarantine_triggered',
    'daily_summary',
    'high_risk_alert'
  ])).optional(),
  enabled: z.boolean().optional(),
});

const testIntegrationSchema = z.object({
  type: z.enum(['slack', 'teams']),
  config: z.union([slackConfigSchema, teamsConfigSchema]),
});

// GET /api/integrations/project/:projectId
// Get all integrations for a project
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = (req.user as any).userId;

    // Verify user has access to project
    const response = await fetch(`${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/api/projects/${projectId}`, {
      headers: {
        'Authorization': req.headers.authorization!,
      },
    });

    if (!response.ok) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    const integrations = await IntegrationService.getProjectIntegrations(projectId);

    res.json({
      success: true,
      data: {
        integrations,
      },
    });
  } catch (error) {
    logger.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// POST /api/integrations/project/:projectId
// Create a new integration
router.post('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = (req.user as any).userId;

    // Verify user has access to project
    const response = await fetch(`${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/api/projects/${projectId}`, {
      headers: {
        'Authorization': req.headers.authorization!,
      },
    });

    if (!response.ok) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    const validatedData = createIntegrationSchema.parse(req.body);

    const integration = await IntegrationService.createIntegration(
      projectId,
      validatedData.type,
      validatedData.config as any,
      validatedData.alertTypes,
      validatedData.name
    );

    logger.info(`Integration created for project ${projectId} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        integration,
        message: 'Integration created successfully',
      },
    });
  } catch (error) {
    logger.error('Error creating integration:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to create integration' });
  }
});

// PUT /api/integrations/:integrationId
// Update an integration
router.put('/:integrationId', authMiddleware, async (req, res) => {
  try {
    const { integrationId } = req.params;
    const userId = (req.user as any).userId;

    // First get the integration to check project access
    const integration = await IntegrationService.getIntegrationById(integrationId);

    if (!integration) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    // Verify user has access to project
    const response = await fetch(`${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/api/projects/${integration.projectId}`, {
      headers: {
        'Authorization': req.headers.authorization!,
      },
    });

    if (!response.ok) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    const validatedData = updateIntegrationSchema.parse(req.body);

    const updatedIntegration = await IntegrationService.updateIntegration(integrationId, validatedData as any);

    logger.info(`Integration ${integrationId} updated by user ${userId}`);

    res.json({
      success: true,
      data: {
        integration: updatedIntegration,
        message: 'Integration updated successfully',
      },
    });
  } catch (error) {
    logger.error('Error updating integration:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// DELETE /api/integrations/:integrationId
// Delete an integration
router.delete('/:integrationId', authMiddleware, async (req, res) => {
  try {
    const { integrationId } = req.params;
    const userId = (req.user as any).userId;

    // First get the integration to check project access
    const integration = await IntegrationService.getIntegrationById(integrationId);

    if (!integration) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    // Verify user has access to project
    const response = await fetch(`${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/api/projects/${integration.projectId}`, {
      headers: {
        'Authorization': req.headers.authorization!,
      },
    });

    if (!response.ok) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    await IntegrationService.deleteIntegration(integrationId);

    logger.info(`Integration ${integrationId} deleted by user ${userId}`);

    res.json({
      success: true,
      data: {
        message: 'Integration deleted successfully',
      },
    });
  } catch (error) {
    logger.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// POST /api/integrations/test
// Test an integration configuration
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const userId = (req.user as any).userId;
    const validatedData = testIntegrationSchema.parse(req.body);

    await IntegrationService.testIntegration(validatedData.type, validatedData.config as any);

    logger.info(`Integration test successful for user ${userId}`);

    res.json({
      success: true,
      data: {
        message: 'Integration test successful! Check your Slack/Teams channel.',
      },
    });
  } catch (error) {
    logger.error('Error testing integration:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input data', details: error.errors });
      return;
    }

    res.status(400).json({ 
      error: 'Integration test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/integrations/alert-types
// Get available alert types
router.get('/alert-types', authMiddleware, async (req, res) => {
  try {
    const alertTypes = [
      {
        id: 'flaky_test_detected',
        name: 'Flaky Test Detected',
        description: 'Alert when a new flaky test is detected',
        severity: 'medium',
        recommended: true,
      },
      {
        id: 'critical_pattern',
        name: 'Critical Pattern',
        description: 'Alert when critical cross-repository patterns are found',
        severity: 'critical',
        recommended: true,
      },
      {
        id: 'quarantine_triggered',
        name: 'Test Quarantined',
        description: 'Alert when a test is automatically quarantined',
        severity: 'medium',
        recommended: false,
      },
      {
        id: 'daily_summary',
        name: 'Daily Summary',
        description: 'Daily summary of flaky test activity',
        severity: 'low',
        recommended: false,
      },
      {
        id: 'high_risk_alert',
        name: 'High Risk Alert',
        description: 'Alert when high-risk predictions are made',
        severity: 'high',
        recommended: true,
      },
    ];

    res.json({
      success: true,
      data: {
        alertTypes,
      },
    });
  } catch (error) {
    logger.error('Error fetching alert types:', error);
    res.status(500).json({ error: 'Failed to fetch alert types' });
  }
});

// GET /api/integrations/setup-guide/:type
// Get setup guide for integration type
router.get('/setup-guide/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;

    if (type === 'slack') {
      res.json({
        success: true,
        data: {
          title: 'Slack Integration Setup',
          steps: [
            {
              step: 1,
              title: 'Create Slack App',
              description: 'Go to https://api.slack.com/apps and create a new app',
              details: 'Choose "From scratch" and select your workspace',
            },
            {
              step: 2,
              title: 'Enable Incoming Webhooks',
              description: 'In your app settings, go to "Incoming Webhooks" and activate them',
              details: 'Click "Add New Webhook to Workspace" and select a channel',
            },
            {
              step: 3,
              title: 'Copy Webhook URL',
              description: 'Copy the webhook URL provided by Slack',
              details: 'The URL will look like: https://hooks.slack.com/services/...',
            },
            {
              step: 4,
              title: 'Configure Integration',
              description: 'Paste the webhook URL in the form below and configure your preferences',
              details: 'Choose which alerts you want to receive and test the integration',
            },
          ],
          docs: 'https://api.slack.com/messaging/webhooks',
        },
      });
    } else if (type === 'teams') {
      res.json({
        success: true,
        data: {
          title: 'Microsoft Teams Integration Setup',
          steps: [
            {
              step: 1,
              title: 'Add Incoming Webhook Connector',
              description: 'In your Teams channel, click "..." and select "Connectors"',
              details: 'Find "Incoming Webhook" and click "Add"',
            },
            {
              step: 2,
              title: 'Configure Webhook',
              description: 'Give your webhook a name and optionally upload an image',
              details: 'Click "Create" to generate the webhook URL',
            },
            {
              step: 3,
              title: 'Copy Webhook URL',
              description: 'Copy the webhook URL provided by Teams',
              details: 'The URL will look like: https://outlook.office.com/webhook/...',
            },
            {
              step: 4,
              title: 'Configure Integration',
              description: 'Paste the webhook URL in the form below and configure your preferences',
              details: 'Choose which alerts you want to receive and test the integration',
            },
          ],
          docs: 'https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook',
        },
      });
    } else {
      res.status(400).json({ error: 'Invalid integration type' });
    }
  } catch (error) {
    logger.error('Error fetching setup guide:', error);
    res.status(500).json({ error: 'Failed to fetch setup guide' });
  }
});

export default router;