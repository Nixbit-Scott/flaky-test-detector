import { prisma } from './database.service';
import { QuarantineService } from './quarantine.service';
import { FlakyTestDetectionService } from './flaky-test-detection.service';

export interface TestResultData {
  testName: string;
  testSuite?: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number; // milliseconds
  errorMessage?: string;
  stackTrace?: string;
  retryAttempt?: number;
}

export interface TestRunData {
  projectId: string;
  branch: string;
  commit: string;
  buildId?: string;
  buildUrl?: string;
  startedAt: Date;
  completedAt?: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  testResults: TestResultData[];
}

export interface NormalizedWebhookData {
  repository: string;
  branch: string;
  commit: string;
  buildId?: string;
  buildUrl?: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  testResults: TestResultData[];
}

export class TestResultService {
  /**
   * Process automated quarantine evaluation for new test results
   */
  private static async processAutomatedQuarantine(
    projectId: string, 
    testResults: TestResultData[]
  ): Promise<void> {
    try {
      // Process failed tests for potential quarantine
      const failedTests = testResults.filter(result => result.status === 'failed');
      
      for (const failedTest of failedTests) {
        // Skip if already processing or if this is a retry
        if (failedTest.retryAttempt && failedTest.retryAttempt > 0) {
          continue;
        }
        
        // Auto-evaluate for quarantine
        const result = await QuarantineService.autoEvaluateAndQuarantine(
          projectId,
          failedTest.testName,
          failedTest.testSuite,
          failedTest
        );
        
        if (result.quarantined) {
          console.log(`Auto-quarantined test: ${failedTest.testName} in ${projectId}`);
        }
      }
      
      // Run periodic unquarantine evaluation (limit to once per test run to avoid spam)
      if (Math.random() < 0.1) { // 10% chance to run unquarantine check
        const unquarantinedCount = await QuarantineService.autoEvaluateUnquarantine(projectId);
        if (unquarantinedCount > 0) {
          console.log(`Auto-unquarantined ${unquarantinedCount} tests in ${projectId}`);
        }
      }
      
    } catch (error) {
      console.error('Error in automated quarantine processing:', error);
      // Don't throw - quarantine failures shouldn't break test result processing
    }
  }
  static async createTestRun(testRunData: TestRunData) {
    const {
      projectId,
      branch,
      commit,
      buildId,
      buildUrl,
      startedAt,
      completedAt,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      testResults
    } = testRunData;

    // Create the test run
    const testRun = await prisma.testRun.create({
      data: {
        projectId,
        branch,
        commit,
        buildId,
        buildUrl,
        startedAt,
        completedAt,
        status: completedAt ? 'completed' : 'running',
        totalTests,
        passedTests,
        failedTests,
        skippedTests,
      },
    });

    // Create individual test results
    if (testResults.length > 0) {
      await prisma.testResult.createMany({
        data: testResults.map(result => ({
          testRunId: testRun.id,
          projectId: projectId, // Add projectId for impact calculator queries
          testName: result.testName,
          testSuite: result.testSuite,
          status: result.status,
          duration: result.duration,
          errorMessage: result.errorMessage,
          stackTrace: result.stackTrace,
          retryAttempt: result.retryAttempt || 0,
        })),
      });

      // AUTOMATED QUARANTINE PROCESSING
      await this.processAutomatedQuarantine(projectId, testResults);
    }

    return testRun;
  }

  static async getTestRunsByProject(projectId: string, limit = 50) {
    const testRuns = await prisma.testRun.findMany({
      where: {
        projectId,
      },
      include: {
        testResults: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    });

    return testRuns;
  }

  static async getTestRunById(testRunId: string) {
    const testRun = await prisma.testRun.findUnique({
      where: {
        id: testRunId,
      },
      include: {
        testResults: true,
        project: true,
      },
    });

    if (!testRun) {
      throw new Error('Test run not found');
    }

    return testRun;
  }

  static async updateTestRun(testRunId: string, updateData: Partial<Omit<TestRunData, 'projectId' | 'testResults'>>) {
    const updatedTestRun = await prisma.testRun.update({
      where: {
        id: testRunId,
      },
      data: {
        branch: updateData.branch,
        commit: updateData.commit,
        buildId: updateData.buildId,
        buildUrl: updateData.buildUrl,
        startedAt: updateData.startedAt,
        completedAt: updateData.completedAt,
        totalTests: updateData.totalTests,
        passedTests: updateData.passedTests,
        failedTests: updateData.failedTests,
        skippedTests: updateData.skippedTests,
        status: updateData.completedAt ? 'completed' : 'running',
      },
    });

    return updatedTestRun;
  }

  static calculateTestStatistics(testResults: TestResultData[]) {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.status === 'passed').length;
    const failedTests = testResults.filter(t => t.status === 'failed').length;
    const skippedTests = testResults.filter(t => t.status === 'skipped').length;

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
    };
  }

  static async findProjectByRepository(repository: string) {
    const project = await prisma.project.findFirst({
      where: {
        repository: {
          contains: repository,
          mode: 'insensitive',
        },
      },
    });

    return project;
  }

  static async processWebhookData(webhookData: NormalizedWebhookData) {
    // Find project by repository
    const project = await this.findProjectByRepository(webhookData.repository);
    
    if (!project) {
      throw new Error(`No project found for repository: ${webhookData.repository}`);
    }

    // Calculate test statistics
    const stats = this.calculateTestStatistics(webhookData.testResults);

    // Create test run with results
    const testRun = await this.createTestRun({
      projectId: project.id,
      branch: webhookData.branch,
      commit: webhookData.commit,
      buildId: webhookData.buildId,
      buildUrl: webhookData.buildUrl,
      startedAt: webhookData.startedAt,
      completedAt: webhookData.completedAt,
      ...stats,
      testResults: webhookData.testResults,
    });

    // Trigger flaky test analysis in background (don't await to avoid blocking)
    this.analyzeTestRunForFlaky(testRun.id, project.id).catch(error => {
      console.error('Failed to analyze test run for flaky tests:', error);
    });

    return {
      testRun,
      project,
    };
  }

  private static async analyzeTestRunForFlaky(testRunId: string, projectId: string) {
    try {
      // Import here to avoid circular dependency
      const { FlakyTestDetectionService } = await import('./flaky-test-detection.service');
      
      // Run flaky test analysis
      await FlakyTestDetectionService.analyzeTestResults(projectId);
    } catch (error) {
      console.error('Flaky test analysis failed:', error);
    }
  }
}