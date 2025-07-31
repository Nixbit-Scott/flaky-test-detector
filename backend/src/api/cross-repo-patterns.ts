import { Router } from 'express';
import { z } from 'zod';
import { CrossRepoPatternDetectionService } from '../services/cross-repo-pattern-detection.service';
import { CrossRepoAlertingService } from '../services/cross-repo-alerting.service';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const router = Router();
const patternService = new CrossRepoPatternDetectionService();
const alertingService = new CrossRepoAlertingService();
const prisma = new PrismaClient();

// Validation schemas
const analysisQuerySchema = z.object({
  timeWindowDays: z.string().transform(val => parseInt(val)).optional(),
  includeResolved: z.string().transform(val => val === 'true').optional()
});

const patternResolutionSchema = z.object({
  resolutionNotes: z.string().min(1).max(1000),
  actionsTaken: z.array(z.string()).optional(),
  timeToResolution: z.number().optional()
});

// GET /api/cross-repo-patterns/organization/:organizationId
// Analyze and get cross-repository patterns for an organization
router.get('/organization/:organizationId', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const query = analysisQuerySchema.parse(req.query);

    // Verify user has access to the organization (team)
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const timeWindowDays = query.timeWindowDays || 30;

    // Run pattern analysis
    const analysisResult = await patternService.analyzeOrganizationPatterns(
      organizationId,
      timeWindowDays
    );

    logger.info(`Cross-repo pattern analysis completed for organization ${organizationId}: ${analysisResult.detectedPatterns.length} patterns found`);

    res.json({
      success: true,
      data: analysisResult
    });

  } catch (error) {
    logger.error('Error in cross-repo pattern analysis:', error);
    res.status(500).json({ error: 'Failed to analyze cross-repository patterns' });
  }
});

// GET /api/cross-repo-patterns/organization/:organizationId/summary
// Get high-level summary of cross-repo patterns
router.get('/organization/:organizationId/summary', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Verify user has access to the organization (team)
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // Get latest analysis or create new one
    let latestAnalysis = await prisma.crossRepoPatternAnalysis.findFirst({
      where: { organizationId },
      orderBy: { analysisDate: 'desc' }
    });

    if (!latestAnalysis || isAnalysisStale(latestAnalysis.analysisDate)) {
      // Run new analysis if none exists or existing is stale (>24 hours)
      const analysisResult = await patternService.analyzeOrganizationPatterns(organizationId);
      
      res.json({
        success: true,
        data: {
          totalPatterns: analysisResult.patternSummary.totalPatterns,
          criticalPatterns: analysisResult.patternSummary.criticalPatterns,
          affectedRepos: analysisResult.patternSummary.totalAffectedRepos,
          estimatedCost: analysisResult.patternSummary.totalEstimatedCost,
          mostCommonType: analysisResult.patternSummary.mostCommonPatternType,
          topRecommendations: analysisResult.recommendations.immediate.slice(0, 3),
          lastAnalyzed: analysisResult.analysisDate,
          isRealTime: true
        }
      });
      return;
    }

    const patterns = latestAnalysis.detectedPatterns as any;
    const summary = calculateSummaryFromPatterns(patterns);

    res.json({
      success: true,
      data: {
        ...summary,
        lastAnalyzed: latestAnalysis.analysisDate,
        isRealTime: false
      }
    });

  } catch (error) {
    logger.error('Error fetching cross-repo pattern summary:', error);
    res.status(500).json({ error: 'Failed to fetch pattern summary' });
  }
});

// GET /api/cross-repo-patterns/organization/:organizationId/critical
// Get critical patterns requiring immediate attention
router.get('/organization/:organizationId/critical', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { limit = '10' } = req.query;

    // Verify user has access to the organization (team)
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // Get latest analysis
    const latestAnalysis = await prisma.crossRepoPatternAnalysis.findFirst({
      where: { organizationId },
      orderBy: { analysisDate: 'desc' }
    });

    if (!latestAnalysis) {
      // Run analysis if none exists
      const analysisResult = await patternService.analyzeOrganizationPatterns(organizationId);
      const criticalPatterns = analysisResult.detectedPatterns
        .filter(p => p.severity === 'critical' || p.severity === 'high')
        .sort((a, b) => {
          // Sort by severity, then confidence
          const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
          if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[b.severity] - severityOrder[a.severity];
          }
          return b.confidence - a.confidence;
        })
        .slice(0, parseInt(limit as string));

      res.json({
        success: true,
        data: {
          criticalPatterns,
          totalCritical: analysisResult.detectedPatterns.filter(p => p.severity === 'critical').length,
          totalHigh: analysisResult.detectedPatterns.filter(p => p.severity === 'high').length,
          urgentActions: criticalPatterns.length > 0 ? 
            criticalPatterns.flatMap(p => p.rootCause.suggestedFixes).slice(0, 5) :
            ['No critical cross-repository patterns detected']
        }
      });
      return;
    }

    const patterns = latestAnalysis.detectedPatterns as any[];
    const criticalPatterns = patterns
      .filter(p => p.severity === 'critical' || p.severity === 'high')
      .sort((a, b) => {
        const severityOrder: Record<string, number> = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.confidence - a.confidence;
      })
      .slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: {
        criticalPatterns,
        totalCritical: patterns.filter(p => p.severity === 'critical').length,
        totalHigh: patterns.filter(p => p.severity === 'high').length,
        urgentActions: criticalPatterns.length > 0 ? 
          criticalPatterns.flatMap(p => p.rootCause.suggestedFixes).slice(0, 5) :
          ['No critical cross-repository patterns detected']
      }
    });

  } catch (error) {
    logger.error('Error fetching critical patterns:', error);
    res.status(500).json({ error: 'Failed to fetch critical patterns' });
  }
});

// GET /api/cross-repo-patterns/pattern/:patternId
// Get detailed information about a specific pattern
router.get('/pattern/:patternId', authMiddleware, async (req, res) => {
  try {
    const { patternId } = req.params;

    const pattern = await patternService.getPatternDetails(patternId);

    if (!pattern) {
      res.status(404).json({ error: 'Pattern not found' });
      return;
    }

    // Verify user has access to at least one affected project
    const userProjects = await prisma.project.findMany({
      where: {
        userId: req.user!.userId,
        id: { in: pattern.affectedRepos }
      },
      select: { id: true }
    });

    if (userProjects.length === 0) {
      res.status(403).json({ error: 'Access denied to this pattern' });
      return;
    }

    res.json({
      success: true,
      data: pattern
    });

  } catch (error) {
    logger.error('Error fetching pattern details:', error);
    res.status(500).json({ error: 'Failed to fetch pattern details' });
  }
});

// GET /api/cross-repo-patterns/organization/:organizationId/by-type
// Get patterns grouped by type
router.get('/organization/:organizationId/by-type', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Verify user has access to the organization (team)
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // Get latest analysis
    const latestAnalysis = await prisma.crossRepoPatternAnalysis.findFirst({
      where: { organizationId },
      orderBy: { analysisDate: 'desc' }
    });

    if (!latestAnalysis) {
      res.json({
        success: true,
        data: {
          patternsByType: {},
          lastAnalyzed: null
        }
      });
      return;
    }

    const patterns = latestAnalysis.detectedPatterns as any[];
    const patternsByType = patterns.reduce((groups, pattern) => {
      const type = pattern.patternType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(pattern);
      return groups;
    }, {} as Record<string, any[]>);

    res.json({
      success: true,
      data: {
        patternsByType,
        lastAnalyzed: latestAnalysis.analysisDate
      }
    });

  } catch (error) {
    logger.error('Error fetching patterns by type:', error);
    res.status(500).json({ error: 'Failed to fetch patterns by type' });
  }
});

// POST /api/cross-repo-patterns/organization/:organizationId/analyze
// Force re-analysis of cross-repository patterns
router.post('/organization/:organizationId/analyze', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { timeWindowDays = 30 } = req.body;

    // Verify user has access to the organization (team)
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // Force re-analysis
    const analysisResult = await patternService.analyzeOrganizationPatterns(
      organizationId,
      timeWindowDays
    );

    logger.info(`Manual cross-repo pattern analysis triggered for organization ${organizationId}: ${analysisResult.detectedPatterns.length} patterns`);

    res.json({
      success: true,
      data: {
        message: 'Cross-repository pattern analysis completed',
        analysisResult,
        analyzedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error in manual pattern analysis:', error);
    res.status(500).json({ error: 'Failed to analyze patterns' });
  }
});

// POST /api/cross-repo-patterns/pattern/:patternId/resolve
// Mark a pattern as resolved
router.post('/pattern/:patternId/resolve', authMiddleware, async (req, res) => {
  try {
    const { patternId } = req.params;
    const resolutionData = patternResolutionSchema.parse(req.body);

    const pattern = await patternService.getPatternDetails(patternId);

    if (!pattern) {
      res.status(404).json({ error: 'Pattern not found' });
      return;
    }

    // Verify user has access to at least one affected project
    const userProjects = await prisma.project.findMany({
      where: {
        userId: req.user!.userId,
        id: { in: pattern.affectedRepos }
      },
      select: { id: true }
    });

    if (userProjects.length === 0) {
      res.status(403).json({ error: 'Access denied to resolve this pattern' });
      return;
    }

    await patternService.markPatternResolved(patternId, resolutionData.resolutionNotes);

    logger.info(`Pattern ${patternId} marked as resolved by user ${req.user!.userId}`);

    res.json({
      success: true,
      data: {
        message: 'Pattern marked as resolved successfully',
        resolvedAt: new Date(),
        resolutionNotes: resolutionData.resolutionNotes
      }
    });

  } catch (error) {
    logger.error('Error resolving pattern:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid resolution data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to resolve pattern' });
  }
});

// GET /api/cross-repo-patterns/organization/:organizationId/trends
// Get trend analysis for cross-repo patterns
router.get('/organization/:organizationId/trends', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { days = '30' } = req.query;

    // Verify user has access to the organization (team)
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days as string));

    // Get historical analyses
    const historicalAnalyses = await prisma.crossRepoPatternAnalysis.findMany({
      where: {
        organizationId,
        analysisDate: { gte: since }
      },
      orderBy: { analysisDate: 'asc' }
    });

    const trends = historicalAnalyses.map(analysis => ({
      date: analysis.analysisDate,
      patternCount: analysis.patternCount,
      patterns: analysis.detectedPatterns as any[]
    }));

    res.json({
      success: true,
      data: {
        trends,
        periodDays: parseInt(days as string),
        summary: {
          totalAnalyses: historicalAnalyses.length,
          avgPatternsPerAnalysis: historicalAnalyses.length > 0 ? 
            historicalAnalyses.reduce((sum, a) => sum + a.patternCount, 0) / historicalAnalyses.length : 0
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching pattern trends:', error);
    res.status(500).json({ error: 'Failed to fetch pattern trends' });
  }
});

// Helper functions
function isAnalysisStale(analysisDate: Date): boolean {
  const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
  return Date.now() - analysisDate.getTime() > staleThreshold;
}

function calculateSummaryFromPatterns(patterns: any[]) {
  return {
    totalPatterns: patterns.length,
    criticalPatterns: patterns.filter(p => p.severity === 'critical').length,
    affectedRepos: new Set(patterns.flatMap(p => p.affectedRepos)).size,
    estimatedCost: patterns.reduce((sum, p) => sum + (p.impactMetrics?.estimatedCostImpact || 0), 0),
    mostCommonType: getMostCommonPatternType(patterns),
    topRecommendations: getTopRecommendations(patterns)
  };
}

function getMostCommonPatternType(patterns: any[]): string {
  const typeCounts = patterns.reduce((counts, p) => {
    counts[p.patternType] = (counts[p.patternType] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  
  return Object.entries(typeCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'none';
}

function getTopRecommendations(patterns: any[]): string[] {
  const recommendations = patterns
    .filter(p => p.severity === 'critical' || p.severity === 'high')
    .flatMap(p => p.rootCause?.suggestedFixes || [])
    .slice(0, 3);
  
  return recommendations.length > 0 ? recommendations : ['No critical patterns requiring immediate action'];
}

// ALERTING ENDPOINTS

// GET /api/cross-repo-patterns/organization/:organizationId/monitoring
// Get real-time monitoring dashboard
router.get('/organization/:organizationId/monitoring', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Verify user has access to the organization
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const dashboard = await alertingService.getMonitoringDashboard(organizationId);

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    logger.error('Error fetching monitoring dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring dashboard' });
  }
});

// POST /api/cross-repo-patterns/organization/:organizationId/alert-rules
// Create a new alert rule
router.post('/organization/:organizationId/alert-rules', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const alertRuleSchema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      conditions: z.object({
        minAffectedRepos: z.number().min(1).max(50),
        maxTimeToDetection: z.number().min(1).max(1440), // 1 minute to 24 hours
        severityThreshold: z.enum(['low', 'medium', 'high', 'critical']),
        confidenceThreshold: z.number().min(0).max(1),
        patternTypes: z.array(z.string()),
        estimatedCostThreshold: z.number().min(0),
        cascadeDetection: z.boolean().default(false)
      }),
      actions: z.object({
        webhookUrl: z.string().url().optional(),
        emailRecipients: z.array(z.string().email()),
        slackChannel: z.string().optional(),
        createJiraTicket: z.boolean().default(false),
        escalateAfterMinutes: z.number().min(15).max(1440).optional()
      }),
      isActive: z.boolean().default(true)
    });

    const ruleData = alertRuleSchema.parse(req.body);

    // Verify user has access to the organization
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId,
            role: { in: ['admin', 'owner'] } // Only admins can create alert rules
          }
        }
      }
    });

    if (!team) {
      res.status(403).json({ error: 'Insufficient permissions to create alert rules' });
      return;
    }

    const alertRule = await alertingService.createAlertRule(organizationId, ruleData);

    logger.info(`Alert rule created: ${alertRule.id} by user ${req.user!.userId}`);

    res.status(201).json({
      success: true,
      data: alertRule
    });

  } catch (error) {
    logger.error('Error creating alert rule:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid alert rule data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

// POST /api/cross-repo-patterns/alerts/:alertId/acknowledge
// Acknowledge an alert
router.post('/alerts/:alertId/acknowledge', authMiddleware, async (req, res) => {
  try {
    const { alertId } = req.params;

    await alertingService.acknowledgeAlert(alertId, req.user!.userId);

    res.json({
      success: true,
      data: {
        message: 'Alert acknowledged successfully',
        acknowledgedBy: req.user!.userId,
        acknowledgedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// POST /api/cross-repo-patterns/organization/:organizationId/setup-monitoring
// Set up real-time monitoring for an organization
router.post('/organization/:organizationId/setup-monitoring', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Verify user has admin access to the organization
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId,
            role: { in: ['admin', 'owner'] }
          }
        }
      }
    });

    if (!team) {
      res.status(403).json({ error: 'Insufficient permissions to set up monitoring' });
      return;
    }

    await alertingService.setupRealtimeMonitoring(organizationId);

    logger.info(`Real-time monitoring set up for organization ${organizationId} by user ${req.user!.userId}`);

    res.json({
      success: true,
      data: {
        message: 'Real-time monitoring set up successfully',
        organizationId,
        enabledAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error setting up monitoring:', error);
    res.status(500).json({ error: 'Failed to set up monitoring' });
  }
});

// GET /api/cross-repo-patterns/organization/:organizationId/alerts
// Get alerts for an organization
router.get('/organization/:organizationId/alerts', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { status = 'active', limit = '20', offset = '0' } = req.query;

    // Verify user has access to the organization
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // In real implementation, this would fetch from database with proper filtering
    const alerts = await alertingService.getActiveAlerts(organizationId);

    res.json({
      success: true,
      data: {
        alerts: alerts.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string)),
        total: alerts.length,
        hasMore: alerts.length > parseInt(offset as string) + parseInt(limit as string)
      }
    });

  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Enhanced pattern analysis with alert processing
router.post('/organization/:organizationId/analyze-with-alerts', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { timeWindowDays = 30, enableAlerts = true } = req.body;

    // Verify user has access to the organization
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: req.user!.userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // Run pattern analysis
    const analysisResult = await patternService.analyzeOrganizationPatterns(
      organizationId,
      timeWindowDays
    );

    let alertsTriggered: any[] = [];

    // Process alerts if enabled
    if (enableAlerts && analysisResult.detectedPatterns.length > 0) {
      alertsTriggered = await alertingService.processNewPatterns(
        organizationId,
        analysisResult.detectedPatterns
      );
    }

    logger.info(`Pattern analysis with alerts completed for ${organizationId}: ${analysisResult.detectedPatterns.length} patterns, ${alertsTriggered.length} alerts`);

    res.json({
      success: true,
      data: {
        analysis: analysisResult,
        alerts: {
          triggered: alertsTriggered.length,
          details: alertsTriggered
        },
        analyzedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error in pattern analysis with alerts:', error);
    res.status(500).json({ error: 'Failed to analyze patterns with alerts' });
  }
});

export default router;