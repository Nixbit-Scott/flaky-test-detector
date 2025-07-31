import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  http_url_to_repo: string;
  ssh_url_to_repo: string;
  default_branch: string;
  visibility: 'private' | 'internal' | 'public';
  namespace: {
    id: number;
    name: string;
    path: string;
    kind: string;
  };
}

export interface GitLabPipeline {
  id: number;
  iid: number;
  project_id: number;
  sha: string;
  ref: string;
  status: 'created' | 'waiting_for_resource' | 'preparing' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped' | 'manual' | 'scheduled';
  source: string;
  created_at: string;
  updated_at: string;
  web_url: string;
}

export interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: 'created' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped' | 'manual';
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
  web_url: string;
  pipeline: {
    id: number;
    project_id: number;
    ref: string;
    sha: string;
  };
}

export interface CreatePipelineRequest {
  ref: string;
  variables?: Array<{
    key: string;
    value: string;
    variable_type?: 'env_var' | 'file';
  }>;
}

export interface GitLabWebhookConfig {
  url: string;
  push_events?: boolean;
  issues_events?: boolean;
  merge_requests_events?: boolean;
  tag_push_events?: boolean;
  note_events?: boolean;
  job_events?: boolean;
  pipeline_events?: boolean;
  wiki_page_events?: boolean;
  deployment_events?: boolean;
  releases_events?: boolean;
  enable_ssl_verification?: boolean;
  token?: string;
}

/**
 * GitLab API Service for project and pipeline management
 * Provides integration with GitLab API for flaky test retry functionality
 */
export class GitLabApiService {
  private api: AxiosInstance;
  private baseUrl: string;
  private accessToken: string;

  constructor(accessToken?: string, baseUrl: string = 'https://gitlab.com/api/v4') {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken || process.env.GITLAB_ACCESS_TOKEN || '';
    
    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        logger.debug('GitLab API Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error('GitLab API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.api.interceptors.response.use(
      (response) => {
        logger.debug('GitLab API Response:', {
          status: response.status,
          url: response.config.url,
          dataSize: JSON.stringify(response.data).length,
        });
        return response;
      },
      (error) => {
        logger.error('GitLab API Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate GitLab API configuration and token
   */
  async validateConfiguration(): Promise<{ valid: boolean; errors: string[]; user?: any }> {
    const errors: string[] = [];

    if (!this.accessToken) {
      errors.push('GitLab access token is not configured');
    }

    if (!this.baseUrl) {
      errors.push('GitLab API base URL is not configured');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    try {
      // Test the token by getting current user info
      const response = await this.api.get('/user');
      
      return {
        valid: true,
        errors: [],
        user: {
          id: response.data.id,
          username: response.data.username,
          name: response.data.name,
          email: response.data.email,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          errors.push('GitLab access token is invalid or expired');
        } else if (error.response?.status === 403) {
          errors.push('GitLab access token does not have sufficient permissions');
        } else {
          errors.push(`GitLab API error: ${error.message}`);
        }
      } else {
        errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return { valid: false, errors };
    }
  }

  /**
   * Get a GitLab project by ID or path
   */
  async getProject(projectId: string | number): Promise<GitLabProject> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const response: AxiosResponse<GitLabProject> = await this.api.get(`/projects/${encodedId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching GitLab project ${projectId}:`, error);
      throw new Error(`Failed to fetch GitLab project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List projects accessible to the authenticated user
   */
  async getProjects(options: {
    search?: string;
    owned?: boolean;
    membership?: boolean;
    perPage?: number;
    page?: number;
  } = {}): Promise<GitLabProject[]> {
    try {
      const params: any = {
        per_page: options.perPage || 20,
        page: options.page || 1,
      };

      if (options.search) params.search = options.search;
      if (options.owned) params.owned = true;
      if (options.membership) params.membership = true;

      const response: AxiosResponse<GitLabProject[]> = await this.api.get('/projects', { params });
      return response.data;
    } catch (error) {
      logger.error('Error fetching GitLab projects:', error);
      throw new Error(`Failed to fetch GitLab projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pipelines for a project
   */
  async getPipelines(
    projectId: string | number,
    options: {
      ref?: string;
      status?: string;
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitLabPipeline[]> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const params: any = {
        per_page: options.perPage || 20,
        page: options.page || 1,
      };

      if (options.ref) params.ref = options.ref;
      if (options.status) params.status = options.status;

      const response: AxiosResponse<GitLabPipeline[]> = await this.api.get(
        `/projects/${encodedId}/pipelines`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error(`Error fetching pipelines for project ${projectId}:`, error);
      throw new Error(`Failed to fetch pipelines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific pipeline
   */
  async getPipeline(projectId: string | number, pipelineId: number): Promise<GitLabPipeline> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const response: AxiosResponse<GitLabPipeline> = await this.api.get(
        `/projects/${encodedId}/pipelines/${pipelineId}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Error fetching pipeline ${pipelineId} for project ${projectId}:`, error);
      throw new Error(`Failed to fetch pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new pipeline (trigger a pipeline run)
   */
  async createPipeline(
    projectId: string | number,
    request: CreatePipelineRequest
  ): Promise<GitLabPipeline> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const response: AxiosResponse<GitLabPipeline> = await this.api.post(
        `/projects/${encodedId}/pipeline`,
        request
      );
      return response.data;
    } catch (error) {
      logger.error(`Error creating pipeline for project ${projectId}:`, error);
      throw new Error(`Failed to create pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retry a failed pipeline
   */
  async retryPipeline(projectId: string | number, pipelineId: number): Promise<GitLabPipeline> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const response: AxiosResponse<GitLabPipeline> = await this.api.post(
        `/projects/${encodedId}/pipelines/${pipelineId}/retry`
      );
      return response.data;
    } catch (error) {
      logger.error(`Error retrying pipeline ${pipelineId} for project ${projectId}:`, error);
      throw new Error(`Failed to retry pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get jobs for a pipeline
   */
  async getPipelineJobs(
    projectId: string | number,
    pipelineId: number,
    options: {
      scope?: 'created' | 'pending' | 'running' | 'failed' | 'success' | 'canceled' | 'skipped' | 'manual';
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitLabJob[]> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const params: any = {
        per_page: options.perPage || 20,
        page: options.page || 1,
      };

      if (options.scope) params.scope = options.scope;

      const response: AxiosResponse<GitLabJob[]> = await this.api.get(
        `/projects/${encodedId}/pipelines/${pipelineId}/jobs`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error(`Error fetching jobs for pipeline ${pipelineId}:`, error);
      throw new Error(`Failed to fetch pipeline jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(projectId: string | number, jobId: number): Promise<GitLabJob> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const response: AxiosResponse<GitLabJob> = await this.api.post(
        `/projects/${encodedId}/jobs/${jobId}/retry`
      );
      return response.data;
    } catch (error) {
      logger.error(`Error retrying job ${jobId} for project ${projectId}:`, error);
      throw new Error(`Failed to retry job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get project webhooks
   */
  async getProjectWebhooks(projectId: string | number): Promise<any[]> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const response = await this.api.get(`/projects/${encodedId}/hooks`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching webhooks for project ${projectId}:`, error);
      throw new Error(`Failed to fetch webhooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a project webhook
   */
  async createProjectWebhook(
    projectId: string | number,
    config: GitLabWebhookConfig
  ): Promise<any> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      const response = await this.api.post(`/projects/${encodedId}/hooks`, config);
      return response.data;
    } catch (error) {
      logger.error(`Error creating webhook for project ${projectId}:`, error);
      throw new Error(`Failed to create webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a project webhook
   */
  async deleteProjectWebhook(projectId: string | number, webhookId: number): Promise<void> {
    try {
      const encodedId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;
      await this.api.delete(`/projects/${encodedId}/hooks/${webhookId}`);
    } catch (error) {
      logger.error(`Error deleting webhook ${webhookId} for project ${projectId}:`, error);
      throw new Error(`Failed to delete webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a GitLab CI pipeline specifically for retrying flaky tests
   */
  async createRetryPipeline(
    projectId: string | number,
    branch: string,
    failedTests: string[],
    originalPipelineId?: number
  ): Promise<GitLabPipeline> {
    try {
      const variables = [
        {
          key: 'FLAKY_RETRY_MODE',
          value: 'true',
        },
        {
          key: 'FAILED_TESTS',
          value: failedTests.join(','),
        },
        {
          key: 'RETRY_COUNT',
          value: '3',
        },
      ];

      if (originalPipelineId) {
        variables.push({
          key: 'ORIGINAL_PIPELINE_ID',
          value: originalPipelineId.toString(),
        });
      }

      const pipeline = await this.createPipeline(projectId, {
        ref: branch,
        variables,
      });

      logger.info(`Created retry pipeline ${pipeline.id} for project ${projectId}`, {
        projectId,
        pipelineId: pipeline.id,
        branch,
        testCount: failedTests.length,
        originalPipelineId,
      });

      return pipeline;
    } catch (error) {
      logger.error(`Error creating retry pipeline for project ${projectId}:`, error);
      throw new Error(`Failed to create retry pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract project ID from GitLab repository URL
   */
  static extractProjectIdFromUrl(repositoryUrl: string): string | null {
    // Handle various GitLab URL formats:
    // https://gitlab.com/group/project
    // https://gitlab.com/group/subgroup/project
    // git@gitlab.com:group/project.git
    // https://gitlab.example.com/group/project
    
    const patterns = [
      /gitlab\.(?:com|[a-z]+)\/(.+?)(?:\.git)?$/i,  // HTTPS URLs
      /git@gitlab\.(?:com|[a-z]+):(.+?)(?:\.git)?$/i,  // SSH URLs
    ];

    for (const pattern of patterns) {
      const match = repositoryUrl.match(pattern);
      if (match) {
        return match[1].replace(/\/$/, ''); // Remove trailing slash
      }
    }

    return null;
  }

  /**
   * Check if a repository URL is a GitLab repository
   */
  static isGitLabRepository(repositoryUrl: string): boolean {
    return /gitlab\.(?:com|[a-z]+)/i.test(repositoryUrl);
  }
}