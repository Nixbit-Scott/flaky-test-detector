import { Router, Request, Response } from 'express';
import { GitHubAppService } from '../services/github-app.service';
import { GitHubRetryWorkflowService, RetryWorkflowConfig } from '../services/github-retry-workflow.service';
import { RetryLogicService } from '../services/retry-logic.service';
import { logger } from '../utils/logger';
import { prisma } from '../services/database.service';

const router = Router();
const githubApp = GitHubAppService.getInstance();
const githubRetryService = new GitHubRetryWorkflowService();

// GET /api/github/installations - List GitHub App installations
router.get('/installations', async (req: Request, res: Response): Promise<void> => {
  try {
    const installations = await githubApp.getInstallations();
    
    res.json({
      installations: installations.map(installation => ({
        id: installation.id,
        account: installation.account,
        repositorySelection: installation.repository_selection,
        appId: installation.app_id
      }))
    });
  } catch (error) {
    logger.error('Error fetching GitHub installations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch installations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/github/installations/:installationId/repositories - List repositories for an installation
router.get('/installations/:installationId/repositories', async (req: Request, res: Response): Promise<void> => {
  try {
    const installationId = parseInt(req.params.installationId);
    const repositories = await githubApp.getInstallationRepositories(installationId);
    
    res.json({
      repositories: repositories.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        htmlUrl: repo.html_url
      }))
    });
  } catch (error) {
    logger.error(`Error fetching repositories for installation ${req.params.installationId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch repositories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/github/projects/:projectId/setup-retry-workflow - Set up retry workflow for a project
router.post('/projects/:projectId/setup-retry-workflow', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const config: RetryWorkflowConfig = req.body;

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Extract owner/repo from repository URL
    const repoMatch = project.repository.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      res.status(400).json({ error: 'Invalid repository URL format' });
      return;
    }

    const [, owner, repo] = repoMatch;

    // Generate some sample retry tests for demonstration
    const sampleRetryTests = [
      {
        projectId,
        testName: 'test_example_flaky',
        testSuite: 'integration',
        currentAttempt: 1,
        lastFailureMessage: 'Sample flaky test'
      }
    ];

    // Create the retry workflow
    const result = await githubRetryService.createRetryWorkflow(
      projectId,
      owner,
      repo,
      config,
      sampleRetryTests
    );

    logger.info(`Created retry workflow for ${owner}/${repo}`, result);

    res.json({
      message: 'Retry workflow created successfully',
      workflowPath: result.workflowPath,
      commitSha: result.commitSha,
      repositoryUrl: `https://github.com/${owner}/${repo}`
    });

  } catch (error) {
    logger.error(`Error setting up retry workflow for project ${req.params.projectId}:`, error);
    res.status(500).json({ 
      error: 'Failed to setup retry workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/github/projects/:projectId/trigger-retry - Manually trigger retry workflow
router.post('/projects/:projectId/trigger-retry', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { testNames, originalRunId, branch = 'main' } = req.body;

    if (!testNames || !Array.isArray(testNames)) {
      res.status(400).json({ error: 'testNames array is required' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Extract owner/repo from repository URL
    const repoMatch = project.repository.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      res.status(400).json({ error: 'Invalid repository URL format' });
      return;
    }

    const [, owner, repo] = repoMatch;

    // Create retry test requests
    const retryTests = testNames.map((testName: string) => ({
      projectId,
      testName,
      testSuite: 'unknown',
      currentAttempt: 1,
      lastFailureMessage: 'Manually triggered retry'
    }));

    // Dispatch the retry workflow
    const result = await githubRetryService.dispatchRetryWorkflow(
      projectId,
      owner,
      repo,
      retryTests,
      originalRunId,
      branch
    );

    if (result.status === 'failed') {
      res.status(500).json({
        error: 'Failed to dispatch retry workflow',
        workflowId: result.workflowId
      });
      return;
    }

    res.json({
      message: 'Retry workflow dispatched successfully',
      workflowId: result.workflowId,
      runId: result.runId,
      workflowUrl: result.url,
      testCount: retryTests.length
    });

  } catch (error) {
    logger.error(`Error triggering retry for project ${req.params.projectId}:`, error);
    res.status(500).json({ 
      error: 'Failed to trigger retry',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/github/projects/:projectId/retry-status/:runId - Get retry workflow status
router.get('/projects/:projectId/retry-status/:runId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, runId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Extract owner/repo from repository URL
    const repoMatch = project.repository.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      res.status(400).json({ error: 'Invalid repository URL format' });
      return;
    }

    const [, owner, repo] = repoMatch;

    const status = await githubRetryService.getRetryWorkflowStatus(
      projectId,
      owner,
      repo,
      parseInt(runId)
    );

    res.json({
      runId: parseInt(runId),
      status: status.status,
      conclusion: status.conclusion,
      htmlUrl: status.html_url,
      jobs: status.jobs
    });

  } catch (error) {
    logger.error(`Error getting retry status for run ${req.params.runId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get retry status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/github/projects/:projectId/has-retry-workflow - Check if retry workflow exists
router.get('/projects/:projectId/has-retry-workflow', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Extract owner/repo from repository URL
    const repoMatch = project.repository.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      res.status(400).json({ error: 'Invalid repository URL format' });
      return;
    }

    const [, owner, repo] = repoMatch;

    const hasWorkflow = await githubRetryService.hasRetryWorkflow(projectId, owner, repo);

    res.json({
      hasRetryWorkflow: hasWorkflow,
      projectId,
      repository: `${owner}/${repo}`
    });

  } catch (error) {
    logger.error(`Error checking retry workflow for project ${req.params.projectId}:`, error);
    res.status(500).json({ 
      error: 'Failed to check retry workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/github/config/validate - Validate GitHub App configuration
router.get('/config/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = githubApp.validateConfiguration();
    
    res.json({
      valid: validation.valid,
      errors: validation.errors,
      appId: process.env.GITHUB_APP_ID ? 'configured' : 'missing',
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY ? 'configured' : 'missing',
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ? 'configured' : 'missing'
    });
  } catch (error) {
    logger.error('Error validating GitHub configuration:', error);
    res.status(500).json({ 
      error: 'Failed to validate configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/github/config/clear-cache - Clear GitHub App token cache
router.post('/config/clear-cache', async (req: Request, res: Response): Promise<void> => {
  try {
    githubApp.clearTokenCache();
    
    res.json({
      message: 'GitHub App token cache cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing GitHub token cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;