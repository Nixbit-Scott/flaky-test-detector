import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { QuarantineService } from '../services/quarantine.service';
import { QuarantinePolicyService, QuarantinePolicyConfig } from '../services/quarantine-policy.service';
import { QuarantineAnalyticsService } from '../services/quarantine-analytics.service';

const router = Router();

// Validation schemas
const quarantineTestSchema = z.object({
  projectId: z.string().min(1),
  testName: z.string().min(1),
  testSuite: z.string().optional(),
  reason: z.string().min(1),
});

const unquarantineTestSchema = z.object({
  flakyTestPatternId: z.string().min(1),
  reason: z.string().optional(),
});

const createPolicySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  config: z.object({
    failureRateThreshold: z.number().min(0).max(1),
    confidenceThreshold: z.number().min(0).max(1),
    consecutiveFailures: z.number().min(1),
    minRunsRequired: z.number().min(1),
    stabilityPeriod: z.number().min(1),
    successRateRequired: z.number().min(0).max(1),
    minSuccessfulRuns: z.number().min(1),
    highImpactSuites: z.array(z.string()).default([]),
    priorityTests: z.array(z.string()).default([]),
    enableRapidDegradation: z.boolean().default(true),
    enableCriticalPathProtection: z.boolean().default(true),
    enableTimeBasedRules: z.boolean().default(false),
    maxQuarantinePeriod: z.number().optional(),
    maxQuarantinePercentage: z.number().optional(),
  }),
});

const trackImpactSchema = z.object({
  projectId: z.string().min(1),
  flakyTestPatternId: z.string().min(1),
  buildsBlocked: z.number().optional(),
  ciTimeWasted: z.number().optional(),
  developerHours: z.number().optional(),
  falsePositive: z.boolean().optional(),
});

// GET /api/quarantine/:projectId - Get quarantined tests for a project
router.get('/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    
    const quarantinedTests = await QuarantineService.getQuarantinedTests(projectId);

    res.json({
      success: true,
      data: quarantinedTests,
      total: quarantinedTests.length,
    });

  } catch (error) {
    console.error('Error fetching quarantined tests:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/quarantine/quarantine - Manually quarantine a test
router.post('/quarantine', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = quarantineTestSchema.parse(req.body);
    
    const decision = {
      shouldQuarantine: true,
      reason: validatedData.reason,
      confidence: 1.0, // Manual quarantine has high confidence
      impactScore: 1.0,
      triggeredBy: req.user.userId,
    };

    await QuarantineService.quarantineTest(
      validatedData.projectId,
      validatedData.testName,
      validatedData.testSuite,
      decision,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Test quarantined successfully',
      testName: validatedData.testName,
      testSuite: validatedData.testSuite,
      reason: validatedData.reason,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error quarantining test:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/quarantine/unquarantine - Manually unquarantine a test
router.post('/unquarantine', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = unquarantineTestSchema.parse(req.body);
    
    const decision = {
      shouldUnquarantine: true,
      reason: validatedData.reason || 'Manual unquarantine',
      stabilityScore: 1.0, // Manual unquarantine bypasses stability check
      consecutiveSuccesses: 0,
      daysSinceQuarantine: 0,
    };

    await QuarantineService.unquarantineTest(
      validatedData.flakyTestPatternId,
      decision,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Test unquarantined successfully',
      flakyTestPatternId: validatedData.flakyTestPatternId,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error unquarantining test:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/quarantine/check/:projectId/:testName - Check if a test is quarantined
router.get('/check/:projectId/:testName', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId, testName } = req.params;
    const { testSuite } = req.query;
    
    const isQuarantined = await QuarantineService.isTestQuarantined(
      projectId,
      testName,
      testSuite as string
    );

    res.json({
      success: true,
      isQuarantined,
      testName,
      testSuite: testSuite || null,
    });

  } catch (error) {
    console.error('Error checking quarantine status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/quarantine/run-check/:projectId - Run periodic unquarantine check
router.post('/run-check/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    
    await QuarantineService.runPeriodicUnquarantineCheck(projectId);

    res.json({
      success: true,
      message: 'Unquarantine check completed',
    });

  } catch (error) {
    console.error('Error running unquarantine check:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/quarantine/stats/:projectId - Get quarantine statistics
router.get('/stats/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    
    const stats = await QuarantineService.getQuarantineStats(projectId);

    res.json({
      success: true,
      data: stats,
    });

  } catch (error) {
    console.error('Error fetching quarantine stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POLICY ENDPOINTS

// GET /api/quarantine/policies/:projectId - Get quarantine policies
router.get('/policies/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    
    const policies = await QuarantinePolicyService.getProjectPolicies(projectId);

    res.json({
      success: true,
      data: policies,
    });

  } catch (error) {
    console.error('Error fetching quarantine policies:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/quarantine/policies - Create or update quarantine policy
router.post('/policies', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = createPolicySchema.parse(req.body);
    
    const policyId = await QuarantinePolicyService.createOrUpdatePolicy(
      validatedData.projectId,
      validatedData.name,
      validatedData.config as QuarantinePolicyConfig,
      validatedData.description,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Policy created/updated successfully',
      policyId,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error creating/updating policy:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// PUT /api/quarantine/policies/:policyId/status - Activate/deactivate policy
router.put('/policies/:policyId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { policyId } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
      });
      return;
    }

    await QuarantinePolicyService.setPolicyStatus(policyId, isActive);

    res.json({
      success: true,
      message: `Policy ${isActive ? 'activated' : 'deactivated'} successfully`,
    });

  } catch (error) {
    console.error('Error updating policy status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// DELETE /api/quarantine/policies/:policyId - Delete policy
router.delete('/policies/:policyId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { policyId } = req.params;
    
    await QuarantinePolicyService.deletePolicy(policyId);

    res.json({
      success: true,
      message: 'Policy deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting policy:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/quarantine/policies/simulate - Simulate policy impact
router.post('/policies/simulate', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId, config } = req.body;
    
    if (!projectId || !config) {
      res.status(400).json({
        success: false,
        error: 'projectId and config are required',
      });
      return;
    }

    const simulation = await QuarantinePolicyService.simulatePolicyImpact(
      projectId,
      config as QuarantinePolicyConfig
    );

    res.json({
      success: true,
      data: simulation,
    });

  } catch (error) {
    console.error('Error simulating policy impact:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/quarantine/policies/recommended/:projectId - Get recommended policy
router.get('/policies/recommended/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    
    const recommendedPolicy = await QuarantinePolicyService.getRecommendedPolicy(projectId);

    res.json({
      success: true,
      data: recommendedPolicy,
    });

  } catch (error) {
    console.error('Error getting recommended policy:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ANALYTICS ENDPOINTS

// GET /api/quarantine/analytics/:projectId - Get comprehensive analytics
router.get('/analytics/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const { timeRange } = req.query;
    
    const analytics = await QuarantineAnalyticsService.getProjectAnalytics(
      projectId,
      timeRange as 'week' | 'month' | 'quarter'
    );

    res.json({
      success: true,
      data: analytics,
    });

  } catch (error) {
    console.error('Error fetching quarantine analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/quarantine/track-impact - Track quarantine impact
router.post('/track-impact', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = trackImpactSchema.parse(req.body);
    
    await QuarantineAnalyticsService.trackQuarantineImpact(
      validatedData.projectId,
      validatedData.flakyTestPatternId,
      {
        buildsBlocked: validatedData.buildsBlocked,
        ciTimeWasted: validatedData.ciTimeWasted,
        developerHours: validatedData.developerHours,
        falsePositive: validatedData.falsePositive,
      }
    );

    res.json({
      success: true,
      message: 'Impact tracked successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error tracking impact:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/quarantine/effectiveness/:projectId - Get effectiveness report
router.get('/effectiveness/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    
    const report = await QuarantineAnalyticsService.generateEffectivenessReport(projectId);

    res.json({
      success: true,
      data: report,
    });

  } catch (error) {
    console.error('Error generating effectiveness report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;