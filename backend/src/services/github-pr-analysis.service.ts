import { PrismaClient } from '@prisma/client';
import { PredictiveAnalysisService } from './predictive-analysis.service';
import axios from 'axios';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface GitHubPRPayload {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: string;
    base: {
      repo: {
        full_name: string;
        name: string;
      };
      ref: string;
    };
    head: {
      repo: {
        full_name: string;
        name: string;
      };
      ref: string;
      sha: string;
    };
  };
  repository: {
    full_name: string;
    name: string;
  };
}

export interface FileAnalysisResult {
  filePath: string;
  riskScore: number;
  riskLevel: string;
  confidence: number;
  predictedFailureTypes: string[];
  analysisId: string;
}

export class GitHubPRAnalysisService {
  private predictiveService: PredictiveAnalysisService;

  constructor() {
    this.predictiveService = new PredictiveAnalysisService();
  }

  public async analyzePullRequest(payload: GitHubPRPayload): Promise<{
    analysisResults: FileAnalysisResult[];
    summary: {
      totalFiles: number;
      highRiskFiles: number;
      averageRiskScore: number;
      recommendations: string[];
    };
  }> {
    logger.info(`Starting PR analysis for ${payload.repository.full_name}#${payload.pull_request.number}`);

    try {
      // Find the project for this repository
      const project = await this.findProjectByRepository(payload.repository.full_name);
      if (!project) {
        throw new Error(`No project found for repository ${payload.repository.full_name}`);
      }

      // Get changed files in the PR
      const changedFiles = await this.getChangedFiles(
        payload.repository.full_name,
        payload.pull_request.number,
        project.githubInstallationId
      );

      // Filter for test files only
      const testFiles = changedFiles.filter(file => 
        this.isTestFile(file.filename) && file.status !== 'removed'
      );

      if (testFiles.length === 0) {
        logger.info(`No test files changed in PR ${payload.pull_request.number}`);
        return {
          analysisResults: [],
          summary: {
            totalFiles: 0,
            highRiskFiles: 0,
            averageRiskScore: 0,
            recommendations: ['No test files were modified in this PR']
          }
        };
      }

      // Analyze each test file
      const analysisResults: FileAnalysisResult[] = [];
      for (const file of testFiles) {
        try {
          const fileContent = await this.getFileContent(
            payload.repository.full_name,
            file.filename,
            payload.pull_request.head.sha,
            project.githubInstallationId
          );

          const result = await this.predictiveService.analyzeTestFile(
            project.id,
            file.filename,
            fileContent
          );

          analysisResults.push({
            filePath: file.filename,
            riskScore: result.riskScore,
            riskLevel: result.riskLevel,
            confidence: result.confidence,
            predictedFailureTypes: result.predictedFailureTypes,
            analysisId: result.id
          });

        } catch (error) {
          logger.error(`Error analyzing file ${file.filename}:`, error);
          // Continue with other files
        }
      }

      // Generate summary
      const summary = this.generateAnalysisSummary(analysisResults);

      // Post PR comment if there are high-risk files
      if (summary.highRiskFiles > 0) {
        await this.postPRComment(
          payload.repository.full_name,
          payload.pull_request.number,
          analysisResults,
          summary,
          project.githubInstallationId
        );
      }

      logger.info(`PR analysis completed for ${payload.repository.full_name}#${payload.pull_request.number}: ${summary.totalFiles} files analyzed, ${summary.highRiskFiles} high-risk`);

      return { analysisResults, summary };

    } catch (error) {
      logger.error(`Error in PR analysis for ${payload.repository.full_name}#${payload.pull_request.number}:`, error);
      throw error;
    }
  }

  private async findProjectByRepository(repositoryFullName: string) {
    // Try exact match first
    let project = await prisma.project.findFirst({
      where: {
        repository: repositoryFullName
      }
    });

    // If not found, try partial match
    if (!project) {
      project = await prisma.project.findFirst({
        where: {
          repository: {
            endsWith: repositoryFullName.split('/')[1] // Match by repo name only
          }
        }
      });
    }

    return project;
  }

  private isTestFile(filename: string): boolean {
    const testPatterns = [
      /\.test\.(js|ts|jsx|tsx)$/,
      /\.spec\.(js|ts|jsx|tsx)$/,
      /__tests__\//,
      /\/tests?\//,
      /\/spec\//,
      /\.cy\.(js|ts)$/, // Cypress
      /\.e2e\.(js|ts)$/ // E2E tests
    ];

    return testPatterns.some(pattern => pattern.test(filename));
  }

  private async getChangedFiles(
    repositoryFullName: string,
    prNumber: number,
    installationId: string | null
  ): Promise<Array<{ filename: string; status: string; additions: number; deletions: number }>> {
    if (!installationId) {
      throw new Error('GitHub installation not configured for this project');
    }

    try {
      // In a real implementation, you'd use the GitHub App authentication
      // For now, we'll simulate the API call
      const response = await axios.get(
        `https://api.github.com/repos/${repositoryFullName}/pulls/${prNumber}/files`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${process.env.GITHUB_TOKEN}`, // Fallback to personal token
          }
        }
      );

      return response.data.map((file: any) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions
      }));

    } catch (error) {
      logger.error(`Error fetching changed files for PR ${prNumber}:`, error);
      // Return empty array if we can't fetch files
      return [];
    }
  }

  private async getFileContent(
    repositoryFullName: string,
    filename: string,
    sha: string,
    installationId: string | null
  ): Promise<string> {
    if (!installationId) {
      throw new Error('GitHub installation not configured for this project');
    }

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${repositoryFullName}/contents/${filename}?ref=${sha}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${process.env.GITHUB_TOKEN}`, // Fallback to personal token
          }
        }
      );

      // Decode base64 content
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return content;

    } catch (error) {
      logger.error(`Error fetching file content for ${filename}:`, error);
      throw new Error(`Failed to fetch file content: ${filename}`);
    }
  }

  private generateAnalysisSummary(results: FileAnalysisResult[]) {
    const totalFiles = results.length;
    const highRiskFiles = results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
    const averageRiskScore = results.length > 0 
      ? results.reduce((sum, r) => sum + r.riskScore, 0) / results.length 
      : 0;

    const recommendations: string[] = [];

    if (highRiskFiles > 0) {
      recommendations.push(`⚠️ ${highRiskFiles} test file(s) have high flaky risk - consider reviewing before merge`);
    }

    // Check for common patterns
    const timingIssues = results.filter(r => r.predictedFailureTypes.includes('timing_dependent')).length;
    if (timingIssues > 0) {
      recommendations.push(`🕐 ${timingIssues} file(s) may have timing-dependent issues - review async patterns and delays`);
    }

    const externalDependencies = results.filter(r => r.predictedFailureTypes.includes('external_service')).length;
    if (externalDependencies > 0) {
      recommendations.push(`🌐 ${externalDependencies} file(s) depend on external services - ensure proper mocking`);
    }

    const isolationIssues = results.filter(r => r.predictedFailureTypes.includes('environment_dependent')).length;
    if (isolationIssues > 0) {
      recommendations.push(`🏠 ${isolationIssues} file(s) may have test isolation issues - check for shared state`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All test files look good - low flaky risk detected');
    }

    return {
      totalFiles,
      highRiskFiles,
      averageRiskScore: Math.round(averageRiskScore * 100) / 100,
      recommendations
    };
  }

  private async postPRComment(
    repositoryFullName: string,
    prNumber: number,
    results: FileAnalysisResult[],
    summary: any,
    installationId: string | null
  ) {
    if (!installationId) {
      logger.info('GitHub installation not configured, skipping PR comment');
      return;
    }

    const highRiskFiles = results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical');
    
    let commentBody = `## 🔮 Flaky Test Prediction Analysis\n\n`;
    commentBody += `**Summary:** Analyzed ${summary.totalFiles} test files\n`;
    commentBody += `- **High Risk Files:** ${summary.highRiskFiles}\n`;
    commentBody += `- **Average Risk Score:** ${summary.averageRiskScore}/1.0\n\n`;

    if (highRiskFiles.length > 0) {
      commentBody += `### ⚠️ High Risk Files\n\n`;
      for (const file of highRiskFiles) {
        commentBody += `**${file.filePath}**\n`;
        commentBody += `- Risk Level: ${file.riskLevel.toUpperCase()}\n`;
        commentBody += `- Risk Score: ${file.riskScore}/1.0\n`;
        commentBody += `- Predicted Issues: ${file.predictedFailureTypes.join(', ')}\n`;
        commentBody += `- Confidence: ${Math.round(file.confidence * 100)}%\n\n`;
      }
    }

    commentBody += `### 💡 Recommendations\n\n`;
    for (const recommendation of summary.recommendations) {
      commentBody += `- ${recommendation}\n`;
    }

    commentBody += `\n---\n*This analysis was generated by Flaky Test Detector. [Learn more](https://your-docs-url.com)*`;

    try {
      await axios.post(
        `https://api.github.com/repos/${repositoryFullName}/issues/${prNumber}/comments`,
        { body: commentBody },
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          }
        }
      );

      logger.info(`Posted PR comment for ${repositoryFullName}#${prNumber}`);
    } catch (error) {
      logger.error(`Error posting PR comment:`, error);
      // Don't throw - this is not critical to the analysis
    }
  }
}