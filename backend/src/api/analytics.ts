import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AnalyticsService } from '../services/analytics.service';

const router = Router();

// Validation schemas
const trendQuerySchema = z.object({
  metric: z.enum(['failure_rate', 'test_count', 'flaky_tests', 'retry_success']),
  period: z.enum(['day', 'week', 'month']).default('day'),
  days: z.coerce.number().min(1).max(365).default(30),
});

// GET /api/analytics/project/:projectId - Get comprehensive project analytics
router.get('/project/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const analytics = await AnalyticsService.getProjectAnalytics(projectId, days);

    res.json({
      analytics,
      period: `${days} days`,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/trends/:projectId - Get trend analysis for specific metrics
router.get('/trends/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const validatedQuery = trendQuerySchema.parse(req.query);

    const trendAnalysis = await AnalyticsService.getTrendAnalysis(
      projectId,
      validatedQuery.metric,
      validatedQuery.period,
      validatedQuery.days
    );

    res.json({
      trend: trendAnalysis,
      projectId,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/dashboard - Get user dashboard summary
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const userId = (req.user as any).id;
    const summary = await AnalyticsService.getDashboardSummary(userId);

    res.json({
      summary,
      userId,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/health/:projectId - Get project health score details
router.get('/health/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const analytics = await AnalyticsService.getProjectAnalytics(projectId, 30);

    res.json({
      health: analytics.health,
      overview: analytics.overview,
      projectId,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy endpoints for backward compatibility
// GET /api/analytics/flaky-tests/:projectId
router.get('/flaky-tests/:projectId', async (req: Request, res: Response): Promise<void> => {
  // Redirect to new project analytics endpoint
  res.redirect(`/api/analytics/project/${req.params.projectId}`);
});

export default router;