import { Router, Request, Response } from 'express';
import { WebhookParserService } from '../services/webhook-parser.service';
import { TestResultService } from '../services/test-result.service';
import { GitHubPRAnalysisService } from '../services/github-pr-analysis.service';
import { GitHubStatusChecksService } from '../services/github-status-checks.service';
import { GitHubArtifactsService } from '../services/github-artifacts.service';
import { logger } from '../utils/logger';

const router = Router();
const githubPRService = new GitHubPRAnalysisService();
const githubStatusService = new GitHubStatusChecksService();
const githubArtifactsService = new GitHubArtifactsService();

// Generic webhook handler
const handleWebhook = async (req: Request, res: Response, source: string): Promise<void> => {
  try {
    logger.info(`Received ${source} webhook`, { 
      headers: req.headers, 
      bodySize: JSON.stringify(req.body).length 
    });

    // Parse webhook payload
    const normalizedData = WebhookParserService.parseWebhook(req.headers, req.body);
    
    logger.info(`Parsed ${source} webhook data`, {
      repository: normalizedData.repository,
      branch: normalizedData.branch,
      commit: normalizedData.commit,
      status: normalizedData.status,
      testCount: normalizedData.testResults.length,
    });

    // Process test results
    const result = await TestResultService.processWebhookData(normalizedData);
    
    logger.info(`Processed ${source} webhook successfully`, {
      testRunId: result.testRun.id,
      projectId: result.project.id,
      projectName: result.project.name,
    });

    res.json({
      message: `${source} webhook processed successfully`,
      testRunId: result.testRun.id,
      projectId: result.project.id,
      testResults: normalizedData.testResults.length,
    });

  } catch (error) {
    logger.error(`Error processing ${source} webhook`, error);
    
    if (error instanceof Error) {
      // Don't expose internal errors to external webhooks
      if (error.message.includes('No project found')) {
        res.status(404).json({ 
          error: 'Project not found for this repository',
          message: 'Make sure you have created a project with the correct repository URL'
        });
        return;
      }
      
      res.status(400).json({ 
        error: 'Webhook processing failed',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
};

// POST /api/webhooks/github - GitHub Actions webhook
router.post('/github', async (req: Request, res: Response): Promise<void> => {
  await handleWebhook(req, res, 'GitHub');
});

// POST /api/webhooks/github/pr - GitHub Pull Request analysis webhook
router.post('/github/pr', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Received GitHub PR webhook', {
      action: req.body.action,
      pr_number: req.body.number,
      repository: req.body.repository?.full_name
    });

    // Only analyze on PR opened, synchronize (new commits), or reopened
    const relevantActions = ['opened', 'synchronize', 'reopened'];
    if (!relevantActions.includes(req.body.action)) {
      res.json({
        message: `PR action '${req.body.action}' ignored - only analyzing on: ${relevantActions.join(', ')}`,
        action: req.body.action
      });
      return;
    }

    const analysis = await githubPRService.analyzePullRequest(req.body);

    res.json({
      message: 'GitHub PR analysis completed successfully',
      pr_number: req.body.number,
      repository: req.body.repository?.full_name,
      analysis: {
        totalFiles: analysis.summary.totalFiles,
        highRiskFiles: analysis.summary.highRiskFiles,
        averageRiskScore: analysis.summary.averageRiskScore
      }
    });

  } catch (error) {
    logger.error('Error processing GitHub PR webhook:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('No project found')) {
        res.status(404).json({
          error: 'Project not found for this repository',
          message: 'Make sure you have created a project with the correct repository URL'
        });
        return;
      }
      
      res.status(400).json({
        error: 'PR analysis failed',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to analyze PR'
    });
  }
});

// POST /api/webhooks/gitlab - GitLab CI webhook  
router.post('/gitlab', async (req: Request, res: Response): Promise<void> => {
  await handleWebhook(req, res, 'GitLab');
});

// POST /api/webhooks/jenkins - Jenkins webhook
router.post('/jenkins', async (req: Request, res: Response): Promise<void> => {
  await handleWebhook(req, res, 'Jenkins');
});

// Generic webhook endpoint (auto-detects source)
router.post('/receive', async (req: Request, res: Response): Promise<void> => {
  await handleWebhook(req, res, 'Auto-detected');
});

// GET /api/webhooks/test - Test endpoint for webhook configuration
router.get('/test', (req: Request, res: Response): void => {
  res.json({
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    endpoints: {
      github: '/api/webhooks/github',
      gitlab: '/api/webhooks/gitlab', 
      jenkins: '/api/webhooks/jenkins',
      generic: '/api/webhooks/receive',
    },
  });
});

export default router;