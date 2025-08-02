import { Router, Request, Response } from 'express';
import { GitHubPRAnalysisService } from '../services/github-pr-analysis.service';
import { GitHubStatusChecksService } from '../services/github-status-checks.service';
import { GitHubArtifactsService } from '../services/github-artifacts.service';
import { GitHubRetryWorkflowService } from '../services/github-retry-workflow.service';
import { TestResultService } from '../services/test-result.service';
import { FlakyTestDetectionService } from '../services/flaky-test-detection.service';
import { logger } from '../utils/logger';
import { prisma } from '../services/database.service';
import crypto from 'crypto';

const router = Router();
const githubPRService = new GitHubPRAnalysisService();
const githubStatusService = new GitHubStatusChecksService();
const githubArtifactsService = new GitHubArtifactsService();
const githubRetryService = new GitHubRetryWorkflowService();

// Webhook signature verification middleware
const verifyGitHubSignature = (req: Request, res: Response, next: any) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const payload = JSON.stringify(req.body);
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn('GitHub webhook secret not configured');
    return next();
  }

  if (!signature) {
    logger.warn('Missing GitHub webhook signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    logger.warn('Invalid GitHub webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

// Main GitHub webhook endpoint
router.post('/github', verifyGitHubSignature, async (req: Request, res: Response): Promise<void> => {
  const eventType = req.headers['x-github-event'] as string;
  const payload = req.body;

  logger.info(`Received GitHub webhook: ${eventType}`, {
    repository: payload.repository?.full_name,
    action: payload.action,
    deliveryId: req.headers['x-github-delivery']
  });

  try {
    switch (eventType) {
      case 'workflow_run':
        await handleWorkflowRun(req, res, payload);
        break;
      case 'check_run':
        await handleCheckRun(req, res, payload);
        break;
      case 'pull_request':
        await handlePullRequest(req, res, payload);
        break;
      case 'push':
        await handlePush(req, res, payload);
        break;
      case 'installation':
        await handleInstallation(req, res, payload);
        break;
      case 'installation_repositories':
        await handleInstallationRepositories(req, res, payload);
        break;
      case 'ping':
        res.json({ message: 'GitHub App webhook configured successfully!' });
        return;
      default:
        logger.info(`Unhandled GitHub event: ${eventType}`);
        res.json({ message: `Event ${eventType} received but not processed` });
        return;
    }
  } catch (error) {
    logger.error(`Error handling GitHub webhook ${eventType}:`, error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

async function handleWorkflowRun(req: Request, res: Response, payload: any): Promise<void> {
  const { workflow_run, repository, action } = payload;
  
  if (action !== 'completed') {
    res.json({ message: `Workflow run ${action} - no action needed` });
    return;
  }

  const projectId = await findProjectByRepository(repository.full_name);
  if (!projectId) {
    res.json({ message: 'Repository not configured for monitoring' });
    return;
  }

  const [owner, repo] = repository.full_name.split('/');

  try {
    // Set status to pending while processing
    await githubStatusService.createPendingStatusCheck(
      projectId,
      owner,
      repo,
      workflow_run.head_sha
    );

    // Process artifacts for test results
    const artifactResults = await githubArtifactsService.processWorkflowArtifacts(
      projectId,
      owner,
      repo,
      workflow_run.id
    );

    // Analyze for flaky patterns
    const flakyAnalysis = await FlakyTestDetectionService.analyzeTestResults(projectId);

    // Create status check with results
    const summary = {
      totalTests: artifactResults.testResults.reduce((sum, r) => sum + r.totalTests, 0),
      flakyTests: flakyAnalysis.filter(t => t.isFlaky).length || 0,
      highRiskTests: flakyAnalysis.filter(t => t.isFlaky && t.confidence > 0.8).length || 0,
      recommendations: generateRecommendations(flakyAnalysis)
    };

    await githubStatusService.createFlakyTestStatusCheck(
      projectId,
      owner,
      repo,
      workflow_run.head_sha,
      summary
    );

    // If there are failed tests that might be flaky, suggest retry
    if (workflow_run.conclusion === 'failure' && summary.flakyTests > 0) {
      await suggestRetryForFailedTests(projectId, owner, repo, workflow_run);
    }

    res.json({
      message: 'Workflow run processed successfully',
      projectId,
      artifactResults: artifactResults.testResults.length,
      flakyTests: summary.flakyTests,
      highRiskTests: summary.highRiskTests
    });

  } catch (error) {
    await githubStatusService.createErrorStatusCheck(
      projectId,
      owner,
      repo,
      workflow_run.head_sha,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

async function handleCheckRun(req: Request, res: Response, payload: any): Promise<void> {
  const { check_run, repository, action } = payload;
  
  if (action !== 'completed') {
    res.json({ message: `Check run ${action} - no action needed` });
    return;
  }

  const projectId = await findProjectByRepository(repository.full_name);
  if (!projectId) {
    res.json({ message: 'Repository not configured for monitoring' });
    return;
  }

  logger.info(`Processing check run completion for ${repository.full_name}`);

  // Process check run results if they contain test data
  // This is handled by the existing webhook parser for now
  res.json({
    message: 'Check run processed successfully',
    projectId,
    checkRunId: check_run.id
  });
}

async function handlePullRequest(req: Request, res: Response, payload: any): Promise<void> {
  const { action, pull_request, repository } = payload;
  
  // Only analyze on PR opened, synchronize (new commits), or reopened
  const relevantActions = ['opened', 'synchronize', 'reopened'];
  if (!relevantActions.includes(action)) {
    res.json({
      message: `PR action '${action}' ignored - only analyzing on: ${relevantActions.join(', ')}`,
      action
    });
    return;
  }

  const projectId = await findProjectByRepository(repository.full_name);
  if (!projectId) {
    res.json({ message: 'Repository not configured for monitoring' });
    return;
  }

  try {
    logger.info(`Analyzing PR ${pull_request.number} for ${repository.full_name}`);

    // Analyze the pull request for flaky test risks
    const analysis = await githubPRService.analyzePullRequest(payload);

    // Create a detailed check run
    const [owner, repo] = repository.full_name.split('/');
    const summary = {
      totalTests: analysis.analysisResults.length,
      flakyTests: analysis.analysisResults.filter(r => r.riskLevel !== 'low').length,
      highRiskTests: analysis.analysisResults.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
      recommendations: analysis.summary.recommendations
    };

    const testFiles = analysis.analysisResults.map(result => ({
      path: result.filePath,
      riskLevel: result.riskLevel as 'low' | 'medium' | 'high' | 'critical',
      flakyTests: [result.filePath], // Could be more specific
      confidence: result.confidence
    }));

    await githubStatusService.createFlakyTestCheckRun(
      projectId,
      owner,
      repo,
      pull_request.head.sha,
      summary,
      testFiles
    );

    res.json({
      message: 'PR analysis completed successfully',
      projectId,
      pr_number: pull_request.number,
      repository: repository.full_name,
      analysis: analysis.summary
    });

  } catch (error) {
    logger.error(`Error analyzing PR ${pull_request.number}:`, error);
    throw error;
  }
}

async function handlePush(req: Request, res: Response, payload: any): Promise<void> {
  const { repository, ref, head_commit } = payload;
  
  // Only process pushes to main/master branches
  if (!ref.includes('main') && !ref.includes('master')) {
    res.json({ message: 'Push to non-main branch ignored' });
    return;
  }

  const projectId = await findProjectByRepository(repository.full_name);
  if (!projectId) {
    res.json({ message: 'Repository not configured for monitoring' });
    return;
  }

  logger.info(`Processing push to ${repository.full_name} on ${ref}`);

  // Could trigger additional analysis or tracking here
  res.json({
    message: 'Push processed successfully',
    projectId,
    commit: head_commit?.id,
    branch: ref
  });
}

async function handleInstallation(req: Request, res: Response, payload: any): Promise<void> {
  const { action, installation, repositories } = payload;
  
  logger.info(`GitHub App installation ${action}`, {
    installationId: installation.id,
    account: installation.account.login,
    repositoriesCount: repositories?.length || 0
  });

  if (action === 'created') {
    // Store installation info for future use
    try {
      // Could store installation details in database
      logger.info(`New installation created for ${installation.account.login}`);
    } catch (error) {
      logger.error('Error storing installation info:', error);
    }
  }

  res.json({
    message: `Installation ${action} processed successfully`,
    installationId: installation.id,
    account: installation.account.login
  });
}

async function handleInstallationRepositories(req: Request, res: Response, payload: any): Promise<void> {
  const { action, installation, repositories_added, repositories_removed } = payload;
  
  logger.info(`Installation repositories ${action}`, {
    installationId: installation.id,
    added: repositories_added?.length || 0,
    removed: repositories_removed?.length || 0
  });

  res.json({
    message: `Installation repositories ${action} processed successfully`,
    installationId: installation.id,
    repositoriesAdded: repositories_added?.length || 0,
    repositoriesRemoved: repositories_removed?.length || 0
  });
}

async function findProjectByRepository(repositoryFullName: string): Promise<string | null> {
  try {
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { repository: repositoryFullName },
          { repository: { contains: repositoryFullName.split('/')[1] } }
        ]
      }
    });
    
    return project?.id || null;
  } catch (error) {
    logger.error(`Error finding project for repository ${repositoryFullName}:`, error);
    return null;
  }
}

function generateRecommendations(flakyAnalysis: any): string[] {
  const recommendations: string[] = [];
  
  if (flakyAnalysis.newFlakyTests?.length > 0) {
    recommendations.push(`${flakyAnalysis.newFlakyTests.length} new flaky tests detected`);
  }
  
  if (flakyAnalysis.patterns?.timing_dependent > 0) {
    recommendations.push('Consider reviewing timing-dependent tests');
  }
  
  if (flakyAnalysis.patterns?.external_service > 0) {
    recommendations.push('Ensure external service dependencies are properly mocked');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('No immediate action required');
  }
  
  return recommendations;
}

async function suggestRetryForFailedTests(
  projectId: string,
  owner: string,
  repo: string,
  workflowRun: any
): Promise<void> {
  try {
    // Check if retry workflow exists
    const hasRetryWorkflow = await githubRetryService.hasRetryWorkflow(projectId, owner, repo);
    
    if (!hasRetryWorkflow) {
      logger.info(`No retry workflow found for ${owner}/${repo}, skipping retry suggestion`);
      return;
    }

    // Could implement logic to automatically trigger retries here
    // For now, just log the suggestion
    logger.info(`Failed workflow run ${workflowRun.id} contains flaky tests - retry suggested`);
    
  } catch (error) {
    logger.error('Error suggesting retry for failed tests:', error);
  }
}

export default router;