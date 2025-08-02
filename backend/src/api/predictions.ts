import { Router } from 'express';
import { z } from 'zod';
import { PredictiveAnalysisService } from '../services/predictive-analysis.service';
import { MLModelService } from '../services/ml-model.service';
import { authMiddleware } from '../middleware/auth';
import { apiKeyAuth } from '../middleware/api-key-auth';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const router = Router();
const predictiveService = new PredictiveAnalysisService();
const mlModelService = new MLModelService();
const prisma = new PrismaClient();

// Validation schemas
const analyzeTestFileSchema = z.object({
  projectId: z.string(),
  filePath: z.string(),
  fileContent: z.string(),
  metadata: z.object({
    fileAge: z.number().optional(),
    modificationFrequency: z.number().optional(),
    authorCount: z.number().optional()
  }).optional()
});

const batchAnalysisSchema = z.object({
  projectId: z.string(),
  files: z.array(z.object({
    filePath: z.string(),
    fileContent: z.string(),
    metadata: z.object({
      fileAge: z.number().optional(),
      modificationFrequency: z.number().optional(),
      authorCount: z.number().optional()
    }).optional()
  }))
});

const feedbackSchema = z.object({
  predictiveAnalysisId: z.string(),
  actualOutcome: z.enum(['became_flaky', 'remained_stable', 'unknown']),
  feedbackType: z.enum(['correct', 'incorrect', 'partially_correct']),
  timeToOutcome: z.number().optional(),
  userRating: z.number().min(1).max(5).optional(),
  comments: z.string().optional(),
  wasHelpful: z.boolean().optional(),
  actionTaken: z.string().optional()
});

// POST /api/predictions/analyze
// Analyze a single test file for flaky risk
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const { projectId, filePath, fileContent, metadata } = analyzeTestFileSchema.parse(req.body);

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

    const result = await predictiveService.analyzeTestFile(
      projectId,
      filePath,
      fileContent,
      metadata
    );

    logger.info(`Predictive analysis completed for ${filePath}: ${result.riskLevel} risk`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error in predictive analysis:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/predictions/batch-analyze
// Analyze multiple test files for flaky risk
router.post('/batch-analyze', authMiddleware, async (req, res) => {
  try {
    const { projectId, files } = batchAnalysisSchema.parse(req.body);

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

    const results: any[] = [];
    const errors: any[] = [];

    for (const file of files) {
      try {
        const result = await predictiveService.analyzeTestFile(
          projectId,
          file.filePath,
          file.fileContent,
          file.metadata
        );
        results.push({ filePath: file.filePath, ...result });
      } catch (error) {
        errors.push({ filePath: file.filePath, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    logger.info(`Batch analysis completed for project ${projectId}: ${results.length} successful, ${errors.length} errors`);

    res.json({
      success: true,
      data: {
        results,
        errors
      }
    });

  } catch (error) {
    logger.error('Error in batch predictive analysis:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/predictions/project/:projectId
// Get all predictions for a project
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { riskLevel, limit = '50', offset = '0' } = req.query;

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

    const whereClause: any = { projectId };
    if (riskLevel && typeof riskLevel === 'string') {
      whereClause.riskLevel = riskLevel;
    }

    const predictions = await prisma.predictiveAnalysis.findMany({
      where: whereClause,
      include: {
        staticCodeFeatures: true,
        project: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      },
      orderBy: [
        { riskScore: 'desc' },
        { analysisDate: 'desc' }
      ],
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.predictiveAnalysis.count({
      where: whereClause
    });

    res.json({
      success: true,
      data: {
        predictions,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching project predictions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/predictions/project/:projectId/summary
// Get risk summary for a project
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

    const summary = await predictiveService.getProjectRiskSummary(projectId);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Error fetching project risk summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/predictions/:analysisId
// Get specific prediction details
router.get('/:analysisId', authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;

    const prediction = await prisma.predictiveAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        staticCodeFeatures: true,
        feedbacks: true,
        project: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      }
    });

    if (!prediction) {
      res.status(404).json({ error: 'Prediction not found' });
    return;
    }

    // Verify user has access
    if (prediction && prediction.project.userId !== (req.user as any).userId) {
      res.status(403).json({ error: 'Access denied' });
    return;
    }

    res.json({
      success: true,
      data: prediction
    });

  } catch (error) {
    logger.error('Error fetching prediction details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/predictions/feedback
// Submit feedback on prediction accuracy
router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const feedbackData = feedbackSchema.parse(req.body);

    // Verify user has access to the prediction
    const prediction = await prisma.predictiveAnalysis.findUnique({
      where: { id: feedbackData.predictiveAnalysisId },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!prediction) {
      res.status(404).json({ error: 'Prediction not found' });
    return;
    }

    if (prediction.project.userId !== (req.user as any).userId) {
      res.status(403).json({ error: 'Access denied' });
    return;
    }

    const feedback = await prisma.predictionFeedback.create({
      data: {
        ...feedbackData,
        userId: (req.user as any).userId
      } as any
    });

    logger.info(`Feedback submitted for prediction ${feedbackData.predictiveAnalysisId}: ${feedbackData.feedbackType}`);

    res.json({
      success: true,
      data: feedback
    });

  } catch (error) {
    logger.error('Error submitting prediction feedback:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/predictions/high-risk/:projectId
// Get high-risk tests requiring attention
router.get('/high-risk/:projectId', authMiddleware, async (req, res) => {
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

    const highRiskPredictions = await prisma.predictiveAnalysis.findMany({
      where: {
        projectId,
        OR: [
          { riskLevel: 'high' },
          { riskLevel: 'critical' }
        ]
      },
      include: {
        staticCodeFeatures: true,
        project: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      },
      orderBy: [
        { riskScore: 'desc' },
        { analysisDate: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: highRiskPredictions
    });

  } catch (error) {
    logger.error('Error fetching high-risk predictions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/predictions/webhook/analyze
// Webhook endpoint for CI/CD integrations
router.post('/webhook/analyze', apiKeyAuth, async (req, res) => {
  try {
    const { projectId, filePath, fileContent, metadata } = analyzeTestFileSchema.parse(req.body);

    // Verify API key has access to project  
    const apiKeyData = req.apiKey as any;
    const hasAccess = apiKeyData?.user?.projects?.some((p: any) => p.id === projectId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied to project' });
      return;
    }

    const result = await predictiveService.analyzeTestFile(
      projectId,
      filePath,
      fileContent,
      metadata
    );

    logger.info(`Webhook predictive analysis completed for ${filePath}: ${result.riskLevel} risk`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error in webhook predictive analysis:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/predictions/train-model
// Train the ML model (admin endpoint)
router.post('/train-model', authMiddleware, async (req, res) => {
  try {
    // For now, allow any authenticated user to trigger training
    // In production, you'd want admin-only access
    
    logger.info('Starting ML model training...');
    
    const metrics = await mlModelService.trainModel();
    
    res.json({
      success: true,
      data: {
        message: 'Model training completed successfully',
        metrics
      }
    });

  } catch (error) {
    logger.error('Error training ML model:', error);
    res.status(500).json({ error: 'Failed to train model' });
  }
});

// GET /api/predictions/model/metrics
// Get current model performance metrics
router.get('/model/metrics', authMiddleware, async (req, res) => {
  try {
    const latestModel = await prisma.mLModelMetrics.findFirst({
      where: { isActive: true },
      orderBy: { trainedAt: 'desc' }
    });

    if (!latestModel) {
      res.status(404).json({ error: 'No trained model found' });
      return;
    }

    const featureImportance = mlModelService.getFeatureImportance();

    res.json({
      success: true,
      data: {
        model: latestModel,
        featureImportance
      }
    });

  } catch (error) {
    logger.error('Error fetching model metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/predictions/model/history
// Get model training history
router.get('/model/history', authMiddleware, async (req, res) => {
  try {
    const modelHistory = await prisma.mLModelMetrics.findMany({
      orderBy: { trainedAt: 'desc' },
      take: 10
    });

    res.json({
      success: true,
      data: modelHistory
    });

  } catch (error) {
    logger.error('Error fetching model history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/predictions/feedback/stats
// Get feedback statistics for model improvement
router.get('/feedback/stats', authMiddleware, async (req, res) => {
  try {
    const feedbackStats = await prisma.predictionFeedback.groupBy({
      by: ['feedbackType', 'actualOutcome'],
      _count: {
        id: true
      }
    });

    const avgTimeToOutcome = await prisma.predictionFeedback.aggregate({
      _avg: {
        timeToOutcome: true
      },
      where: {
        timeToOutcome: {
          not: null
        }
      }
    });

    const helpfulnessStats = await prisma.predictionFeedback.groupBy({
      by: ['wasHelpful'],
      _count: {
        id: true
      },
      where: {
        wasHelpful: {
          not: null
        }
      }
    });

    res.json({
      success: true,
      data: {
        feedbackStats,
        avgTimeToOutcome: avgTimeToOutcome._avg.timeToOutcome,
        helpfulnessStats
      }
    });

  } catch (error) {
    logger.error('Error fetching feedback stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/predictions/bulk-feedback
// Submit feedback for multiple predictions at once
router.post('/bulk-feedback', authMiddleware, async (req, res) => {
  try {
    const bulkFeedbackSchema = z.object({
      feedbacks: z.array(feedbackSchema)
    });

    const { feedbacks } = bulkFeedbackSchema.parse(req.body);

    const results: any[] = [];
    const errors: any[] = [];

    for (const feedbackData of feedbacks) {
      try {
        // Verify user has access to the prediction
        const prediction = await prisma.predictiveAnalysis.findUnique({
          where: { id: feedbackData.predictiveAnalysisId },
          include: {
            project: {
              select: { userId: true }
            }
          }
        });

        if (!prediction) {
          errors.push({ 
            predictionId: feedbackData.predictiveAnalysisId, 
            error: 'Prediction not found' 
          });
          continue;
        }

        if (prediction.project.userId !== (req.user as any).userId) {
          errors.push({ 
            predictionId: feedbackData.predictiveAnalysisId, 
            error: 'Access denied' 
          });
          continue;
        }

        const feedback = await prisma.predictionFeedback.create({
          data: {
            ...feedbackData,
            userId: (req.user as any).userId
          } as any
        });

        results.push(feedback);

      } catch (error) {
        errors.push({ 
          predictionId: feedbackData.predictiveAnalysisId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    logger.info(`Bulk feedback submitted: ${results.length} successful, ${errors.length} errors`);

    res.json({
      success: true,
      data: {
        results,
        errors
      }
    });

  } catch (error) {
    logger.error('Error submitting bulk feedback:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/predictions/:analysisId/feedback/:feedbackId
// Update existing feedback
router.put('/:analysisId/feedback/:feedbackId', authMiddleware, async (req, res) => {
  try {
    const { analysisId, feedbackId } = req.params;
    const updateData = feedbackSchema.partial().parse(req.body);

    // Verify feedback belongs to user
    const feedback = await prisma.predictionFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        predictiveAnalysis: {
          include: {
            project: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    if (feedback && feedback.predictiveAnalysis.project.userId !== (req.user as any).userId) {
      res.status(403).json({ error: 'Access denied' });
    return;
    }

    if (feedback && feedback.predictiveAnalysis.id !== analysisId) {
      res.status(400).json({ error: 'Feedback does not belong to this analysis' });
      return;
    }

    const updatedFeedback = await prisma.predictionFeedback.update({
      where: { id: feedbackId },
      data: updateData
    });

    res.json({
      success: true,
      data: updatedFeedback
    });

  } catch (error) {
    logger.error('Error updating feedback:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;