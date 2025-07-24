import { Router } from 'express';
import { z } from 'zod';
import { TestStabilityScoringService } from '../services/test-stability-scoring.service';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const router = Router();
const stabilityService = new TestStabilityScoringService();
const prisma = new PrismaClient();

// Validation schemas
const stabilityQuerySchema = z.object({
  windowDays: z.string().transform(val => parseInt(val)).optional(),
  includeMetrics: z.string().transform(val => val === 'true').optional()
});

const trendQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional(),
  dataPoints: z.string().transform(val => parseInt(val)).optional()
});

// GET /api/stability/project/:projectId
// Get overall project stability report
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Generate stability report
    const stabilityReport = await stabilityService.calculateProjectStability(projectId);

    // Store the report for historical tracking
    await stabilityService.storeStabilityReport(stabilityReport);

    logger.info(`Generated stability report for project ${projectId}: ${Math.round(stabilityReport.overallStability)}% stable`);

    res.json({
      success: true,
      data: stabilityReport
    });

  } catch (error) {
    logger.error('Error generating stability report:', error);
    res.status(500).json({ error: 'Failed to generate stability report' });
  }
});

// GET /api/stability/project/:projectId/summary
// Get high-level stability summary
router.get('/project/:projectId/summary', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get latest stability report or generate new one
    let latestReport = await prisma.stabilityReport.findFirst({
      where: { projectId },
      orderBy: { generatedAt: 'desc' }
    });

    if (!latestReport) {
      // Generate new report if none exists
      const stabilityReport = await stabilityService.calculateProjectStability(projectId);
      await stabilityService.storeStabilityReport(stabilityReport);
      
      res.json({
        success: true,
        data: {
          overallStability: stabilityReport.overallStability,
          totalTests: stabilityReport.totalTests,
          stableTests: stabilityReport.stableTests,
          unstableTests: stabilityReport.unstableTests,
          criticalTests: stabilityReport.criticalTests,
          topInsights: stabilityReport.insights.slice(0, 3),
          topRecommendations: stabilityReport.recommendations.slice(0, 3),
          lastCalculated: stabilityReport.generatedAt,
          isRealTime: true
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        overallStability: latestReport.overallStability,
        totalTests: latestReport.totalTests,
        stableTests: latestReport.stableTests,
        unstableTests: latestReport.unstableTests,
        criticalTests: latestReport.criticalTests,
        topInsights: latestReport.insights.slice(0, 3),
        topRecommendations: latestReport.recommendations.slice(0, 3),
        lastCalculated: latestReport.generatedAt,
        isRealTime: false
      }
    });

  } catch (error) {
    logger.error('Error fetching stability summary:', error);
    res.status(500).json({ error: 'Failed to fetch stability summary' });
  }
});

// GET /api/stability/project/:projectId/trends
// Get stability trends over time
router.get('/project/:projectId/trends', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const query = trendQuerySchema.parse(req.query);

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const period = query.period || 'daily';
    const dataPoints = query.dataPoints || (period === 'daily' ? 30 : period === 'weekly' ? 12 : 6);

    // Generate trend analysis
    const trendAnalysis = await stabilityService.generateTrendAnalysis(projectId, period, dataPoints);

    res.json({
      success: true,
      data: trendAnalysis
    });

  } catch (error) {
    logger.error('Error generating trend analysis:', error);
    res.status(500).json({ error: 'Failed to generate trend analysis' });
  }
});

// GET /api/stability/project/:projectId/tests
// Get stability scores for individual tests
router.get('/project/:projectId/tests', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const query = stabilityQuerySchema.parse(req.query);
    const { sortBy = 'score', order = 'asc', limit = '50' } = req.query;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get all unique tests in the project
    const uniqueTests = await prisma.testResult.groupBy({
      by: ['testName', 'testSuite'],
      where: { projectId },
      _count: { id: true }
    });

    const windowDays = query.windowDays || 30;

    // Calculate stability scores for all tests
    const stabilityScores = await Promise.all(
      uniqueTests.map(test =>
        stabilityService.calculateStabilityScore(
          projectId,
          test.testName,
          test.testSuite || undefined,
          windowDays
        )
      )
    );

    // Sort tests
    let sortedScores = stabilityScores;
    if (sortBy === 'score') {
      sortedScores = stabilityScores.sort((a, b) => 
        order === 'asc' ? a.currentScore - b.currentScore : b.currentScore - a.currentScore
      );
    } else if (sortBy === 'risk') {
      const riskOrder = ['critical', 'high', 'medium', 'low'];
      sortedScores = stabilityScores.sort((a, b) => 
        order === 'asc' 
          ? riskOrder.indexOf(a.riskLevel) - riskOrder.indexOf(b.riskLevel)
          : riskOrder.indexOf(b.riskLevel) - riskOrder.indexOf(a.riskLevel)
      );
    } else if (sortBy === 'confidence') {
      sortedScores = stabilityScores.sort((a, b) => 
        order === 'asc' ? a.confidence - b.confidence : b.confidence - a.confidence
      );
    }

    res.json({
      success: true,
      data: {
        tests: sortedScores.slice(0, parseInt(limit as string)),
        total: stabilityScores.length,
        windowDays,
        sortBy,
        order
      }
    });

  } catch (error) {
    logger.error('Error fetching test stability scores:', error);
    res.status(500).json({ error: 'Failed to fetch stability scores' });
  }
});

// GET /api/stability/project/:projectId/test/:testName
// Get detailed stability analysis for a specific test
router.get('/project/:projectId/test/:testName', authMiddleware, async (req, res) => {
  try {
    const { projectId, testName } = req.params;
    const { testSuite, windowDays = '30' } = req.query;
    const query = stabilityQuerySchema.parse(req.query);

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const decodedTestName = decodeURIComponent(testName);
    const windowDaysNum = parseInt(windowDays as string);

    // Calculate detailed stability score
    const stabilityScore = await stabilityService.calculateStabilityScore(
      projectId,
      decodedTestName,
      testSuite as string || undefined,
      windowDaysNum
    );

    // Get historical trends for this specific test
    const trendAnalysis = await stabilityService.generateTrendAnalysis(projectId, 'daily', 30);

    // Get recent test results for detailed analysis
    const since = new Date();
    since.setDate(since.getDate() - windowDaysNum);

    const recentResults = await prisma.testResult.findMany({
      where: {
        projectId,
        testName: decodedTestName,
        testSuite: testSuite as string || null,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    res.json({
      success: true,
      data: {
        stabilityScore,
        recentResults: recentResults.map(r => ({
          timestamp: r.timestamp,
          status: r.status,
          duration: r.duration,
          retryAttempt: r.retryAttempt
        })),
        trends: trendAnalysis,
        windowDays: windowDaysNum
      }
    });

  } catch (error) {
    logger.error('Error fetching test stability details:', error);
    res.status(500).json({ error: 'Failed to fetch test stability details' });
  }
});

// GET /api/stability/project/:projectId/critical
// Get tests that need immediate attention
router.get('/project/:projectId/critical', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = '10' } = req.query;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get all unique tests in the project
    const uniqueTests = await prisma.testResult.groupBy({
      by: ['testName', 'testSuite'],
      where: { projectId },
      _count: { id: true }
    });

    // Calculate stability scores for all tests
    const stabilityScores = await Promise.all(
      uniqueTests.map(test =>
        stabilityService.calculateStabilityScore(
          projectId,
          test.testName,
          test.testSuite || undefined
        )
      )
    );

    // Filter and sort critical tests
    const criticalTests = stabilityScores
      .filter(score => score.riskLevel === 'critical' || score.riskLevel === 'high')
      .sort((a, b) => a.currentScore - b.currentScore) // Lowest scores first
      .slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: {
        criticalTests,
        totalCritical: stabilityScores.filter(s => s.riskLevel === 'critical').length,
        totalHigh: stabilityScores.filter(s => s.riskLevel === 'high').length,
        urgentActions: criticalTests.length > 0 ? [
          `Investigate ${criticalTests.length} tests with critical stability issues`,
          `Focus on tests with scores below ${Math.max(...criticalTests.map(t => t.currentScore))}`,
          'Check for recent code changes that may have introduced instability'
        ] : ['All tests are stable - no critical issues found']
      }
    });

  } catch (error) {
    logger.error('Error fetching critical tests:', error);
    res.status(500).json({ error: 'Failed to fetch critical tests' });
  }
});

// GET /api/stability/project/:projectId/history
// Get historical stability reports
router.get('/project/:projectId/history', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days = '30', limit = '10' } = req.query;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days as string));

    const historicalReports = await prisma.stabilityReport.findMany({
      where: {
        projectId,
        generatedAt: { gte: since }
      },
      orderBy: { generatedAt: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        generatedAt: true,
        overallStability: true,
        totalTests: true,
        stableTests: true,
        unstableTests: true,
        criticalTests: true,
        insights: true,
        recommendations: true
      }
    });

    res.json({
      success: true,
      data: {
        reports: historicalReports,
        periodDays: parseInt(days as string)
      }
    });

  } catch (error) {
    logger.error('Error fetching stability history:', error);
    res.status(500).json({ error: 'Failed to fetch stability history' });
  }
});

// POST /api/stability/project/:projectId/calculate
// Force recalculation of stability metrics
router.post('/project/:projectId/calculate', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Force recalculation of stability report
    const stabilityReport = await stabilityService.calculateProjectStability(projectId);

    // Store the new report
    await stabilityService.storeStabilityReport(stabilityReport);

    logger.info(`Manual stability calculation triggered for project ${projectId}: ${Math.round(stabilityReport.overallStability)}% stable`);

    res.json({
      success: true,
      data: {
        message: 'Stability metrics recalculated successfully',
        stabilityReport,
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error in manual stability calculation:', error);
    res.status(500).json({ error: 'Failed to recalculate stability metrics' });
  }
});

export default router;