import { GitHubAppService } from './github-app.service';
import { RetryLogicService, TestRetryRequest } from './retry-logic.service';
import { logger } from '../utils/logger';
import { prisma } from './database.service';
import * as yaml from 'js-yaml';

export interface RetryWorkflowConfig {
  testCommand: string;
  testRunner: 'npm' | 'yarn' | 'jest' | 'mocha' | 'pytest' | 'gradle' | 'maven' | 'go' | 'custom';
  testPattern?: string;
  setupCommands?: string[];
  nodeVersion?: string;
  pythonVersion?: string;
  javaVersion?: string;
  goVersion?: string;
  customConfig?: Record<string, any>;
}

export interface WorkflowDispatchResult {
  workflowId: number;
  runId?: number;
  url: string;
  status: 'dispatched' | 'failed';
}

export class GitHubRetryWorkflowService {
  private githubApp: GitHubAppService;

  constructor() {
    this.githubApp = GitHubAppService.getInstance();
  }

  /**
   * Generate retry workflow YAML content
   */
  public generateRetryWorkflow(
    config: RetryWorkflowConfig,
    retryTests: TestRetryRequest[]
  ): string {
    const testNames = retryTests.map(t => t.testName);
    const testPattern = this.generateTestPattern(config.testRunner, testNames, config.testPattern);
    
    const workflow = {
      name: 'Flaky Test Retry',
      on: {
        workflow_dispatch: {
          inputs: {
            retry_tests: {
              description: 'Comma-separated list of test names to retry',
              required: true,
              default: testNames.join(','),
              type: 'string'
            },
            retry_attempt: {
              description: 'Retry attempt number',
              required: false,
              default: '1',
              type: 'string'
            },
            original_run_id: {
              description: 'Original workflow run ID that failed',
              required: false,
              type: 'string'
            }
          }
        }
      },
      jobs: {
        retry_flaky_tests: {
          'runs-on': 'ubuntu-latest',
          timeout: 30, // 30 minutes timeout
          steps: [
            {
              name: 'Checkout code',
              uses: 'actions/checkout@v4'
            },
            ...this.generateSetupSteps(config),
            {
              name: 'Install dependencies',
              run: this.generateInstallCommand(config.testRunner)
            },
            ...this.generateCustomSetupSteps(config.setupCommands || []),
            {
              name: 'Wait for retry delay',
              run: this.generateDelayCommand(retryTests)
            },
            {
              name: 'Run flaky test retry',
              run: testPattern,
              env: {
                RETRY_ATTEMPT: '${{ github.event.inputs.retry_attempt }}',
                ORIGINAL_RUN_ID: '${{ github.event.inputs.original_run_id }}',
                FLAKY_TEST_DETECTOR: 'true'
              }
            },
            {
              name: 'Report retry results',
              if: 'always()',
              run: this.generateReportingCommand()
            },
            {
              name: 'Upload test results',
              if: 'always()',
              uses: 'actions/upload-artifact@v4',
              with: {
                name: 'retry-test-results',
                path: this.getTestResultsPath(config.testRunner),
                'retention-days': 7
              }
            }
          ]
        }
      }
    };

    return yaml.dump(workflow, { 
      indent: 2,
      lineWidth: 120,
      noRefs: true 
    });
  }

  /**
   * Create or update retry workflow in repository
   */
  public async createRetryWorkflow(
    projectId: string,
    owner: string,
    repo: string,
    config: RetryWorkflowConfig,
    retryTests: TestRetryRequest[]
  ): Promise<{ workflowPath: string; commitSha: string }> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        throw new Error(`No GitHub installation found for project ${projectId}`);
      }

      const installationId = parseInt(project.githubInstallationId);
      const workflowContent = this.generateRetryWorkflow(config, retryTests);
      const workflowPath = '.github/workflows/flaky-test-retry.yml';

      // Check if workflow already exists
      let existingFile: any = null;
      try {
        existingFile = await this.githubApp.authenticatedRequest(
          installationId,
          `/repos/${owner}/${repo}/contents/${workflowPath}`
        );
      } catch (error) {
        // File doesn't exist, which is fine
        logger.info(`Retry workflow doesn't exist, will create new one`);
      }

      // Create or update the workflow file
      const commitData = {
        message: existingFile 
          ? 'Update flaky test retry workflow'
          : 'Add flaky test retry workflow',
        content: Buffer.from(workflowContent).toString('base64'),
        ...(existingFile ? { sha: existingFile.sha } : {})
      };

      const response = await this.githubApp.authenticatedRequest(
        installationId,
        `/repos/${owner}/${repo}/contents/${workflowPath}`,
        {
          method: 'PUT',
          data: commitData
        }
      );

      logger.info(`${existingFile ? 'Updated' : 'Created'} retry workflow for ${owner}/${repo}`);

      return {
        workflowPath,
        commitSha: response.commit.sha
      };
    } catch (error) {
      logger.error(`Failed to create retry workflow for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Dispatch retry workflow for failed tests
   */
  public async dispatchRetryWorkflow(
    projectId: string,
    owner: string,
    repo: string,
    retryTests: TestRetryRequest[],
    originalRunId?: string,
    branch: string = 'main'
  ): Promise<WorkflowDispatchResult> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        throw new Error(`No GitHub installation found for project ${projectId}`);
      }

      const installationId = parseInt(project.githubInstallationId);
      const testNames = retryTests.map(t => t.testName).join(',');
      const retryAttempt = Math.max(...retryTests.map(t => t.currentAttempt)) || 1;

      // Dispatch the workflow
      const dispatchResponse = await this.githubApp.authenticatedRequest(
        installationId,
        `/repos/${owner}/${repo}/actions/workflows/flaky-test-retry.yml/dispatches`,
        {
          method: 'POST',
          data: {
            ref: branch,
            inputs: {
              retry_tests: testNames,
              retry_attempt: retryAttempt.toString(),
              original_run_id: originalRunId || ''
            }
          }
        }
      );

      // Get the workflow ID for tracking
      const workflowsResponse = await this.githubApp.authenticatedRequest(
        installationId,
        `/repos/${owner}/${repo}/actions/workflows`
      );

      const retryWorkflow = workflowsResponse.workflows.find((w: any) => 
        w.name === 'Flaky Test Retry' || w.path.includes('flaky-test-retry')
      );

      if (!retryWorkflow) {
        throw new Error('Retry workflow not found in repository');
      }

      // Try to get the latest run ID (may not be immediately available)
      let runId: number | undefined;
      try {
        const runsResponse = await this.githubApp.authenticatedRequest(
          installationId,
          `/repos/${owner}/${repo}/actions/workflows/${retryWorkflow.id}/runs?per_page=1`
        );

        if (runsResponse.workflow_runs.length > 0) {
          runId = runsResponse.workflow_runs[0].id;
        }
      } catch (error) {
        logger.warn('Could not get latest run ID immediately after dispatch:', error);
      }

      logger.info(`Dispatched retry workflow for ${owner}/${repo}: ${retryTests.length} tests`);

      return {
        workflowId: retryWorkflow.id,
        runId,
        url: retryWorkflow.html_url,
        status: 'dispatched'
      };
    } catch (error) {
      logger.error(`Failed to dispatch retry workflow for ${owner}/${repo}:`, error);
      return {
        workflowId: 0,
        url: '',
        status: 'failed'
      };
    }
  }

  /**
   * Check if retry workflow exists in repository
   */
  public async hasRetryWorkflow(
    projectId: string,
    owner: string,
    repo: string
  ): Promise<boolean> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        return false;
      }

      const installationId = parseInt(project.githubInstallationId);
      
      await this.githubApp.authenticatedRequest(
        installationId,
        `/repos/${owner}/${repo}/contents/.github/workflows/flaky-test-retry.yml`
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get retry workflow run status
   */
  public async getRetryWorkflowStatus(
    projectId: string,
    owner: string,
    repo: string,
    runId: number
  ): Promise<{
    status: string;
    conclusion: string | null;
    html_url: string;
    jobs: Array<{
      name: string;
      status: string;
      conclusion: string | null;
    }>;
  }> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        throw new Error(`No GitHub installation found for project ${projectId}`);
      }

      const installationId = parseInt(project.githubInstallationId);

      const [runResponse, jobsResponse] = await Promise.all([
        this.githubApp.authenticatedRequest(
          installationId,
          `/repos/${owner}/${repo}/actions/runs/${runId}`
        ),
        this.githubApp.authenticatedRequest(
          installationId,
          `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`
        )
      ]);

      return {
        status: runResponse.status,
        conclusion: runResponse.conclusion,
        html_url: runResponse.html_url,
        jobs: jobsResponse.jobs.map((job: any) => ({
          name: job.name,
          status: job.status,
          conclusion: job.conclusion
        }))
      };
    } catch (error) {
      logger.error(`Failed to get retry workflow status for run ${runId}:`, error);
      throw error;
    }
  }

  private generateTestPattern(
    testRunner: string,
    testNames: string[],
    customPattern?: string
  ): string {
    if (customPattern) {
      return customPattern.replace('{tests}', testNames.join(' '));
    }

    const escapedTests = testNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    switch (testRunner) {
      case 'npm':
      case 'yarn':
        return `${testRunner} test -- --testNamePattern="${escapedTests.join('|')}"`;
      
      case 'jest':
        return `npx jest --testNamePattern="${escapedTests.join('|')}" --maxWorkers=1`;
      
      case 'mocha':
        return `npx mocha --grep "${escapedTests.join('|')}"`;
      
      case 'pytest':
        return `pytest -k "${escapedTests.join(' or ')}" --maxfail=1`;
      
      case 'gradle':
        return `./gradlew test --tests "${escapedTests.join('" --tests "')}"`;
      
      case 'maven':
        return `mvn test -Dtest="${escapedTests.join(',')}"`;
      
      case 'go':
        return `go test -run "${escapedTests.join('|')}" ./...`;
      
      default:
        return `echo "Running tests: ${testNames.join(', ')}" && npm test`;
    }
  }

  private generateSetupSteps(config: RetryWorkflowConfig): Array<any> {
    const steps: Array<any> = [];

    if (config.nodeVersion) {
      steps.push({
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v4',
        with: {
          'node-version': config.nodeVersion,
          cache: config.testRunner === 'yarn' ? 'yarn' : 'npm'
        }
      });
    }

    if (config.pythonVersion) {
      steps.push({
        name: 'Setup Python',
        uses: 'actions/setup-python@v4',
        with: {
          'python-version': config.pythonVersion,
          cache: 'pip'
        }
      });
    }

    if (config.javaVersion) {
      steps.push({
        name: 'Setup Java',
        uses: 'actions/setup-java@v4',
        with: {
          'java-version': config.javaVersion,
          distribution: 'temurin'
        }
      });
    }

    if (config.goVersion) {
      steps.push({
        name: 'Setup Go',
        uses: 'actions/setup-go@v4',
        with: {
          'go-version': config.goVersion
        }
      });
    }

    return steps;
  }

  private generateInstallCommand(testRunner: string): string {
    switch (testRunner) {
      case 'npm':
        return 'npm ci';
      case 'yarn':
        return 'yarn install --frozen-lockfile';
      case 'pytest':
        return 'pip install -r requirements.txt';
      case 'gradle':
        return './gradlew build -x test';
      case 'maven':
        return 'mvn compile test-compile';
      case 'go':
        return 'go mod download';
      default:
        return 'npm ci';
    }
  }

  private generateCustomSetupSteps(setupCommands: string[]): Array<any> {
    return setupCommands.map((command, index) => ({
      name: `Custom setup ${index + 1}`,
      run: command
    }));
  }

  private generateDelayCommand(retryTests: TestRetryRequest[]): string {
    const maxDelay = Math.max(...retryTests.map(t => 
      RetryLogicService['calculateRetryDelay'](t.currentAttempt, 30, 'linear')
    ));

    if (maxDelay > 0) {
      return `echo "Waiting ${maxDelay} seconds before retry..." && sleep ${maxDelay}`;
    }

    return 'echo "No delay configured for retry"';
  }

  private generateReportingCommand(): string {
    return `
curl -X POST "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/statuses/$GITHUB_SHA" \\
  -H "Authorization: token $GITHUB_TOKEN" \\
  -H "Accept: application/vnd.github.v3+json" \\
  -d '{
    "state": "'$([[ $? -eq 0 ]] && echo "success" || echo "failure")'",
    "description": "Flaky test retry completed",
    "context": "flaky-test-detector/retry"
  }' || echo "Failed to report status"
    `.trim();
  }

  private getTestResultsPath(testRunner: string): string {
    switch (testRunner) {
      case 'jest':
        return 'coverage/lcov-report/**';
      case 'pytest':
        return 'htmlcov/**';
      case 'gradle':
        return 'build/reports/tests/**';
      case 'maven':
        return 'target/surefire-reports/**';
      default:
        return 'test-results/**';
    }
  }
}