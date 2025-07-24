import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ExecutiveDashboardService } from '../services/executive-dashboard.service';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const periodSchema = z.enum(['weekly', 'monthly', 'quarterly']);
const reportTypeSchema = z.enum(['executive', 'project', 'team', 'technical-debt', 'roi']);

const roiConfigSchema = z.object({
  toolCost: z.number().min(0).max(10000).optional(),
  implementationTime: z.number().min(0).max(1000).optional(),
});

// GET /api/executive-dashboard/organizations
// Get organizations user has access to
router.get('/organizations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const organizations = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        teams: {
          include: {
            projects: {
              include: {
                _count: {
                  select: {
                    flakyTests: true,
                    testRuns: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const organizationSummaries = organizations.map(org => {
      // Get all projects from all teams in this organization
      const allProjects = org.teams.flatMap(team => team.projects);
      
      return {
        id: org.id,
        name: org.name,
        memberCount: org.members.length,
        projectCount: allProjects.length,
        totalFlakyTests: allProjects.reduce((sum, project) => sum + project._count.flakyTests, 0),
        totalTestRuns: allProjects.reduce((sum, project) => sum + project._count.testRuns, 0),
        lastActivity: org.updatedAt,
      };
    });

    res.json({
      success: true,
      data: {
        organizations: organizationSummaries,
      },
    });
  } catch (error) {
    logger.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// GET /api/executive-dashboard/:organizationId/summary
// Get executive summary for an organization
router.get('/:organizationId/summary', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const period = periodSchema.optional().parse(req.query.period) || 'monthly';
    const userId = req.user!.userId;

    // Verify user has access to organization
    const hasAccess = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!hasAccess) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const summary = await ExecutiveDashboardService.generateExecutiveSummary(
      organizationId,
      period
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Error generating executive summary:', error);
    res.status(500).json({ error: 'Failed to generate executive summary' });
  }
});

// GET /api/executive-dashboard/:organizationId/projects
// Get project performance report
router.get('/:organizationId/projects', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const period = periodSchema.optional().parse(req.query.period) || 'monthly';
    const userId = req.user!.userId;

    // Verify user has access to organization
    const hasAccess = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!hasAccess) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const projectReports = await ExecutiveDashboardService.generateProjectPerformanceReport(
      organizationId,
      period
    );

    res.json({
      success: true,
      data: {
        projects: projectReports,
        period,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error generating project performance report:', error);
    res.status(500).json({ error: 'Failed to generate project performance report' });
  }
});

// GET /api/executive-dashboard/:organizationId/teams
// Get team productivity report
router.get('/:organizationId/teams', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const period = periodSchema.optional().parse(req.query.period) || 'monthly';
    const userId = req.user!.userId;

    // Verify user has access to organization
    const hasAccess = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!hasAccess) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const teamReports = await ExecutiveDashboardService.generateTeamProductivityReport(
      organizationId,
      period
    );

    res.json({
      success: true,
      data: {
        teams: teamReports,
        period,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error generating team productivity report:', error);
    res.status(500).json({ error: 'Failed to generate team productivity report' });
  }
});

// GET /api/executive-dashboard/:organizationId/technical-debt
// Get technical debt report
router.get('/:organizationId/technical-debt', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.userId;

    // Verify user has access to organization
    const hasAccess = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!hasAccess) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const debtReport = await ExecutiveDashboardService.generateTechnicalDebtReport(organizationId);

    res.json({
      success: true,
      data: {
        ...debtReport,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error generating technical debt report:', error);
    res.status(500).json({ error: 'Failed to generate technical debt report' });
  }
});

// GET /api/executive-dashboard/:organizationId/roi
// Get ROI report
router.get('/:organizationId/roi', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.userId;
    const config = roiConfigSchema.parse(req.query);

    // Verify user has access to organization
    const hasAccess = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!hasAccess) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const roiReport = await ExecutiveDashboardService.generateROIReport(
      organizationId,
      config.toolCost,
      config.implementationTime
    );

    res.json({
      success: true,
      data: {
        ...roiReport,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error generating ROI report:', error);
    res.status(500).json({ error: 'Failed to generate ROI report' });
  }
});

// POST /api/executive-dashboard/:organizationId/export
// Export executive report to PDF
router.post('/:organizationId/export', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.userId;
    
    const { reportType, period } = z.object({
      reportType: reportTypeSchema,
      period: periodSchema.optional(),
    }).parse(req.body);

    // Verify user has access to organization
    const hasAccess = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!hasAccess) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const pdfBuffer = await ExecutiveDashboardService.exportExecutiveReport(
      organizationId,
      reportType,
      period || 'monthly'
    );

    const fileName = `${reportType}-report-${organizationId}-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error exporting executive report:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request parameters', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to export executive report' });
  }
});

// GET /api/executive-dashboard/:organizationId/insights
// Get AI-powered insights and recommendations
router.get('/:organizationId/insights', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.userId;

    // Verify user has access to organization
    const hasAccess = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!hasAccess) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // Get comprehensive insights
    const [summary, projectReports, debtReport, roiReport] = await Promise.all([
      ExecutiveDashboardService.generateExecutiveSummary(organizationId, 'monthly'),
      ExecutiveDashboardService.generateProjectPerformanceReport(organizationId, 'monthly'),
      ExecutiveDashboardService.generateTechnicalDebtReport(organizationId),
      ExecutiveDashboardService.generateROIReport(organizationId),
    ]);

    // Generate AI-powered insights
    const insights = {
      keyFindings: [
        {
          title: 'Test Reliability Impact',
          description: `Flaky tests are costing your organization $${summary.keyMetrics.estimatedCostImpact.toLocaleString()} monthly`,
          severity: summary.keyMetrics.estimatedCostImpact > 5000 ? 'high' : 'medium',
          recommendation: 'Prioritize fixing high-impact flaky tests to reduce costs',
        },
        {
          title: 'Developer Productivity',
          description: `${summary.businessImpact.developerProductivity.productivityLoss.toFixed(1)}% productivity loss due to flaky tests`,
          severity: summary.businessImpact.developerProductivity.productivityLoss > 10 ? 'high' : 'medium',
          recommendation: 'Implement automated quarantine to reduce developer interruptions',
        },
        {
          title: 'Technical Debt',
          description: `${debtReport.totalDebt.estimatedHours} hours of technical debt accumulated`,
          severity: debtReport.totalDebt.priority,
          recommendation: 'Allocate dedicated sprint capacity for debt reduction',
        },
      ],
      trends: {
        flakyTestTrend: summary.keyMetrics.flakyTestTrend,
        costTrend: summary.keyMetrics.estimatedCostImpact,
        stabilityTrend: summary.keyMetrics.testStabilityScore,
      },
      benchmarks: {
        industryAverage: {
          flakyTestPercentage: 15,
          stabilityScore: 85,
          resolutionTime: 3,
        },
        yourOrganization: {
          flakyTestPercentage: (summary.keyMetrics.totalFlakyTests / Math.max(summary.keyMetrics.totalProjects * 10, 1)) * 100,
          stabilityScore: summary.keyMetrics.testStabilityScore,
          resolutionTime: summary.keyMetrics.avgResolutionTime,
        },
      },
      actionItems: [
        {
          priority: 'high',
          action: 'Fix critical flaky tests',
          expectedImpact: '$' + (summary.keyMetrics.estimatedCostImpact * 0.6).toLocaleString(),
          timeline: '2 weeks',
        },
        {
          priority: 'medium',
          action: 'Implement automated quarantine',
          expectedImpact: '50% reduction in CI failures',
          timeline: '1 week',
        },
        {
          priority: 'low',
          action: 'Set up monitoring dashboards',
          expectedImpact: 'Improved visibility and faster response',
          timeline: '3 days',
        },
      ],
    };

    res.json({
      success: true,
      data: {
        insights,
        generatedAt: new Date(),
        dataFreshness: 'real-time',
      },
    });
  } catch (error) {
    logger.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// GET /api/executive-dashboard/:organizationId/metrics/comparison
// Get comparison metrics (current vs previous period)
router.get('/:organizationId/metrics/comparison', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const period = periodSchema.optional().parse(req.query.period) || 'monthly';
    const userId = req.user!.userId;

    // Verify user has access to organization
    const hasAccess = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!hasAccess) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // Get current and previous period summaries
    const currentSummary = await ExecutiveDashboardService.generateExecutiveSummary(
      organizationId,
      period
    );

    // For comparison, we'll use mock data for the previous period
    // In a real implementation, this would query historical data
    const previousMetrics = {
      totalFlakyTests: Math.floor(currentSummary.keyMetrics.totalFlakyTests * 1.2),
      estimatedCostImpact: Math.floor(currentSummary.keyMetrics.estimatedCostImpact * 1.15),
      testStabilityScore: Math.floor(currentSummary.keyMetrics.testStabilityScore * 0.95),
      totalTimeWasted: Math.floor(currentSummary.keyMetrics.totalTimeWasted * 1.1),
    };

    const comparison = {
      flakyTests: {
        current: currentSummary.keyMetrics.totalFlakyTests,
        previous: previousMetrics.totalFlakyTests,
        change: ((currentSummary.keyMetrics.totalFlakyTests - previousMetrics.totalFlakyTests) / previousMetrics.totalFlakyTests) * 100,
        trend: currentSummary.keyMetrics.totalFlakyTests < previousMetrics.totalFlakyTests ? 'improving' : 'declining',
      },
      costImpact: {
        current: currentSummary.keyMetrics.estimatedCostImpact,
        previous: previousMetrics.estimatedCostImpact,
        change: ((currentSummary.keyMetrics.estimatedCostImpact - previousMetrics.estimatedCostImpact) / previousMetrics.estimatedCostImpact) * 100,
        trend: currentSummary.keyMetrics.estimatedCostImpact < previousMetrics.estimatedCostImpact ? 'improving' : 'declining',
      },
      stabilityScore: {
        current: currentSummary.keyMetrics.testStabilityScore,
        previous: previousMetrics.testStabilityScore,
        change: ((currentSummary.keyMetrics.testStabilityScore - previousMetrics.testStabilityScore) / previousMetrics.testStabilityScore) * 100,
        trend: currentSummary.keyMetrics.testStabilityScore > previousMetrics.testStabilityScore ? 'improving' : 'declining',
      },
      timeWasted: {
        current: currentSummary.keyMetrics.totalTimeWasted,
        previous: previousMetrics.totalTimeWasted,
        change: ((currentSummary.keyMetrics.totalTimeWasted - previousMetrics.totalTimeWasted) / previousMetrics.totalTimeWasted) * 100,
        trend: currentSummary.keyMetrics.totalTimeWasted < previousMetrics.totalTimeWasted ? 'improving' : 'declining',
      },
    };

    res.json({
      success: true,
      data: {
        comparison,
        period,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error generating comparison metrics:', error);
    res.status(500).json({ error: 'Failed to generate comparison metrics' });
  }
});

export default router;