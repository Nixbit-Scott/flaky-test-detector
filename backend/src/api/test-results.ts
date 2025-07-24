import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TestResultService } from '../services/test-result.service';

const router = Router();

// Validation schemas
const submitTestResultsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  branch: z.string().min(1, 'Branch is required'),
  commit: z.string().min(1, 'Commit is required'),
  buildId: z.string().optional(),
  buildUrl: z.string().url().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  testResults: z.array(z.object({
    testName: z.string().min(1, 'Test name is required'),
    testSuite: z.string().optional(),
    status: z.enum(['passed', 'failed', 'skipped']),
    duration: z.number().optional(),
    errorMessage: z.string().optional(),
    stackTrace: z.string().optional(),
    retryAttempt: z.number().optional(),
  })),
});

// POST /api/test-results - Submit test results manually (for API users)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = submitTestResultsSchema.parse(req.body);
    
    // Calculate test statistics
    const stats = TestResultService.calculateTestStatistics(validatedData.testResults);
    
    // Create test run
    const testRun = await TestResultService.createTestRun({
      projectId: validatedData.projectId,
      branch: validatedData.branch,
      commit: validatedData.commit,
      buildId: validatedData.buildId,
      buildUrl: validatedData.buildUrl,
      startedAt: new Date(validatedData.startedAt),
      completedAt: validatedData.completedAt ? new Date(validatedData.completedAt) : undefined,
      ...stats,
      testResults: validatedData.testResults,
    });

    res.status(201).json({
      message: 'Test results submitted successfully',
      testRun,
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

// GET /api/test-results/:projectId - Get test results for a project
router.get('/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const testRuns = await TestResultService.getTestRunsByProject(projectId, limit);

    res.json({
      testRuns,
      total: testRuns.length,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/test-results/run/:runId - Get specific test run details
router.get('/run/:runId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { runId } = req.params;
    const testRun = await TestResultService.getTestRunById(runId);

    res.json({ testRun });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/test-results/project/:projectId/latest - Get latest test run for project
router.get('/project/:projectId/latest', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const testRuns = await TestResultService.getTestRunsByProject(projectId, 1);

    if (testRuns.length === 0) {
      res.status(404).json({ error: 'No test runs found for this project' });
      return;
    }

    res.json({ testRun: testRuns[0] });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;