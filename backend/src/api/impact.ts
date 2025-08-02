import { Router } from 'express';
import { z } from 'zod';
import { ImpactCalculatorService } from '../services/impact-calculator.service';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const router = Router();
const impactService = new ImpactCalculatorService();
const prisma = new PrismaClient();

// Validation schemas
const teamConfigSchema = z.object({
  averageDeveloperSalary: z.number().min(30000).max(500000).optional(),
  infrastructureCostPerMinute: z.number().min(0.01).max(10.0).optional(),
  teamSize: z.number().min(1).max(100).optional(),
  deploymentFrequency: z.number().min(1).max(50).optional(),
  costPerDeploymentDelay: z.number().min(100).max(50000).optional()
});

const impactQuerySchema = z.object({
  days: z.string().transform(val => parseInt(val)).optional(),
  includeRecommendations: z.string().transform(val => val === 'true').optional()
});

// GET /api/impact/project/:projectId
// Calculate real-time impact for a project
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const query = impactQuerySchema.parse(req.query);

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get team configuration
    const teamConfig = await impactService.getTeamConfiguration(projectId);

    // Calculate real-time impact
    const impactData = await impactService.calculateRealTimeImpact(
      projectId,
      teamConfig
    );

    logger.info(`Impact calculated for project ${projectId}: $${Math.round(impactData.totalImpact.estimatedCostImpact)} impact`);

    res.json({
      success: true,
      data: {
        ...impactData,
        teamConfiguration: teamConfig,
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error calculating project impact:', error);
    res.status(500).json({ error: 'Failed to calculate impact' });
  }
});

// GET /api/impact/project/:projectId/summary
// Get high-level impact summary
router.get('/project/:projectId/summary', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get latest impact calculation
    const latestCalculation = await prisma.impactCalculation.findFirst({
      where: { projectId },
      orderBy: { calculationDate: 'desc' }
    });

    if (!latestCalculation) {
      // Calculate impact if none exists
      const teamConfig = await impactService.getTeamConfiguration(projectId);
      const impactData = await impactService.calculateRealTimeImpact(projectId, teamConfig);
      
      res.json({
        success: true,
        data: {
          totalCostImpact: impactData.totalImpact.estimatedCostImpact,
          timeWasted: impactData.totalImpact.totalTimeWasted,
          deploymentsDelayed: impactData.totalImpact.deploymentsDelayed,
          velocityReduction: impactData.totalImpact.velocityReduction,
          topRiskyTests: impactData.topFlakyTests.slice(0, 5),
          lastCalculated: new Date(),
          isRealTime: true
        }
      });
      return;
    }

    const impactData = latestCalculation.impactData as any;

    res.json({
      success: true,
      data: {
        totalCostImpact: latestCalculation.estimatedCostImpact,
        timeWasted: latestCalculation.totalTimeWasted,
        deploymentsDelayed: latestCalculation.deploymentsDelayed,
        velocityReduction: latestCalculation.velocityReduction,
        lastCalculated: latestCalculation.calculationDate,
        isRealTime: false,
        recommendations: latestCalculation.recommendations
      }
    });

  } catch (error) {
    logger.error('Error fetching impact summary:', error);
    res.status(500).json({ error: 'Failed to fetch impact summary' });
  }
});

// GET /api/impact/project/:projectId/trends
// Get impact trends over time
router.get('/project/:projectId/trends', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days = '30' } = req.query;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get historical trends
    const trends = await impactService.getHistoricalImpact(projectId, parseInt(days as string));

    res.json({
      success: true,
      data: {
        trends,
        periodDays: parseInt(days as string)
      }
    });

  } catch (error) {
    logger.error('Error fetching impact trends:', error);
    res.status(500).json({ error: 'Failed to fetch impact trends' });
  }
});

// GET /api/impact/project/:projectId/top-tests
// Get top flaky tests by impact
router.get('/project/:projectId/top-tests', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = '10', sortBy = 'cost' } = req.query;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get team configuration and calculate impact
    const teamConfig = await impactService.getTeamConfiguration(projectId);
    const impactData = await impactService.calculateRealTimeImpact(projectId, teamConfig);

    // Sort tests by the requested metric
    let sortedTests = impactData.topFlakyTests;
    
    if (sortBy === 'time') {
      sortedTests = sortedTests.sort((a, b) => b.impact.totalTimeWasted - a.impact.totalTimeWasted);
    } else if (sortBy === 'failures') {
      sortedTests = sortedTests.sort((a, b) => b.failureCount - a.failureCount);
    } else if (sortBy === 'deployments') {
      sortedTests = sortedTests.sort((a, b) => b.delayedDeployments - a.delayedDeployments);
    }
    // Default is cost (already sorted by estimatedCostImpact)

    res.json({
      success: true,
      data: {
        tests: sortedTests.slice(0, parseInt(limit as string)),
        sortBy,
        totalTests: sortedTests.length
      }
    });

  } catch (error) {
    logger.error('Error fetching top impactful tests:', error);
    res.status(500).json({ error: 'Failed to fetch top tests' });
  }
});

// POST /api/impact/project/:projectId/calculate
// Force recalculation of impact metrics
router.post('/project/:projectId/calculate', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const teamConfigOverride = teamConfigSchema.partial().parse(req.body);

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get base team configuration and apply overrides
    const baseConfig = await impactService.getTeamConfiguration(projectId);
    const finalConfig = { ...baseConfig, ...teamConfigOverride };

    // Calculate impact with new configuration
    const impactData = await impactService.calculateRealTimeImpact(projectId, finalConfig);

    logger.info(`Manual impact calculation triggered for project ${projectId}: $${Math.round(impactData.totalImpact.estimatedCostImpact)}`);

    res.json({
      success: true,
      data: {
        ...impactData,
        teamConfiguration: finalConfig,
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error in manual impact calculation:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid team configuration', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to calculate impact' });
  }
});

// PUT /api/impact/project/:projectId/team-config
// Update team configuration for impact calculations
router.put('/project/:projectId/team-config', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const teamConfig = teamConfigSchema.parse(req.body);

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Update team configuration
    await impactService.updateTeamConfiguration(projectId, teamConfig);

    logger.info(`Team configuration updated for project ${projectId}`);

    res.json({
      success: true,
      data: {
        message: 'Team configuration updated successfully',
        teamConfiguration: teamConfig
      }
    });

  } catch (error) {
    logger.error('Error updating team configuration:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid team configuration', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to update team configuration' });
  }
});

// GET /api/impact/project/:projectId/team-config
// Get current team configuration
router.get('/project/:projectId/team-config', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const teamConfig = await impactService.getTeamConfiguration(projectId);

    res.json({
      success: true,
      data: teamConfig
    });

  } catch (error) {
    logger.error('Error fetching team configuration:', error);
    res.status(500).json({ error: 'Failed to fetch team configuration' });
  }
});

// GET /api/impact/project/:projectId/recommendations
// Get actionable recommendations based on impact analysis
router.get('/project/:projectId/recommendations', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get latest calculation or calculate new impact
    let recommendations: string[] = [];
    const latestCalculation = await prisma.impactCalculation.findFirst({
      where: { projectId },
      orderBy: { calculationDate: 'desc' }
    });

    if (latestCalculation) {
      recommendations = latestCalculation.recommendations;
    } else {
      // Calculate fresh impact to get recommendations
      const teamConfig = await impactService.getTeamConfiguration(projectId);
      const impactData = await impactService.calculateRealTimeImpact(projectId, teamConfig);
      recommendations = impactData.recommendations;
    }

    res.json({
      success: true,
      data: {
        recommendations,
        generatedAt: latestCalculation?.calculationDate || new Date()
      }
    });

  } catch (error) {
    logger.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// GET /api/impact/project/:projectId/cost-breakdown
// Get detailed cost breakdown analysis
router.get('/project/:projectId/cost-breakdown', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: (req.user as any).userId
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Calculate detailed impact breakdown
    const teamConfig = await impactService.getTeamConfiguration(projectId);
    const impactData = await impactService.calculateRealTimeImpact(projectId, teamConfig);

    const breakdown = {
      totalCost: impactData.totalImpact.estimatedCostImpact,
      developerCosts: impactData.totalImpact.developerCostImpact,
      infrastructureCosts: impactData.totalImpact.infrastructureCostImpact,
      deploymentDelayCosts: impactData.totalImpact.deploymentsDelayed * teamConfig.costPerDeploymentDelay,
      
      // Time breakdown
      totalTimeWasted: impactData.totalImpact.totalTimeWasted,
      developerHours: impactData.totalImpact.developerHoursLost,
      cicdMinutes: impactData.totalImpact.ciCdTimeWasted,
      
      // Productivity impact
      velocityImpact: impactData.totalImpact.velocityReduction,
      deploymentsAffected: impactData.totalImpact.deploymentsDelayed,
      mergeRequestsBlocked: impactData.totalImpact.mergeRequestsBlocked,
      
      // Risk assessment
      productionRisk: impactData.totalImpact.productionDeploymentRisk,
      technicalDebt: impactData.totalImpact.technicalDebtIncrease,
      
      // Test-specific costs
      topCostlyTests: impactData.topFlakyTests.slice(0, 5).map(test => ({
        testName: test.testName,
        costImpact: test.impact.estimatedCostImpact,
        timeWasted: test.impact.totalTimeWasted,
        failureCount: test.failureCount
      }))
    };

    res.json({
      success: true,
      data: breakdown
    });

  } catch (error) {
    logger.error('Error generating cost breakdown:', error);
    res.status(500).json({ error: 'Failed to generate cost breakdown' });
  }
});

export default router;