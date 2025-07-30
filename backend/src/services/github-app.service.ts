import jwt from 'jsonwebtoken';
import axios from 'axios';
import { logger } from '../utils/logger';

export interface GitHubAppToken {
  token: string;
  expiresAt: Date;
  repositorySelection: 'all' | 'selected';
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
  }>;
}

export interface GitHubInstallation {
  id: number;
  account: {
    id: number;
    login: string;
    type: 'User' | 'Organization';
  };
  app_id: number;
  repository_selection: 'all' | 'selected';
  repositories_url: string;
}

export class GitHubAppService {
  private static instance: GitHubAppService;
  private installationTokens = new Map<number, { token: string; expiresAt: Date }>();

  private constructor() {}

  public static getInstance(): GitHubAppService {
    if (!GitHubAppService.instance) {
      GitHubAppService.instance = new GitHubAppService();
    }
    return GitHubAppService.instance;
  }

  /**
   * Generate GitHub App JWT for authentication
   */
  public generateAppJWT(): string {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error('GitHub App credentials not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY environment variables.');
    }

    // Convert PEM key (handle both base64 encoded and direct PEM format)
    let formattedPrivateKey = privateKey;
    if (!privateKey.includes('-----BEGIN')) {
      // If it's base64 encoded, decode it
      try {
        formattedPrivateKey = Buffer.from(privateKey, 'base64').toString('utf8');
      } catch (error) {
        logger.error('Failed to decode GitHub App private key:', error);
        throw new Error('Invalid GitHub App private key format');
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 1 minute in the past
      exp: now + (10 * 60), // Expires in 10 minutes
      iss: appId,
    };

    try {
      return jwt.sign(payload, formattedPrivateKey, { algorithm: 'RS256' });
    } catch (error) {
      logger.error('Failed to generate GitHub App JWT:', error);
      throw new Error('Failed to generate GitHub App JWT');
    }
  }

  /**
   * Get installation access token for a specific installation
   */
  public async getInstallationToken(installationId: number): Promise<GitHubAppToken> {
    // Check if we have a cached token that's still valid
    const cached = this.installationTokens.get(installationId);
    if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) { // 5 minutes buffer
      return {
        token: cached.token,
        expiresAt: cached.expiresAt,
        repositorySelection: 'all', // Would need to store this in cache too
      };
    }

    const appJWT = this.generateAppJWT();

    try {
      const response = await axios.post(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${appJWT}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Flaky-Test-Detector/1.0',
          },
        }
      );

      const { token, expires_at, repository_selection, repositories } = response.data;
      const expiresAt = new Date(expires_at);

      // Cache the token
      this.installationTokens.set(installationId, {
        token,
        expiresAt,
      });

      logger.info(`Generated installation token for installation ${installationId}`);

      return {
        token,
        expiresAt,
        repositorySelection: repository_selection,
        repositories,
      };
    } catch (error) {
      logger.error(`Failed to get installation token for ${installationId}:`, error);
      throw new Error(`Failed to get GitHub installation token: ${error}`);
    }
  }

  /**
   * Get all installations for this GitHub App
   */
  public async getInstallations(): Promise<GitHubInstallation[]> {
    const appJWT = this.generateAppJWT();

    try {
      const response = await axios.get('https://api.github.com/app/installations', {
        headers: {
          'Authorization': `Bearer ${appJWT}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Flaky-Test-Detector/1.0',
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get GitHub App installations:', error);
      throw new Error(`Failed to get GitHub App installations: ${error}`);
    }
  }

  /**
   * Get repositories accessible by an installation
   */
  public async getInstallationRepositories(installationId: number): Promise<Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
  }>> {
    const installationToken = await this.getInstallationToken(installationId);

    try {
      const response = await axios.get('https://api.github.com/installation/repositories', {
        headers: {
          'Authorization': `token ${installationToken.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Flaky-Test-Detector/1.0',
        },
      });

      return response.data.repositories;
    } catch (error) {
      logger.error(`Failed to get repositories for installation ${installationId}:`, error);
      throw new Error(`Failed to get installation repositories: ${error}`);
    }
  }

  /**
   * Authenticate request to GitHub API with installation token
   */
  public async authenticatedRequest(
    installationId: number,
    url: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      data?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<any> {
    const installationToken = await this.getInstallationToken(installationId);
    const { method = 'GET', data, headers = {} } = options;

    try {
      const response = await axios({
        method,
        url: url.startsWith('http') ? url : `https://api.github.com${url}`,
        data,
        headers: {
          'Authorization': `token ${installationToken.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Flaky-Test-Detector/1.0',
          ...headers,
        },
      });

      return response.data;
    } catch (error) {
      logger.error(`GitHub API request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Create or update a status check on a commit
   */
  public async createStatusCheck(
    installationId: number,
    owner: string,
    repo: string,
    sha: string,
    status: {
      state: 'error' | 'failure' | 'pending' | 'success';
      target_url?: string;
      description?: string;
      context: string;
    }
  ): Promise<void> {
    try {
      await this.authenticatedRequest(installationId, `/repos/${owner}/${repo}/statuses/${sha}`, {
        method: 'POST',
        data: status,
      });

      logger.info(`Created status check for ${owner}/${repo}@${sha}: ${status.state}`);
    } catch (error) {
      logger.error(`Failed to create status check for ${owner}/${repo}@${sha}:`, error);
      throw error;
    }
  }

  /**
   * Create or update a check run (more advanced than status checks)
   */
  public async createCheckRun(
    installationId: number,
    owner: string,
    repo: string,
    options: {
      name: string;
      head_sha: string;
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
      started_at?: string;
      completed_at?: string;
      details_url?: string;
      external_id?: string;
      output?: {
        title: string;
        summary: string;
        text?: string;
        annotations?: Array<{
          path: string;
          start_line: number;
          end_line: number;
          annotation_level: 'notice' | 'warning' | 'failure';
          message: string;
          title?: string;
          raw_details?: string;
        }>;
      };
      actions?: Array<{
        label: string;
        description: string;
        identifier: string;
      }>;
    }
  ): Promise<{ id: number; html_url: string }> {
    try {
      const response = await this.authenticatedRequest(installationId, `/repos/${owner}/${repo}/check-runs`, {
        method: 'POST',
        data: options,
      });

      logger.info(`Created check run for ${owner}/${repo}@${options.head_sha}: ${options.name}`);
      return response;
    } catch (error) {
      logger.error(`Failed to create check run for ${owner}/${repo}@${options.head_sha}:`, error);
      throw error;
    }
  }

  /**
   * Post a comment on a pull request
   */
  public async createPRComment(
    installationId: number,
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<void> {
    try {
      await this.authenticatedRequest(installationId, `/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
        method: 'POST',
        data: { body },
      });

      logger.info(`Posted comment on PR ${owner}/${repo}#${prNumber}`);
    } catch (error) {
      logger.error(`Failed to post PR comment on ${owner}/${repo}#${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get workflow runs for a repository
   */
  public async getWorkflowRuns(
    installationId: number,
    owner: string,
    repo: string,
    options: {
      branch?: string;
      event?: string;
      status?: 'completed' | 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'skipped' | 'stale' | 'success' | 'timed_out' | 'in_progress' | 'queued' | 'requested' | 'waiting';
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });

    const query = queryParams.toString();
    const url = `/repos/${owner}/${repo}/actions/runs${query ? `?${query}` : ''}`;

    try {
      return await this.authenticatedRequest(installationId, url);
    } catch (error) {
      logger.error(`Failed to get workflow runs for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Download and parse workflow run artifacts
   */
  public async getWorkflowArtifacts(
    installationId: number,
    owner: string,
    repo: string,
    runId: number
  ): Promise<Array<{
    id: number;
    name: string;
    size_in_bytes: number;
    archive_download_url: string;
  }>> {
    try {
      const response = await this.authenticatedRequest(
        installationId,
        `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`
      );

      return response.artifacts;
    } catch (error) {
      logger.error(`Failed to get workflow artifacts for ${owner}/${repo} run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Clear cached installation tokens (useful for testing or manual refresh)
   */
  public clearTokenCache(): void {
    this.installationTokens.clear();
    logger.info('Cleared GitHub App installation token cache');
  }

  /**
   * Validate GitHub App configuration
   */
  public validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!process.env.GITHUB_APP_ID) {
      errors.push('GITHUB_APP_ID environment variable is not set');
    }

    if (!process.env.GITHUB_APP_PRIVATE_KEY) {
      errors.push('GITHUB_APP_PRIVATE_KEY environment variable is not set');
    }

    try {
      if (process.env.GITHUB_APP_PRIVATE_KEY) {
        this.generateAppJWT();
      }
    } catch (error) {
      errors.push(`GitHub App JWT generation failed: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}