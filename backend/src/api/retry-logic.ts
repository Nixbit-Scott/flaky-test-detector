import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { RetryLogicService } from '../services/retry-logic.service';

const router = Router();

// Validation schemas
const shouldRetrySchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  testName: z.string().min(1, 'Test name is required'),
  testSuite: z.string().optional(),
  currentAttempt: z.number().min(0).default(0),
  lastFailureMessage: z.string().optional(),
  buildId: z.string().optional(),
});

const processFailedTestsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  failedTests: z.array(z.object({
    testName: z.string().min(1, 'Test name is required'),
    testSuite: z.string().optional(),
    errorMessage: z.string().optional(),
  })),
  buildId: z.string().optional(),
  ciSystem: z.enum(['github', 'gitlab', 'jenkins']).default('github'),
});

const updateRetryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  retryDelay: z.number().min(0).max(300).optional(), // Max 5 minutes
});

// POST /api/retry-logic/should-retry - Check if a test should be retried
router.post('/should-retry', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = shouldRetrySchema.parse(req.body);
    
    const decision = await RetryLogicService.shouldRetryTest(validatedData as any);

    res.json({
      decision,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/retry-logic/process-failures - Process a batch of failed tests
router.post('/process-failures', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = processFailedTestsSchema.parse(req.body);
    
    const { retryTests, skipTests } = await RetryLogicService.processFailedTests(
      validatedData.projectId,
      validatedData.failedTests as any,
      validatedData.buildId
    );

    const { commands, delaySeconds } = RetryLogicService.generateRetryCommands(
      retryTests,
      validatedData.ciSystem
    );

    res.json({
      summary: {
        totalFailed: validatedData.failedTests.length,
        willRetry: retryTests.length,
        willSkip: skipTests.length,
      },
      retryTests: retryTests.map(test => ({
        testName: test.testName,
        testSuite: test.testSuite,
        retryAttempt: test.currentAttempt,
      })),
      skipTests: skipTests.map(test => ({
        testName: test.testName,
        testSuite: test.testSuite,
        reason: 'Not identified as flaky or retry limit reached',
      })),
      retryCommands: commands,
      delaySeconds,
      ciSystem: validatedData.ciSystem,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/retry-logic/:projectId/stats - Get retry statistics
router.get('/:projectId/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const stats = await RetryLogicService.getRetryStatistics(projectId, days);

    res.json({
      stats,
      period: `${days} days`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/retry-logic/:projectId/config - Update retry configuration
router.put('/:projectId/config', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const validatedData = updateRetryConfigSchema.parse(req.body);

    await RetryLogicService.updateRetryConfig(projectId, validatedData);

    res.json({
      message: 'Retry configuration updated successfully',
      projectId,
      config: validatedData,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/retry-logic/:projectId/config - Get retry configuration
router.get('/:projectId/config', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;

    const { prisma } = require('../services/database.service');
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        retryEnabled: true,
        maxRetries: true,
        retryDelay: true,
        flakyThreshold: true,
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({
      config: {
        enabled: project.retryEnabled,
        maxRetries: project.maxRetries,
        retryDelay: project.retryDelay,
        flakyThreshold: project.flakyThreshold,
      },
      projectId,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;