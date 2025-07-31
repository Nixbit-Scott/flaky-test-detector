import { Router, Request, Response } from 'express';
import { GitLabApiService } from '../services/gitlab-api.service';
import { RetryLogicService } from '../services/retry-logic.service';
import { logger } from '../utils/logger';
import { prisma } from '../services/database.service';
import { z } from 'zod';

const router = Router();

// Validation schemas
const retryPipelineSchema = z.object({
  testNames: z.array(z.string()).min(1, 'At least one test name is required'),
  originalPipelineId: z.number().optional(),
  branch: z.string().default('main'),
});

const setupWebhookSchema = z.object({
  webhookUrl: z.string().url('Invalid webhook URL'),
  enableSslVerification: z.boolean().default(true),
  token: z.string().optional(),
});

// GET /api/gitlab/projects - List accessible GitLab projects
router.get('/projects', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, owned, membership, page = 1, perPage = 20 } = req.query;
    
    const gitlabService = new GitLabApiService();
    const projects = await gitlabService.getProjects({
      search: search as string,
      owned: owned === 'true',
      membership: membership === 'true',
      page: parseInt(page as string),
      perPage: parseInt(perPage as string),
    });
    
    res.json({
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        nameWithNamespace: project.name_with_namespace,
        path: project.path,
        pathWithNamespace: project.path_with_namespace,
        webUrl: project.web_url,
        httpUrlToRepo: project.http_url_to_repo,
        sshUrlToRepo: project.ssh_url_to_repo,
        defaultBranch: project.default_branch,
        visibility: project.visibility,
        namespace: project.namespace,
      }))
    });
  } catch (error) {
    logger.error('Error fetching GitLab projects:', error);
    res.status(500).json({ 
      error: 'Failed to fetch projects',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/gitlab/projects/:projectId - Get specific GitLab project
router.get('/projects/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    
    const gitlabService = new GitLabApiService();
    const project = await gitlabService.getProject(projectId);
    
    res.json({
      project: {
        id: project.id,
        name: project.name,
        nameWithNamespace: project.name_with_namespace,
        path: project.path,
        pathWithNamespace: project.path_with_namespace,
        webUrl: project.web_url,
        httpUrlToRepo: project.http_url_to_repo,
        sshUrlToRepo: project.ssh_url_to_repo,
        defaultBranch: project.default_branch,
        visibility: project.visibility,
        namespace: project.namespace,
      }
    });
  } catch (error) {
    logger.error(`Error fetching GitLab project ${req.params.projectId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/gitlab/projects/:projectId/pipelines - Get pipelines for a project
router.get('/projects/:projectId/pipelines', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { ref, status, page = 1, perPage = 20 } = req.query;
    
    const gitlabService = new GitLabApiService();
    const pipelines = await gitlabService.getPipelines(projectId, {
      ref: ref as string,
      status: status as string,
      page: parseInt(page as string),
      perPage: parseInt(perPage as string),
    });
    
    res.json({
      pipelines: pipelines.map(pipeline => ({
        id: pipeline.id,
        iid: pipeline.iid,
        projectId: pipeline.project_id,
        sha: pipeline.sha,
        ref: pipeline.ref,
        status: pipeline.status,
        source: pipeline.source,
        createdAt: pipeline.created_at,
        updatedAt: pipeline.updated_at,
        webUrl: pipeline.web_url,
      }))
    });
  } catch (error) {
    logger.error(`Error fetching pipelines for project ${req.params.projectId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch pipelines',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/gitlab/projects/:projectId/setup-webhook - Set up webhook for a project
router.post('/projects/:projectId/setup-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const validatedData = setupWebhookSchema.parse(req.body);
    
    const gitlabService = new GitLabApiService();
    
    // Create webhook configuration
    const webhookConfig = {
      url: validatedData.webhookUrl,
      push_events: false,
      issues_events: false,
      merge_requests_events: false,
      tag_push_events: false,
      note_events: false,
      job_events: true,
      pipeline_events: true,
      wiki_page_events: false,
      deployment_events: false,
      releases_events: false,
      enable_ssl_verification: validatedData.enableSslVerification,
      token: validatedData.token,
    };

    const webhook = await gitlabService.createProjectWebhook(projectId, webhookConfig);
    
    logger.info(`Created webhook for GitLab project ${projectId}`, {
      projectId,
      webhookId: webhook.id,
      url: webhook.url,
    });

    res.json({
      message: 'Webhook created successfully',
      webhook: {
        id: webhook.id,
        url: webhook.url,
        pipelineEvents: webhook.pipeline_events,
        jobEvents: webhook.job_events,
        enableSslVerification: webhook.enable_ssl_verification,
      },
    });
  } catch (error) {
    logger.error(`Error setting up webhook for project ${req.params.projectId}:`, error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request data',
        details: error.issues,
      });
      return;
    }
    
    res.status(500).json({ 
      error: 'Failed to setup webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/gitlab/projects/:projectId/webhooks - Get webhooks for a project
router.get('/projects/:projectId/webhooks', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    
    const gitlabService = new GitLabApiService();
    const webhooks = await gitlabService.getProjectWebhooks(projectId);
    
    res.json({
      webhooks: webhooks.map(webhook => ({
        id: webhook.id,
        url: webhook.url,
        pipelineEvents: webhook.pipeline_events,
        jobEvents: webhook.job_events,
        enableSslVerification: webhook.enable_ssl_verification,
        createdAt: webhook.created_at,
      }))
    });
  } catch (error) {
    logger.error(`Error fetching webhooks for project ${req.params.projectId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch webhooks',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/gitlab/projects/:nixbitProjectId/trigger-retry - Trigger retry pipeline for failed tests
router.post('/projects/:nixbitProjectId/trigger-retry', async (req: Request, res: Response): Promise<void> => {
  try {
    const { nixbitProjectId } = req.params;
    const validatedData = retryPipelineSchema.parse(req.body);
    
    // Get the Nixbit project to extract GitLab project information
    const project = await prisma.project.findUnique({
      where: { id: nixbitProjectId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!project.gitlabProjectId) {
      res.status(400).json({ error: 'Project is not configured with GitLab integration' });
      return;
    }

    // Extract GitLab project ID from the configured project
    const gitlabProjectId = project.gitlabProjectId;
    
    const gitlabService = new GitLabApiService();
    
    // Create retry pipeline
    const pipeline = await gitlabService.createRetryPipeline(
      gitlabProjectId,
      validatedData.branch,
      validatedData.testNames,
      validatedData.originalPipelineId
    );

    logger.info(`Triggered retry pipeline for project ${nixbitProjectId}`, {
      nixbitProjectId,
      gitlabProjectId,
      pipelineId: pipeline.id,
      testCount: validatedData.testNames.length,
      branch: validatedData.branch,
    });

    res.json({
      message: 'Retry pipeline triggered successfully',
      pipeline: {
        id: pipeline.id,
        projectId: pipeline.project_id,
        ref: pipeline.ref,
        sha: pipeline.sha,
        status: pipeline.status,
        webUrl: pipeline.web_url,
      },
      testCount: validatedData.testNames.length,
      branch: validatedData.branch,
    });
  } catch (error) {
    logger.error(`Error triggering retry for project ${req.params.nixbitProjectId}:`, error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request data',
        details: error.issues,
      });
      return;
    }
    
    res.status(500).json({ 
      error: 'Failed to trigger retry',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/gitlab/projects/:nixbitProjectId/retry-status/:pipelineId - Get retry pipeline status
router.get('/projects/:nixbitProjectId/retry-status/:pipelineId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { nixbitProjectId, pipelineId } = req.params;
    
    // Get the Nixbit project to extract GitLab project information
    const project = await prisma.project.findUnique({
      where: { id: nixbitProjectId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!project.gitlabProjectId) {
      res.status(400).json({ error: 'Project is not configured with GitLab integration' });
      return;
    }

    const gitlabService = new GitLabApiService();
    
    // Get pipeline status
    const pipeline = await gitlabService.getPipeline(project.gitlabProjectId, parseInt(pipelineId));
    
    // Get pipeline jobs
    const jobs = await gitlabService.getPipelineJobs(project.gitlabProjectId, parseInt(pipelineId));

    res.json({
      pipeline: {
        id: pipeline.id,
        projectId: pipeline.project_id,
        ref: pipeline.ref,
        sha: pipeline.sha,
        status: pipeline.status,
        source: pipeline.source,
        createdAt: pipeline.created_at,
        updatedAt: pipeline.updated_at,
        webUrl: pipeline.web_url,
      },
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        stage: job.stage,
        status: job.status,
        createdAt: job.created_at,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        duration: job.duration,
        webUrl: job.web_url,
      })),
    });
  } catch (error) {
    logger.error(`Error getting retry status for pipeline ${req.params.pipelineId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get retry status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/gitlab/projects/:nixbitProjectId/connect - Connect Nixbit project to GitLab project
router.post('/projects/:nixbitProjectId/connect', async (req: Request, res: Response): Promise<void> => {
  try {
    const { nixbitProjectId } = req.params;
    const { gitlabProjectId, gitlabProjectPath } = req.body;
    
    if (!gitlabProjectId && !gitlabProjectPath) {
      res.status(400).json({ error: 'Either gitlabProjectId or gitlabProjectPath is required' });
      return;
    }

    // Verify the GitLab project exists
    const gitlabService = new GitLabApiService();
    const gitlabProject = await gitlabService.getProject(gitlabProjectId || gitlabProjectPath);
    
    // Update the Nixbit project with GitLab information
    const updatedProject = await prisma.project.update({
      where: { id: nixbitProjectId },
      data: {
        gitlabProjectId: gitlabProject.id.toString(),
        repository: gitlabProject.http_url_to_repo,
        // Update other relevant fields if needed
      },
    });

    logger.info(`Connected Nixbit project ${nixbitProjectId} to GitLab project ${gitlabProject.id}`, {
      nixbitProjectId,
      gitlabProjectId: gitlabProject.id,
      gitlabProjectPath: gitlabProject.path_with_namespace,
    });

    res.json({
      message: 'Project connected to GitLab successfully',
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        gitlabProjectId: updatedProject.gitlabProjectId,
        repository: updatedProject.repository,
      },
      gitlabProject: {
        id: gitlabProject.id,
        name: gitlabProject.name,
        pathWithNamespace: gitlabProject.path_with_namespace,
        webUrl: gitlabProject.web_url,
        defaultBranch: gitlabProject.default_branch,
      },
    });
  } catch (error) {
    logger.error(`Error connecting project ${req.params.nixbitProjectId} to GitLab:`, error);
    res.status(500).json({ 
      error: 'Failed to connect project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/gitlab/config/validate - Validate GitLab API configuration
router.get('/config/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const gitlabService = new GitLabApiService();
    const validation = await gitlabService.validateConfiguration();
    
    res.json({
      valid: validation.valid,
      errors: validation.errors,
      user: validation.user,
      accessToken: process.env.GITLAB_ACCESS_TOKEN ? 'configured' : 'missing',
      baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com/api/v4',
    });
  } catch (error) {
    logger.error('Error validating GitLab configuration:', error);
    res.status(500).json({ 
      error: 'Failed to validate configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/gitlab/projects/:projectId/retry-job/:jobId - Retry a specific failed job
router.post('/projects/:projectId/retry-job/:jobId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, jobId } = req.params;
    
    const gitlabService = new GitLabApiService();
    const job = await gitlabService.retryJob(projectId, parseInt(jobId));
    
    logger.info(`Retried job ${jobId} for project ${projectId}`, {
      projectId,
      jobId: job.id,
      jobName: job.name,
      status: job.status,
    });

    res.json({
      message: 'Job retried successfully',
      job: {
        id: job.id,
        name: job.name,
        stage: job.stage,
        status: job.status,
        webUrl: job.web_url,
      },
    });
  } catch (error) {
    logger.error(`Error retrying job ${req.params.jobId} for project ${req.params.projectId}:`, error);
    res.status(500).json({ 
      error: 'Failed to retry job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;