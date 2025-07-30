import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { FlakyTestDetectionService } from '../services/flaky-test-detection.service';
import { AIAnalysisService } from '../services/ai-analysis.service';

const router = Router();

// Validation schemas
const analyzeProjectSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  minRuns: z.number().min(1).optional(),
  flakyThreshold: z.number().min(0).max(1).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  lookbackDays: z.number().min(1).max(365).optional(),
});

const checkTestFlakySchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  testName: z.string().min(1, 'Test name is required'),
  testSuite: z.string().optional(),
});

const triggerAnalysisSchema = z.object({
  testResultId: z.string().min(1, 'Test result ID is required'),
});

// POST /api/flaky-tests/analyze - Analyze project for flaky tests
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = analyzeProjectSchema.parse(req.body);
    
    const analyses = await FlakyTestDetectionService.analyzeTestResults(
      validatedData.projectId,
      {
        minRuns: validatedData.minRuns,
        flakyThreshold: validatedData.flakyThreshold,
        confidenceThreshold: validatedData.confidenceThreshold,
        lookbackDays: validatedData.lookbackDays,
      }
    );

    res.json({
      message: 'Flaky test analysis completed',
      flakyTests: analyses,
      total: analyses.length,
      summary: {
        totalFlaky: analyses.length,
        highConfidence: analyses.filter(a => a.confidence >= 0.8).length,
        mediumConfidence: analyses.filter(a => a.confidence >= 0.6 && a.confidence < 0.8).length,
        lowConfidence: analyses.filter(a => a.confidence < 0.6).length,
      },
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

// GET /api/flaky-tests/:projectId - Get current flaky tests for a project
router.get('/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    
    const flakyTests = await FlakyTestDetectionService.getFlakyTests(projectId);

    res.json({
      flakyTests,
      total: flakyTests.length,
      summary: {
        active: flakyTests.filter(t => t.isActive).length,
        highRisk: flakyTests.filter(t => t.failureRate > 0.4).length,
        mediumRisk: flakyTests.filter(t => t.failureRate > 0.2 && t.failureRate <= 0.4).length,
        lowRisk: flakyTests.filter(t => t.failureRate <= 0.2).length,
      },
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/flaky-tests/check - Check if a specific test is flaky
router.post('/check', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = checkTestFlakySchema.parse(req.body);
    
    const isFlaky = await FlakyTestDetectionService.isTestFlaky(
      validatedData.projectId,
      validatedData.testName,
      validatedData.testSuite
    );

    res.json({
      testName: validatedData.testName,
      testSuite: validatedData.testSuite,
      isFlaky,
      recommendation: isFlaky 
        ? 'This test should be retried if it fails' 
        : 'This test is stable - failures likely indicate real issues',
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

// GET /api/flaky-tests/:projectId/stats - Get flaky test statistics for a project
router.get('/:projectId/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const flakyTests = await FlakyTestDetectionService.getFlakyTests(projectId);

    if (flakyTests.length === 0) {
      res.json({
        stats: {
          totalTests: 0,
          flakyTests: 0,
          averageFailureRate: 0,
          averageConfidence: 0,
          patterns: {},
        },
      });
      return;
    }

    const totalTests = flakyTests.length;
    const averageFailureRate = flakyTests.reduce((sum, t) => sum + t.failureRate, 0) / totalTests;
    const averageConfidence = flakyTests.reduce((sum, t) => sum + t.confidence, 0) / totalTests;

    // Get pattern distribution (this would need to be stored or calculated)
    const patterns = {
      intermittent: 0,
      environmentDependent: 0,
      timingSensitive: 0,
      unknown: 0,
    };

    const riskDistribution = {
      high: flakyTests.filter(t => t.failureRate > 0.4).length,
      medium: flakyTests.filter(t => t.failureRate > 0.2 && t.failureRate <= 0.4).length,
      low: flakyTests.filter(t => t.failureRate <= 0.2).length,
    };

    res.json({
      stats: {
        totalTests,
        flakyTests: totalTests,
        averageFailureRate: Math.round(averageFailureRate * 100) / 100,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        patterns,
        riskDistribution,
        lastAnalysis: flakyTests[0]?.updatedAt || null,
      },
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/flaky-tests/:projectId/:testName - Mark a flaky test as resolved
router.delete('/:projectId/:testName', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId, testName } = req.params;
    const { testSuite } = req.query;

    // Update the flaky test pattern to mark as inactive
    const { prisma } = require('../services/database.service');
    
    const updatedPattern = await prisma.flakyTestPattern.updateMany({
      where: {
        projectId,
        testName,
        testSuite: testSuite ? String(testSuite) : null,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    if (updatedPattern.count === 0) {
      res.status(404).json({ error: 'Flaky test pattern not found' });
      return;
    }

    res.json({
      message: 'Flaky test marked as resolved',
      testName,
      testSuite: testSuite || null,
    });

  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI-POWERED ENDPOINTS

// POST /api/flaky-tests/ai-analysis/enhanced - Enhanced AI analysis for a test result
router.post('/ai-analysis/enhanced', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const analysisSchema = z.object({
      testName: z.string().min(1),
      testSuite: z.string().optional(),
      errorMessage: z.string().optional(),
      stackTrace: z.string().optional(),
      duration: z.number().optional(),
      status: z.string(),
      branch: z.string().optional(),
      ciProvider: z.string().optional(),
      environmentalContext: z.object({
        ciRunner: z.string().optional(),
        ciRegion: z.string().optional(),
        nodeVersion: z.string().optional(),
        timeOfDay: z.string().optional(),
        dayOfWeek: z.string().optional(),
        concurrentJobs: z.number().optional(),
        cpuUsage: z.number().optional(),
        memoryUsage: z.number().optional(),
        networkLatency: z.number().optional(),
        externalServices: z.record(z.any()).optional(),
      }).optional(),
    });

    const validatedData = analysisSchema.parse(req.body);
    
    // Use enhanced AI analysis
    const analysis = await AIAnalysisService.analyzeFailureEnhanced({
      testName: validatedData.testName,
      testSuite: validatedData.testSuite,
      errorMessage: validatedData.errorMessage,
      stackTrace: validatedData.stackTrace,
      duration: validatedData.duration,
      status: validatedData.status,
      branch: validatedData.branch,
      ciProvider: validatedData.ciProvider,
      environmentalContext: validatedData.environmentalContext,
      historicalFailures: [], // Would be populated from database in full implementation
    });

    res.json({
      success: true,
      analysis,
      enhanced: true,
      modelVersion: analysis.modelVersion,
      processingTime: analysis.processingTime,
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

// GET /api/flaky-tests/:projectId/with-ai - Get flaky tests with AI analysis
router.get('/:projectId/with-ai', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    
    const flakyTestsWithAI = await FlakyTestDetectionService.getFlakyTestsWithAI(projectId);
    
    // Pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedTests = flakyTestsWithAI.slice(startIndex, endIndex);

    // Calculate analytics summary
    const totalTests = flakyTestsWithAI.length;
    const testsWithAnalysis = flakyTestsWithAI.filter(t => t.latestAnalysis).length;
    
    const categoryCounts = flakyTestsWithAI.reduce((acc, test) => {
      if (test.latestAnalysis) {
        const category = test.latestAnalysis.primaryCategory;
        acc[category] = (acc[category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const averageConfidence = testsWithAnalysis > 0 
      ? flakyTestsWithAI
          .filter(t => t.latestAnalysis)
          .reduce((sum, t) => sum + t.latestAnalysis!.confidence, 0) / testsWithAnalysis
      : 0;

    const effortDistribution = flakyTestsWithAI.reduce((acc, test) => {
      if (test.latestAnalysis) {
        const effort = test.latestAnalysis.estimatedFixEffort;
        acc[effort] = (acc[effort] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: paginatedTests,
      pagination: {
        page,
        pageSize,
        total: totalTests,
        hasNext: endIndex < totalTests,
      },
      analytics: {
        totalTests,
        flakyTests: totalTests,
        testsWithAnalysis,
        categoryCounts,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        effortDistribution,
      },
    });

  } catch (error) {
    console.error('Error fetching flaky tests with AI:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/flaky-tests/ai-analysis/trigger - Trigger AI analysis for a test failure
router.post('/ai-analysis/trigger', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = triggerAnalysisSchema.parse(req.body);
    
    const analysisId = await FlakyTestDetectionService.triggerAIAnalysisForFailure(
      validatedData.testResultId
    );

    if (!analysisId) {
      res.status(400).json({
        success: false,
        error: 'Unable to trigger AI analysis - test may not be flaky or lack sufficient data',
      });
      return;
    }

    res.json({
      success: true,
      analysisId,
      message: 'AI analysis triggered successfully',
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

    console.error('Error triggering AI analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/flaky-tests/:projectId/analytics - Get AI analytics summary
router.get('/:projectId/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { projectId } = req.params;
    const flakyTestsWithAI = await FlakyTestDetectionService.getFlakyTestsWithAI(projectId);
    
    const totalTests = flakyTestsWithAI.length;
    const testsWithAnalysis = flakyTestsWithAI.filter(t => t.latestAnalysis).length;
    
    // Category distribution
    const categoryCounts = flakyTestsWithAI.reduce((acc, test) => {
      if (test.latestAnalysis) {
        const category = test.latestAnalysis.primaryCategory;
        acc[category] = (acc[category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Top recommendations
    const recommendationCounts = new Map<string, { count: number; examples: string[] }>();
    
    flakyTestsWithAI.forEach(test => {
      if (test.latestAnalysis && test.latestAnalysis.recommendations) {
        const recommendations = test.latestAnalysis.recommendations as any;
        
        // Process immediate recommendations
        recommendations.immediate?.forEach((rec: any) => {
          const key = rec.category || 'general';
          if (!recommendationCounts.has(key)) {
            recommendationCounts.set(key, { count: 0, examples: [] });
          }
          const data = recommendationCounts.get(key)!;
          data.count++;
          if (data.examples.length < 3) {
            data.examples.push(rec.title);
          }
        });
      }
    });

    const topRecommendations = Array.from(recommendationCounts.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Effort distribution
    const effortDistribution = flakyTestsWithAI.reduce((acc, test) => {
      if (test.latestAnalysis) {
        const effort = test.latestAnalysis.estimatedFixEffort;
        acc[effort] = (acc[effort] || 0) + 1;
      }
      return acc;
    }, { low: 0, medium: 0, high: 0 } as Record<'low' | 'medium' | 'high', number>);

    // Average confidence
    const averageConfidence = testsWithAnalysis > 0 
      ? flakyTestsWithAI
          .filter(t => t.latestAnalysis)
          .reduce((sum, t) => sum + t.latestAnalysis!.confidence, 0) / testsWithAnalysis
      : 0;

    res.json({
      success: true,
      data: {
        totalTests,
        flakyTests: totalTests,
        categoryCounts,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        topRecommendations,
        effortDistribution,
        analysisProgress: {
          analyzed: testsWithAnalysis,
          pending: totalTests - testsWithAnalysis,
          percentage: totalTests > 0 ? Math.round((testsWithAnalysis / totalTests) * 100) : 0,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/flaky-tests/analysis/:analysisId - Get specific AI analysis details
router.get('/analysis/:analysisId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { analysisId } = req.params;
    const { prisma } = require('../services/database.service');
    
    const analysis = await prisma.rootCauseAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        flakyTestPattern: {
          select: {
            testName: true,
            testSuite: true,
            projectId: true,
          },
        },
        testResult: {
          select: {
            errorMessage: true,
            stackTrace: true,
            duration: true,
            createdAt: true,
          },
        },
      },
    });

    if (!analysis) {
      res.status(404).json({
        success: false,
        error: 'Analysis not found',
      });
      return;
    }

    res.json({
      success: true,
      data: analysis,
    });

  } catch (error) {
    console.error('Error fetching analysis details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;