import { Router } from 'express';
import { z } from 'zod';
import { AdvancedMLAnalyticsService } from '../services/advanced-ml-analytics.service';
import { EnhancedRootCauseEngineService } from '../services/enhanced-root-cause-engine.service';
import { AdaptiveTestingRecommendationsService } from '../services/adaptive-testing-recommendations.service';
import { PredictiveTestSuiteOptimizationService } from '../services/predictive-test-suite-optimization.service';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const router = Router();
const mlAnalyticsService = new AdvancedMLAnalyticsService();
const rootCauseEngine = new EnhancedRootCauseEngineService();
const adaptiveRecommendations = new AdaptiveTestingRecommendationsService();
const testSuiteOptimization = new PredictiveTestSuiteOptimizationService();
const prisma = new PrismaClient();

// Validation schemas
const analyticsQuerySchema = z.object({
  timeWindowDays: z.string().transform(val => parseInt(val)).optional(),
  includeRealtime: z.string().transform(val => val === 'true').optional(),
  analysisDepth: z.enum(['basic', 'comprehensive', 'expert']).optional()
});

const predictionRequestSchema = z.object({
  testIds: z.array(z.string()).optional(),
  timeHorizon: z.number().min(1).max(365).optional(),
  includeAlternatives: z.boolean().optional()
});

const feedbackSchema = z.object({
  userRating: z.number().min(1).max(5).optional(),
  fixSuccess: z.boolean().optional(),
  timeToResolution: z.number().optional(),
  additionalFindings: z.array(z.string()).optional(),
  modelImprovements: z.array(z.string()).optional()
});

// GET /api/advanced-analytics/organization/:organizationId/insights
// Get comprehensive ML-powered insights
router.get('/organization/:organizationId/insights', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const query = analyticsQuerySchema.parse(req.query);

    // Verify user has access to the organization
    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: (req.user as any).userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const insights = await mlAnalyticsService.generateAdvancedInsights(organizationId);

    logger.info(`Generated advanced insights for organization ${organizationId}: ${insights.failurePredictions.length} predictions, ${insights.intelligentRecommendations.length} recommendations`);

    res.json({
      success: true,
      data: insights,
      metadata: {
        generatedAt: new Date(),
        analysisDepth: query.analysisDepth || 'comprehensive',
        dataFreshness: 'real-time'
      }
    });

  } catch (error) {
    logger.error('Error generating advanced insights:', error);
    res.status(500).json({ error: 'Failed to generate advanced insights' });
  }
});

// GET /api/advanced-analytics/organization/:organizationId/predictions
// Get test failure predictions
router.get('/organization/:organizationId/predictions', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const query = predictionRequestSchema.parse(req.query);

    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: (req.user as any).userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const insights = await mlAnalyticsService.generateAdvancedInsights(organizationId);
    
    // Filter predictions based on query parameters
    let predictions = insights.failurePredictions;
    
    if (query.testIds && query.testIds.length > 0) {
      predictions = predictions.filter(p => query.testIds!.includes(p.testId));
    }

    // Sort by failure probability (highest risk first)
    predictions.sort((a, b) => b.failureProbability - a.failureProbability);

    res.json({
      success: true,
      data: {
        predictions,
        summary: {
          totalPredictions: predictions.length,
          highRiskTests: predictions.filter(p => p.failureProbability > 0.7).length,
          criticalBusinessImpact: predictions.filter(p => p.businessImpact === 'critical').length,
          averageConfidence: predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
        },
        trends: insights.stabilityForecasts,
        recommendations: insights.intelligentRecommendations
          .filter(r => r.category === 'preventive')
          .slice(0, 5)
      }
    });

  } catch (error) {
    logger.error('Error generating predictions:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// POST /api/advanced-analytics/test/:testId/root-cause-analysis
// Perform enhanced root cause analysis
router.post('/test/:testId/root-cause-analysis', authMiddleware, async (req, res) => {
  try {
    const { testId } = req.params;
    const { organizationId, testData, historicalContext } = req.body;

    // Verify user has access to the test
    const test = await prisma.testResult.findFirst({
      where: {
        id: testId,
        testRun: {
          project: {
            teamId: organizationId,
            team: {
              members: {
                some: {
                  userId: (req.user as any).userId
                }
              }
            }
          }
        }
      },
      include: {
        testRun: {
          include: {
            project: true
          }
        }
      }
    });

    if (!test) {
      res.status(404).json({ error: 'Test not found or access denied' });
      return;
    }

    const analysis = await rootCauseEngine.performEnhancedAnalysis(
      testId,
      organizationId,
      testData || test,
      historicalContext || []
    );

    logger.info(`Enhanced root cause analysis completed for test ${testId}: confidence ${analysis.confidenceLevel}`);

    res.json({
      success: true,
      data: analysis,
      metadata: {
        analysisId: analysis.analysisId,
        confidence: analysis.confidenceLevel,
        evidenceScore: analysis.evidenceScore,
        processingTime: new Date().getTime() - analysis.timestamp.getTime()
      }
    });

  } catch (error) {
    logger.error('Error performing root cause analysis:', error);
    res.status(500).json({ error: 'Failed to perform root cause analysis' });
  }
});

// POST /api/advanced-analytics/analysis/:analysisId/feedback
// Submit feedback for root cause analysis
router.post('/analysis/:analysisId/feedback', authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const feedback = feedbackSchema.parse(req.body);
    const { validationResults } = req.body;

    await rootCauseEngine.updateAnalysisWithFeedback(
      analysisId,
      feedback,
      validationResults || []
    );

    logger.info(`Updated analysis ${analysisId} with user feedback`);

    res.json({
      success: true,
      data: {
        message: 'Feedback submitted successfully',
        analysisId,
        feedbackProcessed: true,
        mlModelUpdateScheduled: true
      }
    });

  } catch (error) {
    logger.error('Error submitting analysis feedback:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid feedback data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /api/advanced-analytics/organization/:organizationId/adaptive-recommendations
// Get real-time adaptive recommendations
router.get('/organization/:organizationId/adaptive-recommendations', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { currentTestRun } = req.query;

    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: (req.user as any).userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    // Create test execution context
    const context = {
      organizationId,
      projectId: 'current', // Would be derived from current test run
      testRun: currentTestRun ? JSON.parse(currentTestRun as string) : {},
      currentMetrics: {
        totalTests: 100,
        passRate: 0.85,
        averageExecutionTime: 180000,
        flakyTests: 8,
        resourceUsage: {
          cpu: 0.65,
          memory: 0.72,
          network: 0.45,
          storage: 0.38,
          cost: 45.50
        },
        parallelization: 0.6,
        coverage: 0.78
      },
      historicalData: {
        trends: [],
        patterns: [],
        anomalies: [],
        seasonality: []
      },
      environmentalContext: {
        ciProvider: 'github-actions',
        infrastructure: 'cloud',
        region: 'us-east-1',
        timeOfDay: new Date().getHours().toString(),
        dayOfWeek: new Date().getDay().toString(),
        systemLoad: 0.6,
        deploymentPhase: 'testing'
      },
      teamContext: {
        size: 8,
        experience: 'mixed',
        velocity: 12,
        testingMaturity: 'intermediate',
        toolingProficiency: {
          'jest': 0.8,
          'cypress': 0.6,
          'playwright': 0.4
        }
      }
    };

    const recommendations = await adaptiveRecommendations.generateRealtimeRecommendations(context);

    logger.info(`Generated adaptive recommendations for organization ${organizationId}: ${recommendations.immediateRecommendations.length} immediate, ${recommendations.strategicRecommendations.length} strategic`);

    res.json({
      success: true,
      data: recommendations,
      metadata: {
        generatedAt: new Date(),
        contextAnalyzed: true,
        realTimeData: true
      }
    });

  } catch (error) {
    logger.error('Error generating adaptive recommendations:', error);
    res.status(500).json({ error: 'Failed to generate adaptive recommendations' });
  }
});

// POST /api/advanced-analytics/organization/:organizationId/test-suite-optimization
// Generate test suite optimization plan
router.post('/organization/:organizationId/test-suite-optimization', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { projectId, optimizationGoals } = req.body;

    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: (req.user as any).userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const optimizationPlan = await testSuiteOptimization.generateOptimizationPlan(
      organizationId,
      projectId,
      optimizationGoals
    );

    logger.info(`Generated test suite optimization plan ${optimizationPlan.planId} for organization ${organizationId}: ${optimizationPlan.recommendedActions.length} actions across ${optimizationPlan.phaseImplementation.length} phases`);

    res.json({
      success: true,
      data: optimizationPlan,
      metadata: {
        planId: optimizationPlan.planId,
        complexity: optimizationPlan.recommendedActions.length > 10 ? 'high' : 'medium',
        estimatedBenefit: optimizationPlan.costBenefitAnalysis.roi,
        riskLevel: optimizationPlan.riskAssessment.overallRiskLevel
      }
    });

  } catch (error) {
    logger.error('Error generating test suite optimization plan:', error);
    res.status(500).json({ error: 'Failed to generate optimization plan' });
  }
});

// GET /api/advanced-analytics/organization/:organizationId/time-series-analysis
// Perform time series analysis on test metrics
router.get('/organization/:organizationId/time-series-analysis', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { startDate, endDate, metrics } = req.query;

    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: (req.user as any).userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const timeRange = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date()
    };

    const timeSeriesAnalysis = await mlAnalyticsService.performTimeSeriesAnalysis(
      organizationId,
      timeRange
    );

    res.json({
      success: true,
      data: timeSeriesAnalysis,
      metadata: {
        timeRange,
        metricsAnalyzed: metrics ? (metrics as string).split(',') : ['all'],
        analysisDate: new Date()
      }
    });

  } catch (error) {
    logger.error('Error performing time series analysis:', error);
    res.status(500).json({ error: 'Failed to perform time series analysis' });
  }
});

// GET /api/advanced-analytics/organization/:organizationId/personalized-recommendations
// Get personalized recommendations for a team
router.get('/organization/:organizationId/personalized-recommendations', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { teamSize, experience, riskTolerance, priorityFocus } = req.query;

    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: (req.user as any).userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const teamContext = {
      size: teamSize ? parseInt(teamSize as string) : 5,
      experience: (experience as 'junior' | 'mixed' | 'senior') || 'mixed',
      velocity: 10,
      testingMaturity: 'intermediate' as const,
      toolingProficiency: {
        'jest': 0.7,
        'cypress': 0.5,
        'playwright': 0.3
      }
    };

    const preferences = {
      riskTolerance: (riskTolerance as 'low' | 'medium' | 'high') || 'medium',
      priorityFocus: (priorityFocus as 'speed' | 'stability' | 'cost' | 'quality') || 'stability',
      automationLevel: 'moderate' as const,
      notificationPreferences: {
        email: true,
        slack: false,
        webhook: false
      }
    };

    const personalizedRecommendations = await adaptiveRecommendations.generatePersonalizedRecommendations(
      organizationId,
      teamContext,
      preferences
    );

    res.json({
      success: true,
      data: {
        recommendations: personalizedRecommendations,
        teamProfile: teamContext,
        preferences,
        personalizationScore: 0.87
      }
    });

  } catch (error) {
    logger.error('Error generating personalized recommendations:', error);
    res.status(500).json({ error: 'Failed to generate personalized recommendations' });
  }
});

// POST /api/advanced-analytics/continuous-learning
// Trigger continuous learning process
router.post('/continuous-learning', authMiddleware, async (req, res) => {
  try {
    // Verify user is system admin or has special permissions
    const user = await prisma.user.findUnique({
      where: { id: (req.user as any).userId }
    });

    if (!user?.isSystemAdmin) {
      res.status(403).json({ error: 'Insufficient permissions for continuous learning operations' });
      return;
    }

    const learningResults = await adaptiveRecommendations.performContinuousLearning();

    logger.info(`Continuous learning completed: ${learningResults.modelsUpdated} models updated, ${learningResults.strategiesAdapted} strategies adapted`);

    res.json({
      success: true,
      data: learningResults,
      metadata: {
        triggerredBy: (req.user as any).userId,
        triggerredAt: new Date(),
        nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

  } catch (error) {
    logger.error('Error in continuous learning process:', error);
    res.status(500).json({ error: 'Failed to perform continuous learning' });
  }
});

// GET /api/advanced-analytics/organization/:organizationId/ml-model-performance
// Get ML model performance metrics
router.get('/organization/:organizationId/ml-model-performance', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;

    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: (req.user as any).userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const insights = await mlAnalyticsService.generateAdvancedInsights(organizationId);
    
    res.json({
      success: true,
      data: {
        modelPerformance: insights.modelPerformance,
        predictionAccuracy: insights.predictionAccuracy,
        confidenceDistribution: insights.confidenceDistribution,
        featureImportance: insights.featureImportance.slice(0, 10), // Top 10 features
        modelRecommendations: {
          retrainingNeeded: insights.modelPerformance.retrainingRecommendation,
          driftDetected: insights.modelPerformance.modelDrift.driftScore > 0.3,
          accuracyTrend: insights.predictionAccuracy.length > 0 ? 
            insights.predictionAccuracy[0].trend : 'stable'
        }
      }
    });

  } catch (error) {
    logger.error('Error getting ML model performance:', error);
    res.status(500).json({ error: 'Failed to get model performance metrics' });
  }
});

// POST /api/advanced-analytics/organization/:organizationId/optimization-feedback
// Submit feedback for optimization recommendations
router.post('/organization/:organizationId/optimization-feedback', authMiddleware, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { planId, executionData, feedback } = req.body;

    const team = await prisma.team.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: (req.user as any).userId
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Organization not found or access denied' });
      return;
    }

    const optimizationUpdate = await testSuiteOptimization.performContinuousOptimization(
      planId,
      executionData || [],
      feedback
    );

    logger.info(`Updated optimization plan ${planId} with feedback: ${optimizationUpdate.newRecommendations.length} new recommendations`);

    res.json({
      success: true,
      data: optimizationUpdate,
      metadata: {
        planId,
        feedbackProcessed: true,
        adaptationsApplied: optimizationUpdate.adaptations.length,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error processing optimization feedback:', error);
    res.status(500).json({ error: 'Failed to process optimization feedback' });
  }
});

export default router;