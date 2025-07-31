import { AggregatedResult, TestContext, TestResult } from '@jest/types';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

export interface NixbitReporterConfig {
  /**
   * Nixbit API endpoint URL
   * @default process.env.NIXBIT_API_URL || 'https://nixbit.dev/api'
   */
  apiUrl?: string;
  
  /**
   * Nixbit API key for authentication
   * @default process.env.NIXBIT_API_KEY
   */
  apiKey?: string;
  
  /**
   * Project ID in Nixbit platform
   * @default process.env.NIXBIT_PROJECT_ID
   */
  projectId?: string;
  
  /**
   * Git branch name
   * @default process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF_NAME || 'main'
   */
  branch?: string;
  
  /**
   * Git commit SHA
   * @default process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA
   */
  commit?: string;
  
  /**
   * Build/run ID for this test execution
   * @default process.env.CI_PIPELINE_ID || process.env.GITHUB_RUN_ID || Date.now().toString()
   */
  buildId?: string;
  
  /**
   * Test suite name override
   * @default package.json name or 'Jest Tests'
   */
  testSuiteName?: string;
  
  /**
   * Whether to enable verbose logging
   * @default process.env.NIXBIT_DEBUG === 'true'
   */
  debug?: boolean;
  
  /**
   * Timeout for API requests in milliseconds
   * @default 30000
   */
  timeout?: number;
  
  /**
   * Whether to fail silently on API errors
   * @default true
   */
  failSilently?: boolean;
  
  /**
   * Maximum number of retry attempts for failed API calls
   * @default 3
   */
  maxRetries?: number;
  
  /**
   * Delay between retry attempts in milliseconds
   * @default 1000
   */
  retryDelay?: number;
}

export interface NixbitTestResult {
  name: string;
  suite?: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  retryCount?: number;
  filePath?: string;
}

export interface NixbitTestRun {
  projectId: string;
  testSuiteName: string;
  branch: string;
  commit: string;
  buildId: string;
  timestamp: string;
  environment: {
    nodeVersion: string;
    jestVersion: string;
    platform: string;
    ci: boolean;
  };
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    duration: number;
  };
  tests: NixbitTestResult[];
}

/**
 * Jest custom reporter for integrating test results with Nixbit flaky test detection platform
 */
export default class NixbitReporter {
  private config: Required<NixbitReporterConfig>;
  private api: AxiosInstance;
  private testResults: NixbitTestResult[] = [];
  private startTime: number = 0;

  constructor(globalConfig: any, options: NixbitReporterConfig = {}) {
    // Merge configuration with defaults
    this.config = {
      apiUrl: options.apiUrl || process.env.NIXBIT_API_URL || 'https://nixbit.dev/api',
      apiKey: options.apiKey || process.env.NIXBIT_API_KEY || '',
      projectId: options.projectId || process.env.NIXBIT_PROJECT_ID || '',
      branch: options.branch || process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF_NAME || 'main',
      commit: options.commit || process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA || '',
      buildId: options.buildId || process.env.CI_PIPELINE_ID || process.env.GITHUB_RUN_ID || Date.now().toString(),
      testSuiteName: options.testSuiteName || this.getPackageName() || 'Jest Tests',
      debug: options.debug ?? (process.env.NIXBIT_DEBUG === 'true'),
      timeout: options.timeout || 30000,
      failSilently: options.failSilently ?? true,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
    };

    // Validate required configuration
    if (!this.config.apiKey) {
      const message = 'Nixbit API key is required. Set NIXBIT_API_KEY environment variable or pass apiKey in options.';
      if (this.config.failSilently) {
        this.log('warning', message);
      } else {
        throw new Error(message);
      }
    }

    if (!this.config.projectId) {
      const message = 'Nixbit project ID is required. Set NIXBIT_PROJECT_ID environment variable or pass projectId in options.';
      if (this.config.failSilently) {
        this.log('warning', message);
      } else {
        throw new Error(message);
      }
    }

    // Initialize axios instance
    this.api = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'User-Agent': `jest-nixbit-reporter/1.0.0`,
      },
    });

    // Add response interceptor for logging
    this.api.interceptors.response.use(
      (response) => {
        this.log('debug', `API Success: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        return response;
      },
      (error) => {
        if (axios.isAxiosError(error)) {
          this.log('error', `API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status} - ${error.message}`);
        }
        return Promise.reject(error);
      }
    );

    this.log('info', `Nixbit reporter initialized for project ${this.config.projectId}`);
  }

  /**
   * Called when Jest starts running tests
   */
  onRunStart(): void {
    this.startTime = Date.now();
    this.testResults = [];
    this.log('info', 'Test run started');
  }

  /**
   * Called when a test file starts running
   */
  onTestStart(): void {
    // Optional: Can be used for per-test timing if needed
  }

  /**
   * Called when a test file finishes running
   */
  onTestResult(test: TestContext, testResult: TestResult): void {
    const filePath = test.path;
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Process each test case in the file
    testResult.testResults.forEach((assertionResult) => {
      const nixbitResult: NixbitTestResult = {
        name: assertionResult.fullName,
        suite: this.extractSuiteName(assertionResult.ancestorTitles, relativePath),
        status: this.mapStatus(assertionResult.status),
        duration: assertionResult.duration || 0,
        filePath: relativePath,
        retryCount: assertionResult.invocations ? assertionResult.invocations - 1 : 0,
      };

      // Add error information for failed tests
      if (assertionResult.status === 'failed' && assertionResult.failureDetails) {
        const failure = assertionResult.failureDetails[0];
        if (failure) {
          nixbitResult.errorMessage = failure.message;
          nixbitResult.stackTrace = failure.stack;
        }
      }

      this.testResults.push(nixbitResult);
    });

    this.log('debug', `Processed ${testResult.testResults.length} tests from ${relativePath}`);
  }

  /**
   * Called when all tests have finished running
   */
  async onRunComplete(contexts: Set<TestContext>, results: AggregatedResult): Promise<void> {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    this.log('info', `Test run completed: ${results.numTotalTests} tests in ${duration}ms`);

    // Prepare test run data
    const testRun: NixbitTestRun = {
      projectId: this.config.projectId,
      testSuiteName: this.config.testSuiteName,
      branch: this.config.branch,
      commit: this.config.commit,
      buildId: this.config.buildId,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        jestVersion: this.getJestVersion(),
        platform: process.platform,
        ci: this.isCI(),
      },
      summary: {
        totalTests: results.numTotalTests,
        passedTests: results.numPassedTests,
        failedTests: results.numFailedTests,
        skippedTests: results.numPendingTests + results.numTodoTests,
        duration,
      },
      tests: this.testResults,
    };

    // Send test results to Nixbit API
    await this.sendTestResults(testRun);
  }

  /**
   * Send test results to Nixbit API with retry logic
   */
  private async sendTestResults(testRun: NixbitTestRun): Promise<void> {
    if (!this.config.apiKey || !this.config.projectId) {
      this.log('warning', 'Skipping API call due to missing configuration');
      return;
    }

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.log('info', `Sending test results to Nixbit (attempt ${attempt}/${this.config.maxRetries})`);
        
        const response = await this.api.post('/test-results', testRun);
        
        this.log('info', `Successfully sent ${testRun.tests.length} test results to Nixbit`);
        this.log('debug', `Response: ${JSON.stringify(response.data)}`);
        
        return; // Success, exit retry loop
        
      } catch (error) {
        const isLastAttempt = attempt === this.config.maxRetries;
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const message = error.response?.data?.error || error.message;
          
          this.log('error', `Failed to send test results (attempt ${attempt}): ${status} - ${message}`);
          
          // Don't retry for client errors (4xx)
          if (status && status >= 400 && status < 500) {
            this.log('error', 'Client error detected, skipping retries');
            break;
          }
        } else {
          this.log('error', `Failed to send test results (attempt ${attempt}): ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        if (isLastAttempt) {
          if (!this.config.failSilently) {
            throw error;
          }
          this.log('error', 'All retry attempts failed, giving up');
        } else {
          // Wait before retrying
          await this.delay(this.config.retryDelay);
        }
      }
    }
  }

  /**
   * Extract test suite name from ancestor titles and file path
   */
  private extractSuiteName(ancestorTitles: string[], filePath: string): string {
    if (ancestorTitles.length > 0) {
      return ancestorTitles[0];
    }
    
    // Fallback to file name without extension
    const fileName = path.basename(filePath, path.extname(filePath));
    return fileName
      .replace(/\.(test|spec)$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Map Jest test status to Nixbit status
   */
  private mapStatus(jestStatus: string): 'passed' | 'failed' | 'skipped' {
    switch (jestStatus) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'skipped':
      case 'todo':
        return 'skipped';
      default:
        return 'failed';
    }
  }

  /**
   * Get package name from package.json
   */
  private getPackageName(): string | null {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return packageJson.name;
      }
    } catch (error) {
      this.log('debug', 'Could not read package.json');
    }
    return null;
  }

  /**
   * Get Jest version
   */
  private getJestVersion(): string {
    try {
      const jestPackage = require('jest/package.json');
      return jestPackage.version;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Detect if running in CI environment
   */
  private isCI(): boolean {
    return Boolean(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.BUILD_NUMBER ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.JENKINS_URL ||
      process.env.CIRCLECI
    );
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging utility
   */
  private log(level: 'info' | 'debug' | 'warning' | 'error', message: string): void {
    if (level === 'debug' && !this.config.debug) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [nixbit-reporter] [${level.toUpperCase()}]`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warning':
        console.warn(`${prefix} ${message}`);
        break;
      case 'debug':
        console.debug(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }
}