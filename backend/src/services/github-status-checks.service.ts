import { GitHubAppService } from './github-app.service';
import { FlakyTestDetectionService } from './flaky-test-detection.service';
import { logger } from '../utils/logger';
import { prisma } from './database.service';

export interface StatusCheckOptions {
  state: 'error' | 'failure' | 'pending' | 'success';
  description?: string;
  target_url?: string;
  context: string;
}

export interface CheckRunSummary {
  totalTests: number;
  flakyTests: number;
  highRiskTests: number;
  recommendations: string[];
}

export class GitHubStatusChecksService {
  private githubApp: GitHubAppService;

  constructor() {
    this.githubApp = GitHubAppService.getInstance();
  }

  /**
   * Create a status check for flaky test detection
   */
  public async createFlakyTestStatusCheck(
    projectId: string,
    owner: string,
    repo: string,
    sha: string,
    summary: CheckRunSummary
  ): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        logger.warn(`No GitHub installation found for project ${projectId}`);
        return;
      }

      const installationId = parseInt(project.githubInstallationId);
      const state = this.determineCheckState(summary);
      const description = this.generateStatusDescription(summary);
      
      const dashboardUrl = `${process.env.FRONTEND_URL}/projects/${projectId}/flaky-tests`;

      await this.githubApp.createStatusCheck(installationId, owner, repo, sha, {
        state,
        description,
        target_url: dashboardUrl,
        context: 'flaky-test-detector/analysis',
      });

      logger.info(`Created flaky test status check for ${owner}/${repo}@${sha}: ${state}`);
    } catch (error) {
      logger.error(`Failed to create flaky test status check for ${owner}/${repo}@${sha}:`, error);
      throw error;
    }
  }

  /**
   * Create a comprehensive check run with detailed analysis
   */
  public async createFlakyTestCheckRun(
    projectId: string,
    owner: string,
    repo: string,
    sha: string,
    summary: CheckRunSummary,
    testFiles?: Array<{
      path: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      flakyTests: string[];
      confidence: number;
    }>
  ): Promise<{ id: number; html_url: string }> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        throw new Error(`No GitHub installation found for project ${projectId}`);
      }

      const installationId = parseInt(project.githubInstallationId);
      const conclusion = this.determineCheckConclusion(summary);
      const dashboardUrl = `${process.env.FRONTEND_URL}/projects/${projectId}/flaky-tests`;

      const checkRunOptions = {
        name: 'Flaky Test Detection',
        head_sha: sha,
        status: 'completed' as const,
        conclusion,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        details_url: dashboardUrl,
        external_id: `flaky-check-${projectId}-${sha}`,
        output: {
          title: `Flaky Test Analysis Results`,
          summary: this.generateCheckRunSummary(summary),
          text: this.generateCheckRunDetails(summary, testFiles),
          annotations: this.generateAnnotations(testFiles || []),
        },
        actions: this.generateCheckRunActions(summary),
      };

      const checkRun = await this.githubApp.createCheckRun(installationId, owner, repo, checkRunOptions);

      logger.info(`Created flaky test check run for ${owner}/${repo}@${sha}: ${conclusion}`);
      return checkRun;
    } catch (error) {
      logger.error(`Failed to create flaky test check run for ${owner}/${repo}@${sha}:`, error);
      throw error;
    }
  }

  /**
   * Create a status check for retry operations
   */
  public async createRetryStatusCheck(
    projectId: string,
    owner: string,
    repo: string,
    sha: string,
    retryInfo: {
      totalRetries: number;
      successfulRetries: number;
      failedRetries: number;
      retriedTests: string[];
    }
  ): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        logger.warn(`No GitHub installation found for project ${projectId}`);
        return;
      }

      const installationId = parseInt(project.githubInstallationId);
      const state = retryInfo.failedRetries === 0 ? 'success' : 'failure';
      const description = `Retried ${retryInfo.totalRetries} flaky tests: ${retryInfo.successfulRetries} passed, ${retryInfo.failedRetries} failed`;
      
      const dashboardUrl = `${process.env.FRONTEND_URL}/projects/${projectId}/retry-history`;

      await this.githubApp.createStatusCheck(installationId, owner, repo, sha, {
        state,
        description,
        target_url: dashboardUrl,
        context: 'flaky-test-detector/retry',
      });

      logger.info(`Created retry status check for ${owner}/${repo}@${sha}: ${state}`);
    } catch (error) {
      logger.error(`Failed to create retry status check for ${owner}/${repo}@${sha}:`, error);
      throw error;
    }
  }

  /**
   * Update status check to pending while analysis is running
   */
  public async createPendingStatusCheck(
    projectId: string,
    owner: string,
    repo: string,
    sha: string,
    context: string = 'flaky-test-detector/analysis'
  ): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        logger.warn(`No GitHub installation found for project ${projectId}`);
        return;
      }

      const installationId = parseInt(project.githubInstallationId);
      const dashboardUrl = `${process.env.FRONTEND_URL}/projects/${projectId}`;

      await this.githubApp.createStatusCheck(installationId, owner, repo, sha, {
        state: 'pending',
        description: 'Analyzing tests for flaky patterns...',
        target_url: dashboardUrl,
        context,
      });

      logger.info(`Created pending status check for ${owner}/${repo}@${sha}`);
    } catch (error) {
      logger.error(`Failed to create pending status check for ${owner}/${repo}@${sha}:`, error);
      throw error;
    }
  }

  /**
   * Create status check when analysis fails
   */
  public async createErrorStatusCheck(
    projectId: string,
    owner: string,
    repo: string,
    sha: string,
    errorMessage: string,
    context: string = 'flaky-test-detector/analysis'
  ): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        logger.warn(`No GitHub installation found for project ${projectId}`);
        return;
      }

      const installationId = parseInt(project.githubInstallationId);
      const dashboardUrl = `${process.env.FRONTEND_URL}/projects/${projectId}`;

      await this.githubApp.createStatusCheck(installationId, owner, repo, sha, {
        state: 'error',
        description: `Analysis failed: ${errorMessage}`,
        target_url: dashboardUrl,
        context,
      });

      logger.info(`Created error status check for ${owner}/${repo}@${sha}: ${errorMessage}`);
    } catch (error) {
      logger.error(`Failed to create error status check for ${owner}/${repo}@${sha}:`, error);
      throw error;
    }
  }

  private determineCheckState(summary: CheckRunSummary): 'error' | 'failure' | 'pending' | 'success' {
    if (summary.highRiskTests > 0) {
      return 'failure';
    } else if (summary.flakyTests > 0) {
      return 'success'; // Warning but not blocking
    } else {
      return 'success';
    }
  }

  private determineCheckConclusion(summary: CheckRunSummary): 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' {
    if (summary.highRiskTests > 0) {
      return 'action_required'; // Requires attention but doesn't fail the build
    } else if (summary.flakyTests > 0) {
      return 'neutral'; // Information only
    } else {
      return 'success';
    }
  }

  private generateStatusDescription(summary: CheckRunSummary): string {
    if (summary.highRiskTests > 0) {
      return `⚠️ ${summary.highRiskTests} high-risk flaky tests detected - review recommended`;
    } else if (summary.flakyTests > 0) {
      return `✅ ${summary.flakyTests} flaky tests detected - low risk`;
    } else {
      return '✅ No flaky tests detected';
    }
  }

  private generateCheckRunSummary(summary: CheckRunSummary): string {
    let result = `## 🔮 Flaky Test Detection Results\n\n`;
    result += `**Total Tests Analyzed:** ${summary.totalTests}\n`;
    result += `**Flaky Tests Found:** ${summary.flakyTests}\n`;
    result += `**High Risk Tests:** ${summary.highRiskTests}\n\n`;

    if (summary.highRiskTests > 0) {
      result += `⚠️ **Action Required:** ${summary.highRiskTests} tests have high flaky risk and may cause build instability.\n\n`;
    } else if (summary.flakyTests > 0) {
      result += `ℹ️ **Information:** ${summary.flakyTests} tests show flaky patterns but are currently low risk.\n\n`;
    } else {
      result += `✅ **Great!** No flaky test patterns detected in your test suite.\n\n`;
    }

    return result;
  }

  private generateCheckRunDetails(summary: CheckRunSummary, testFiles?: Array<{
    path: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flakyTests: string[];
    confidence: number;
  }>): string {
    let details = `### 📊 Analysis Details\n\n`;

    if (summary.recommendations.length > 0) {
      details += `#### 💡 Recommendations\n\n`;
      summary.recommendations.forEach(rec => {
        details += `- ${rec}\n`;
      });
      details += `\n`;
    }

    if (testFiles && testFiles.length > 0) {
      details += `#### 📁 File Analysis\n\n`;
      testFiles.forEach(file => {
        const riskEmoji = this.getRiskEmoji(file.riskLevel);
        details += `${riskEmoji} **${file.path}** (Risk: ${file.riskLevel.toUpperCase()})\n`;
        details += `- **Confidence:** ${Math.round(file.confidence * 100)}%\n`;
        if (file.flakyTests.length > 0) {
          details += `- **Flaky Tests:** ${file.flakyTests.join(', ')}\n`;
        }
        details += `\n`;
      });
    }

    details += `#### 🔗 Resources\n\n`;
    details += `- [View detailed analysis in dashboard](${process.env.FRONTEND_URL})\n`;
    details += `- [Learn about flaky test patterns](${process.env.FRONTEND_URL}/docs/flaky-tests)\n`;
    details += `- [Configure retry settings](${process.env.FRONTEND_URL}/docs/retry-configuration)\n`;

    return details;
  }

  private generateAnnotations(testFiles: Array<{
    path: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flakyTests: string[];
    confidence: number;
  }>): Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: 'notice' | 'warning' | 'failure';
    message: string;
    title?: string;
  }> {
    const annotations: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: 'notice' | 'warning' | 'failure';
      message: string;
      title?: string;
    }> = [];

    testFiles.forEach(file => {
      if (file.flakyTests.length > 0) {
        const level = file.riskLevel === 'high' || file.riskLevel === 'critical' ? 'failure' : 
                     file.riskLevel === 'medium' ? 'warning' : 'notice';

        annotations.push({
          path: file.path,
          start_line: 1,
          end_line: 1,
          annotation_level: level,
          title: `Flaky Test Pattern Detected (${file.riskLevel} risk)`,
          message: `This test file contains ${file.flakyTests.length} potentially flaky tests: ${file.flakyTests.join(', ')}. Confidence: ${Math.round(file.confidence * 100)}%`,
        });
      }
    });

    return annotations;
  }

  private generateCheckRunActions(summary: CheckRunSummary): Array<{
    label: string;
    description: string;
    identifier: string;
  }> {
    const actions: Array<{
      label: string;
      description: string;
      identifier: string;
    }> = [];

    if (summary.flakyTests > 0) {
      actions.push({
        label: 'View Dashboard',
        description: 'Open the Flaky Test Detector dashboard to see detailed analysis',
        identifier: 'view_dashboard',
      });

      actions.push({
        label: 'Configure Retries',
        description: 'Set up intelligent retry logic for flaky tests',
        identifier: 'configure_retries',
      });
    }

    if (summary.highRiskTests > 0) {
      actions.push({
        label: 'Review High Risk Tests',
        description: 'Examine tests flagged as high risk for flaky behavior',
        identifier: 'review_high_risk',
      });
    }

    return actions;
  }

  private getRiskEmoji(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📝';
    }
  }
}